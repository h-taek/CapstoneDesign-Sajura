"""AutomationService — 쿠팡 담기 시작·걸음 중계·마침(발주 확정).

01_basic_design.md §3.3.1·§3.7.4·§3.8, 02_implementation_design.md §2.4·§3.7, 03_be.md §2.4·§5·§12.

브라우저 조작은 확장이, 다음 동작 판단은 담기 에이전트 서버가 한다. BE는 담기 진행 상태를 Redis에
두고, 걸음마다 받은 요소 목록의 상품 카드로 공용 쿠팡 상품·매장 가격을 갱신하고, 담기 결과
(`cart_added`)로 재료를 연결한다. 발주는 담기를 마칠 때 담긴 품목으로만 저장한다.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import errors
from app.core.redis import get_redis
from app.integrations import agent
from app.models.coupang import CoupangProduct, CoupangStorePrice
from app.models.inventory_item import InventoryItem
from app.models.order import (
    Order,
    OrderApprovalLog,
    OrderItem,
    OrderRecommendation,
    OrderRecommendationItem,
)
from app.schemas.orders import (
    AgentCall,
    AutomateFinishResponse,
    AutomateItem,
    AutomateItemResult,
    AutomateStartResponse,
    AutomateStepAction,
    AutomateStepDone,
    AutomateStepRequest,
    AutomateTarget,
    CartAdded,
    ElementsResult,
    NonWowPrice,
    PageElement,
)
from app.services import coupang_pricing as cp

CART_CHECK = "cart_check"
SEARCH_INTERVAL = timedelta(days=3)  # 연결 시각부터 이 기간이 지나면 검색해 고른다
RUN_TTL_SECONDS = 60 * 60
MANUAL_GUIDE_URL = "https://www.coupang.com/"
PRODUCT_URL = "https://www.coupang.com/vp/products/{product_id}?itemId={item_id}"

_DISCOUNT_LABELS = {"할인", "쿠폰할인", "와우할인", "와우쿠폰할인"}
_FRESH_IMAGE = "logo_fresh"

SELECTION_RULES = """검색 결과에서 아래 순서로 상품 1개를 고른다.
1. 재료와 같은 식자재만 후보로 둔다. 양념·조리 상품, 다른 부위·다른 품목, 재료가 일부만 든 세트는 뺀다.{fresh}
   - 손질 형태가 다르면 다른 식자재다. 상품명에 재료명에 없는 손질 형태 표시가 있으면 뺀다. 손질 형태 표시는 원물을 자르거나 다듬은 상태를 나타내는 말이다(예: 대패·큐브·한입·슬라이스·채·다진·깐·손질·절단·칼집, '5mm'·'3~5cm' 같은 절단 크기).
   - 재료명에 손질 형태가 있으면(예: '대패삼겹살'·'깐양파') 그 형태 표시가 있는 상품만 둔다.
   - '구이용'·'찌개용' 같은 용도 표시는 손질 형태 표시가 아니다.
   - 냉동 여부가 다르면 다른 식자재다. 재료명에 '냉동'이 없으면 냉동 상품을 빼고, 있으면 냉동 상품만 둔다.
2. 후보마다 재료 단위당 가격(표시 가격 ÷ 상품 1개 용량)을 구한다. 표시 가격은 검색 결과 카드의 최종 가격이고, 로그인 상태의 와우 가격도 그대로 쓴다.
3. 재료 단위당 가격이 가장 낮은 후보보다 10% 이내로 비싼 후보만 남긴다.
4. 남은 후보 중 별점이 가장 높은 상품을, 별점이 같으면 리뷰 수가 많은 상품을, 리뷰 수도 같으면 재료 단위당 가격이 낮은 상품을 고른다. 별점·리뷰 수가 없는 상품은 가장 낮은 값으로 본다."""

ADD_RULES = """담을 개수는 발주 수량 ÷ 포장 수량을 올림한 값이다. 포장 수량은 상품 1개에 든 재료 수량(재료 단위)이고 상품명·옵션으로 판단한다. 상품 페이지의 수량 버튼으로 개수를 맞춘 뒤 장바구니에 담는다.
검색은 검색창에 입력한 뒤 검색 버튼을 누른다.
담지 못하면 finish_item에 사유를 적고 끝낸다."""


@dataclass(frozen=True)
class Card:
    """요소 목록의 상품 하나 — 상품 고유 ID가 붙은 요소와 그 아래 깊이 요소 (04_fe.md §12.5)."""

    item_id: str
    product_id: str
    vendor_item_id: str
    product_name: str
    display_price: int | None
    discount_label: str | None
    unit_price_text: str | None
    rocket_fresh: bool
    non_wow_price: int | None


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _price(text: str) -> int | None:
    digits = text.strip()
    if not digits.endswith("원"):
        return None
    digits = digits[:-1].strip().replace(",", "")
    return int(digits) if digits.isdigit() and int(digits) > 0 else None


def read_cards(elements: list[PageElement]) -> list[Card]:
    """상품 고유 ID가 붙은 요소마다 그 바로 뒤의 더 깊은 요소들을 그 상품의 값으로 읽는다.

    같은 itemId가 여러 번 나오면(광고 카드 등) 처음 것만 쓴다.
    """
    cards: dict[str, Card] = {}
    for i, el in enumerate(elements):
        if not (el.item_id and el.product_id and el.vendor_item_id) or el.item_id in cards:
            continue
        name = el.text.strip()
        if not name:
            continue
        below: list[PageElement] = []
        for child in elements[i + 1 :]:
            if child.depth <= el.depth:
                break
            below.append(child)
        texts = [c.text.strip() for c in below]
        cards[el.item_id] = Card(
            item_id=el.item_id,
            product_id=el.product_id,
            vendor_item_id=el.vendor_item_id,
            product_name=name,
            display_price=next(
                (p for c in below if c.role != "deletion" and (p := _price(c.text)) is not None),
                None,
            ),
            discount_label=next((t for t in texts if t in _DISCOUNT_LABELS), None),
            unit_price_text=next((t for t in texts if cp.is_unit_price_text(t)), None),
            rocket_fresh=any(
                c.role == "image" and c.text.strip().startswith(_FRESH_IMAGE) for c in below
            ),
            non_wow_price=el.non_wow_price,
        )
    return list(cards.values())


def _qty(value: Decimal) -> str:
    return f"{value.normalize():f}"


def item_instruction(
    item: InventoryItem,
    final_quantity: Decimal,
    product: CoupangProduct | None,
    *,
    logged_in: bool,
    now: datetime,
) -> tuple[str, str | None]:
    """품목 대화의 첫 지시와, 연결 상품을 담으라고 지시했으면 그 itemId (03_be.md §2.4.1)."""
    head = f"품목: {item.name} (재료 단위 {item.unit}), 발주 수량 {_qty(final_quantity)}{item.unit}"
    fresh = "" if logged_in else (
        " 쿠팡에 로그인되어 있지 않아 로켓프레시 상품은 담을 수 없으니 로켓프레시 상품도 뺀다."
    )
    rules = SELECTION_RULES.format(fresh=fresh)
    linked = (
        product is not None
        and item.coupang_linked_at is not None
        and now - item.coupang_linked_at < SEARCH_INTERVAL
        and (logged_in or not product.rocket_fresh)
    )
    if linked:
        assert product is not None
        url = PRODUCT_URL.format(product_id=product.product_id, item_id=product.item_id)
        body = (
            f"연결된 상품 페이지 {url} 를 열어 그 상품을 담는다. 담지 못하면 쿠팡 검색창에 "
            f"'{item.name}'을 그대로 넣어 검색하고 아래 기준으로 골라 담는다.\n{rules}"
        )
        return f"{head}\n\n{body}\n\n{ADD_RULES}", product.item_id
    body = f"쿠팡 검색창에 '{item.name}'을 그대로 넣어 검색한다. {rules}"
    return f"{head}\n\n{body}\n\n{ADD_RULES}", None


def cart_check_instruction(
    lines: list[tuple[InventoryItem, Decimal, CoupangProduct | None]],
) -> str:
    """장바구니 검수 대화의 첫 지시 — 품목별 담기 결과의 상품과 재고 품목 (03_be.md §2.4.1)."""
    rows = []
    for item, qty, product in lines:
        label = (
            f"{product.product_name}{', ' + product.option_name if product.option_name else ''}"
            f" (itemId {product.item_id})"
            if product
            else "상품 정보 없음"
        )
        rows.append(
            f"- item_id={item.item_id} | 재료: {item.name} | 발주 수량: {_qty(qty)}{item.unit}"
            f" | 담은 상품: {label}"
        )
    return (
        "장바구니 검수. 쿠팡 장바구니를 열어 아래 품목마다 담은 상품이 발주 수량에 맞는 "
        "개수(발주 수량 ÷ 포장 수량을 올림)로 담겼는지 본다. 모자라면 수량을 늘린다. "
        "많으면 줄이지 않고 그 품목을 CHECK_NEEDED로 둔다. "
        "점주가 원래 담아 둔 같은 상품과 합쳐졌을 수 있다.\n"
        "모두 보면 finish_cart_check로 품목마다 item_id와 status(OK 또는 CHECK_NEEDED)를 답한다.\n"
        + "\n".join(rows)
    )


def _run_key(run_id: str) -> str:
    return f"coupang_run:{run_id}"


def _bad_target() -> errors.DomainError:
    return errors.validation_error("진행 중 담기의 대상이 아닙니다.")


def _not_found(message: str) -> errors.DomainError:
    return errors.DomainError(status_code=404, error_code="NOT_FOUND", message=message)


def _already_ordered() -> errors.DomainError:
    return errors.state_conflict("이미 발주를 확정한 추천안입니다.")


def _passthrough(exc: agent.AgentError) -> errors.DomainError:
    body = exc.body
    return errors.DomainError(
        status_code=exc.status_code,
        error_code=body["error"],
        message=body["message"],
        detail=body.get("detail"),
    )


class AutomationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------ 진행 상태

    async def _load_run(self, *, store_id: str, run_id: str) -> dict[str, Any] | None:
        raw = await get_redis().get(_run_key(run_id))
        if raw is None:
            return None
        run = json.loads(raw)
        return run if run["store_id"] == store_id else None

    async def _save_run(self, run_id: str, run: dict[str, Any]) -> None:
        await get_redis().set(
            _run_key(run_id), json.dumps(run, ensure_ascii=False), ex=RUN_TTL_SECONDS
        )

    async def _items(self, *, store_id: str, item_ids: list[str]) -> dict[str, InventoryItem]:
        rows = (
            await self.session.scalars(
                select(InventoryItem).where(
                    InventoryItem.store_id == store_id, InventoryItem.item_id.in_(item_ids)
                )
            )
        ).all()
        return {i.item_id: i for i in rows}

    async def _recommendation_ordered(self, recommendation_id: str) -> bool:
        return (
            await self.session.scalar(
                select(Order.order_id).where(Order.recommendation_id == recommendation_id)
            )
        ) is not None

    # ------------------------------------------------------------ start

    async def start(
        self,
        *,
        store_id: str,
        recommendation_id: str | None,
        items: list[AutomateItem],
        note: str | None,
        logged_in: bool,
    ) -> AutomateStartResponse:
        found = await self._items(store_id=store_id, item_ids=[i.item_id for i in items])
        missing = [i.item_id for i in items if i.item_id not in found]
        if missing:
            raise errors.DomainError(
                status_code=404,
                error_code="NOT_FOUND",
                message="존재하지 않는 재료가 포함되어 있습니다.",
                detail={"item_ids": missing},
            )
        if recommendation_id is not None:
            rec = await self.session.scalar(
                select(OrderRecommendation.recommendation_id).where(
                    OrderRecommendation.recommendation_id == recommendation_id,
                    OrderRecommendation.store_id == store_id,
                )
            )
            if rec is None:
                raise _not_found("추천안을 찾을 수 없습니다.")
            if await self._recommendation_ordered(recommendation_id):
                raise _already_ordered()

        run_id = str(uuid.uuid4())
        await self._save_run(
            run_id,
            {
                "store_id": store_id,
                "recommendation_id": recommendation_id,
                "note": note,
                "logged_in": logged_in,
                "items": [
                    {"item_id": i.item_id, "final_quantity": str(i.final_quantity)} for i in items
                ],
                # 대상별 대화 — {"id", "linked_item_id", "cart", "reason"}
                "conversations": {},
                "check_needed": [],
                "wow_item_ids": [],
            },
        )
        return AutomateStartResponse(
            run_id=run_id,
            targets=[
                AutomateTarget(item_id=i.item_id, item_name=found[i.item_id].name) for i in items
            ],
        )

    # ------------------------------------------------------------ step

    async def step(
        self, *, store_id: str, run_id: str, req: AutomateStepRequest
    ) -> AutomateStepAction | AutomateStepDone:
        run = await self._load_run(store_id=store_id, run_id=run_id)
        quantities = (
            {i["item_id"]: Decimal(i["final_quantity"]) for i in run["items"]} if run else {}
        )
        if run is None or (req.target != CART_CHECK and req.target not in quantities):
            raise _bad_target()
        now = utcnow()

        # 와우 할인 카드의 비회원 가격 — 에이전트 서버 응답과 관계없이 반영한다
        if req.non_wow_prices:
            await self._apply_non_wow(
                store_id=store_id, run=run, prices=req.non_wow_prices, now=now
            )
            await self.session.commit()

        conversations: dict[str, dict[str, Any]] = run["conversations"]
        instruction = None
        if req.result is None:
            instruction, linked_item_id = await self._instruction(
                store_id=store_id, run=run, target=req.target, quantities=quantities, now=now
            )
            conversations[req.target] = {
                "id": str(uuid.uuid4()),
                "linked_item_id": linked_item_id,
                "cart": None,
                "reason": None,
            }
            await self._save_run(run_id, run)
        elif req.target not in conversations:
            raise _bad_target()
        conversation = conversations[req.target]

        cart = getattr(req.result, "cart_added", None)
        if cart is not None and req.target != CART_CHECK:
            await self._record_cart(
                item_id=req.target,
                final_quantity=quantities[req.target],
                conversation=conversation,
                cart=cart,
                now=now,
            )
            await self.session.commit()
            await self._save_run(run_id, run)
            return AutomateStepDone(done=AgentCall(tool="finish_item", args={"reason": None}))

        try:
            answer = await agent.step(
                conversation_id=conversation["id"],
                store_id=store_id,
                order_id=run_id,
                instruction=instruction,
                result=req.result.model_dump(mode="json") if req.result is not None else None,
            )
        except agent.AgentError as exc:
            raise _passthrough(exc) from exc

        if isinstance(req.result, ElementsResult):
            await self._save_cards(
                store_id=store_id, run=run, cards=read_cards(req.result.elements), now=now
            )
            await self.session.commit()
        if "done" in answer:
            done = AgentCall.model_validate(answer["done"])
            if done.tool == "finish_item":
                reason = done.args.get("reason")
                conversation["reason"] = reason if isinstance(reason, str) else None
            elif done.tool == "finish_cart_check":
                checked = done.args.get("items") or []
                run["check_needed"] = sorted(
                    {
                        c.get("item_id")
                        for c in checked
                        if isinstance(c, dict)
                        and c.get("status") == "CHECK_NEEDED"
                        and c.get("item_id") in quantities
                    }
                    | set(run["check_needed"])
                )
            await self._save_run(run_id, run)
            return AutomateStepDone(done=done)
        await self._save_run(run_id, run)
        return AutomateStepAction(action=AgentCall.model_validate(answer["action"]))

    async def _instruction(
        self,
        *,
        store_id: str,
        run: dict[str, Any],
        target: str,
        quantities: dict[str, Decimal],
        now: datetime,
    ) -> tuple[str, str | None]:
        items = await self._items(store_id=store_id, item_ids=list(quantities))
        if target != CART_CHECK:
            item = items[target]
            product = (
                await self.session.get(CoupangProduct, item.coupang_item_id)
                if item.coupang_item_id
                else None
            )
            return item_instruction(
                item, quantities[target], product, logged_in=run["logged_in"], now=now
            )
        carts = {
            item_id: c["cart"]["item_id"]
            for item_id, c in run["conversations"].items()
            if item_id != CART_CHECK and c.get("cart")
        }
        products = {
            p.item_id: p
            for p in (
                await self.session.scalars(
                    select(CoupangProduct).where(CoupangProduct.item_id.in_(list(carts.values())))
                )
            ).all()
        } if carts else {}
        lines = [
            (items[item_id], quantities[item_id], products.get(carts[item_id]))
            for item_id in quantities
            if item_id in carts and item_id in items
        ]
        return cart_check_instruction(lines), None

    async def _record_cart(
        self,
        *,
        item_id: str,
        final_quantity: Decimal,
        conversation: dict[str, Any],
        cart: CartAdded,
        now: datetime,
    ) -> None:
        """담기 결과 — 품목 단가·소계를 진행 상태에 두고 재료를 그 상품에 연결한다 (§3.8.1)."""
        item = await self.session.get(InventoryItem, item_id)
        product = await self.session.get(CoupangProduct, cart.item_id)
        unit_price = None
        if item is not None and product is not None and product.content_quantity:
            unit_price = cp.item_unit_price(
                Decimal(cart.price) / product.content_quantity, product.content_unit, item.unit
            )
        subtotal = (
            int((final_quantity * unit_price).quantize(Decimal(1), rounding=ROUND_HALF_UP))
            if unit_price is not None
            else None
        )
        conversation["cart"] = {
            "item_id": cart.item_id,
            "unit_price": str(unit_price) if unit_price is not None else None,
            "subtotal": subtotal,
        }
        # 공용 쿠팡 상품 행이 없으면(그 상품 화면을 받지 못함) 연결하지 않는다
        if item is None or product is None:
            return
        kept = (
            conversation.get("linked_item_id") == cart.item_id
            and item.coupang_item_id == cart.item_id
        )
        item.coupang_item_id = cart.item_id
        if not kept:
            item.coupang_linked_at = now

    # ------------------------------------------------------------ 공용 쿠팡 상품·매장 가격

    async def _save_cards(
        self, *, store_id: str, run: dict[str, Any], cards: list[Card], now: datetime
    ) -> None:
        """요소 목록의 상품으로 공용 쿠팡 상품·매장 가격 저장·갱신 (01_basic_design.md §3.3.1).

        행 잠금 순서를 매장 사이에 맞추려고 itemId 순으로 처리한다.
        """
        wow = set(run["wow_item_ids"])
        for card in sorted(cards, key=lambda c: c.item_id):
            name, option = cp.split_name(card.product_name)
            content = cp.content(name, option)
            values = {
                "item_id": card.item_id,
                "product_id": card.product_id,
                "vendor_item_id": card.vendor_item_id,
                "product_name": name[:300],
                "option_name": option[:200] if option else None,
                "rocket_fresh": card.rocket_fresh,
                "content_quantity": content.quantity if content else None,
                "content_unit": content.unit if content else None,
                "updated_at": now,
            }
            stmt = mysql_insert(CoupangProduct).values(**values)
            await self.session.execute(
                stmt.on_duplicate_key_update(
                    {k: stmt.inserted[k] for k in values if k != "item_id"}
                )
            )
            if cp.is_wow(card.discount_label) and card.non_wow_price is None:
                wow.add(card.item_id)  # 확장이 뒤에서 받은 비회원 가격이 다음 걸음에 온다
                continue
            price = cp.store_price(
                display_price=card.display_price,
                discount_label=card.discount_label,
                unit_price_text=card.unit_price_text,
                non_wow_price=card.non_wow_price,
                content=content,
            )
            if price is not None:
                await self._apply_store_price(
                    item_id=card.item_id, store_id=store_id, price=price, now=now
                )
        run["wow_item_ids"] = sorted(wow)

    async def _apply_non_wow(
        self,
        *,
        store_id: str,
        run: dict[str, Any],
        prices: list[NonWowPrice],
        now: datetime,
    ) -> None:
        """그 담기에서 와우 할인 카드로 받은 itemId만 매장 가격에 반영한다. 나머지는 버린다."""
        wow = set(run["wow_item_ids"])
        for p in sorted({p.item_id: p for p in prices}.values(), key=lambda p: p.item_id):
            if p.item_id not in wow:
                continue
            product = await self.session.get(CoupangProduct, p.item_id)
            if product is None:
                continue
            price = cp.store_price(
                display_price=p.display_price,
                discount_label="와우할인",
                unit_price_text=p.unit_price_text,
                non_wow_price=p.non_wow_price,
                content=cp.stored_content(product.content_quantity, product.content_unit),
            )
            if price is not None:
                await self._apply_store_price(
                    item_id=p.item_id, store_id=store_id, price=price, now=now
                )

    async def _apply_store_price(
        self,
        *,
        item_id: str,
        store_id: str,
        price: tuple[int, Decimal | None],
        now: datetime,
    ) -> None:
        """매장 가격을 덮어쓰고 판매가·공용 단가를 다수결로 다시 정한다.

        여러 매장이 동시에 다시 계산해도 한 표가 빠지지 않게 공용 쿠팡 상품 행을 잠근다.
        """
        product = await self.session.scalar(
            select(CoupangProduct)
            .where(CoupangProduct.item_id == item_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if product is None:
            return
        sale, unit = price
        stmt = mysql_insert(CoupangStorePrice).values(
            item_id=item_id, store_id=store_id, sale_price=sale, unit_price=unit, received_at=now
        )
        await self.session.execute(
            stmt.on_duplicate_key_update(
                sale_price=stmt.inserted.sale_price,
                unit_price=stmt.inserted.unit_price,
                received_at=stmt.inserted.received_at,
            )
        )
        rows = (
            await self.session.execute(
                select(
                    CoupangStorePrice.sale_price,
                    CoupangStorePrice.unit_price,
                    CoupangStorePrice.received_at,
                ).where(CoupangStorePrice.item_id == item_id)
            )
        ).all()
        decided = cp.majority(rows)
        if decided is not None:
            product.sale_price, product.unit_price = decided
            product.updated_at = now
        await self.session.flush()

    async def clear_store_prices(self, *, today: date) -> int:
        """매장 가격 전체 삭제 — 이틀마다 자정. 공용 판매가·단가는 그대로 둔다 (§3.3.1)."""
        if today.toordinal() % 2:
            return 0
        result = await self.session.execute(delete(CoupangStorePrice))
        await self.session.commit()
        return result.rowcount or 0

    # ------------------------------------------------------------ finish

    async def finish(
        self, *, store_id: str, run_id: str, non_wow_prices: list[NonWowPrice]
    ) -> AutomateFinishResponse:
        run = await self._load_run(store_id=store_id, run_id=run_id)
        if run is None:
            raise _not_found("진행 중인 쿠팡 담기가 없습니다.")
        now = utcnow()
        if non_wow_prices:
            await self._apply_non_wow(store_id=store_id, run=run, prices=non_wow_prices, now=now)
            await self.session.commit()

        recommendation_id = run["recommendation_id"]
        if recommendation_id is not None and await self._recommendation_ordered(
            recommendation_id
        ):
            raise _already_ordered()

        check_needed = set(run["check_needed"])
        results: list[AutomateItemResult] = []
        added: list[tuple[str, Decimal, dict[str, Any]]] = []
        for line in run["items"]:
            item_id = line["item_id"]
            conversation = run["conversations"].get(item_id) or {}
            cart = conversation.get("cart")
            if cart is None:
                results.append(
                    AutomateItemResult(
                        item_id=item_id, status="FAILED", reason=conversation.get("reason")
                    )
                )
                continue
            added.append((item_id, Decimal(line["final_quantity"]), cart))
            results.append(
                AutomateItemResult(
                    item_id=item_id,
                    status="CHECK_NEEDED" if item_id in check_needed else "ADDED",
                    reason=None,
                )
            )

        order_id = None
        total = sum(cart["subtotal"] for _, _, cart in added if cart["subtotal"] is not None)
        if added:
            order_id = await self._save_order(
                store_id=store_id, run=run, added=added, total=total, now=now
            )
        await get_redis().delete(_run_key(run_id))
        failed = any(r.status == "FAILED" for r in results)
        return AutomateFinishResponse(
            order_id=order_id,
            approved_at=now,
            total_estimated_cost=total,
            manual_guide_url=MANUAL_GUIDE_URL if failed else None,
            items=results,
        )

    async def _save_order(
        self,
        *,
        store_id: str,
        run: dict[str, Any],
        added: list[tuple[str, Decimal, dict[str, Any]]],
        total: int,
        now: datetime,
    ) -> str:
        """담긴 품목으로 발주·발주 품목·수정 이력을 한 트랜잭션으로 저장한다 (03_be.md §5)."""
        recommendation_id = run["recommendation_id"]
        order = Order(
            store_id=store_id,
            recommendation_id=recommendation_id,
            total_estimated_cost=total,
            note=run["note"],
            approved_at=now,
        )
        self.session.add(order)
        try:
            await self.session.flush()
        except IntegrityError as exc:  # 같은 추천안 finish가 동시에 들어온 경우
            await self.session.rollback()
            if "uq_orders_recommendation_id" in str(exc.orig).lower():
                raise _already_ordered() from exc
            raise
        for item_id, final_quantity, cart in added:
            self.session.add(
                OrderItem(
                    order_id=order.order_id,
                    item_id=item_id,
                    final_quantity=final_quantity,
                    unit_price=Decimal(cart["unit_price"]) if cart["unit_price"] else None,
                    subtotal=cart["subtotal"],
                )
            )
        if recommendation_id is not None:
            # 수정 이력은 점주가 낸 모든 품목 — 담지 못한 품목도 확정 수량으로 남긴다
            finals = {i["item_id"]: Decimal(i["final_quantity"]) for i in run["items"]}
            recommended = {
                ri.item_id: ri.recommended_quantity
                for ri in (
                    await self.session.scalars(
                        select(OrderRecommendationItem).where(
                            OrderRecommendationItem.recommendation_id == recommendation_id
                        )
                    )
                ).all()
            }
            for item_id in [*recommended, *(x for x in finals if x not in recommended)]:
                rec_qty = recommended.get(item_id, Decimal(0))
                final = finals.get(item_id, Decimal(0))
                self.session.add(
                    OrderApprovalLog(
                        order_id=order.order_id,
                        item_id=item_id,
                        recommended_quantity=rec_qty,
                        final_quantity=final,
                        was_modified=final != rec_qty,
                    )
                )
        await self.session.commit()
        return order.order_id
