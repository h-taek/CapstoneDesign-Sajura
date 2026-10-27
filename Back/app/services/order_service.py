"""OrderService — 추천발주 계산·저장 + 발주 확정·내역.

02_implementation_design.md §3.7, 03_be.md §5.

추천발주는 조회 시점에 n8n이 저장한 예측과 그 시점 재고로 BE가 계산해 추천안으로 저장한다
(01_basic_design.md §3.7.2). AI Server는 호출하지 않는다.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import errors
from app.models.inventory_item import InventoryItem, InventoryLot
from app.models.menu import Menu, Recipe, RecipeIngredient
from app.models.order import (
    ConfigStatus,
    Order,
    OrderApprovalLog,
    OrderItem,
    OrderRecommendation,
    OrderRecommendationItem,
    OrderStatus,
    ReceiptStatus,
)
from app.schemas.orders import OrderApproveItem
from app.services.forecast_service import ForecastService
from app.services.inventory_service import InventoryService

KST = ZoneInfo("Asia/Seoul")
ZERO = Decimal(0)


def _dec(value: float) -> Decimal:
    return Decimal(str(round(float(value), 3)))


def _not_found(message: str) -> errors.DomainError:
    return errors.DomainError(status_code=404, error_code="NOT_FOUND", message=message)


def _already_approved() -> errors.DomainError:
    return errors.state_conflict("이미 발주를 확정한 추천안입니다.")


def _recommend_item(
    *,
    need: float,
    horizon: int,
    lead_time: int,
    safety: float,
    current: float,
    incoming: float,
    unit: str,
    last_open: date | None,
) -> dict:
    """재료 하나의 권장 발주 수량·예상 소진 시점·근거 (01_basic_design.md §3.7.2).

    need는 대상 기간 예상 소모량. 입고 예정량은 발주량에서만 빼고,
    소진 시점은 손에 있는 재고로 본다.
    """
    daily = need / horizon if horizon else 0.0
    if daily <= 0:
        return {
            "recommended_quantity": 0.0,
            "expected_stockout_date": None,
            "recommendation_reason": "대상 기간 예상 소모 없음 — 레시피 연결 메뉴의 판매 예상 0",
        }
    window_need = daily * (horizon + lead_time)
    recommended = max(0.0, window_need + safety - current - incoming)
    stockout = (
        last_open + timedelta(days=math.ceil(current / daily)) if last_open is not None else None
    )
    reason = (
        f"향후 {horizon}일+리드타임 {lead_time}일 예상 소모 {window_need:.1f}{unit} "
        f"+ 안전재고 {safety:g} − 현재고 {current:g}"
        + (f" − 입고 예정 {incoming:g}" if incoming > 0 else "")
    )
    return {
        "recommended_quantity": round(recommended, 2),
        "expected_stockout_date": stockout,
        "recommendation_reason": reason,
    }


class OrderService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _unit_prices(self, *, item_ids: list[str]) -> dict[str, Decimal]:
        """재료 단위당 단가 — 출처는 매장 공용 쿠팡 상품 테이블 하나다(01_basic_design.md §3.3.1).

        그 테이블과 확장의 가격 전송은 쿠팡 자동 담기 단계에서 만든다.
        그 전까지 단가는 모두 미설정이다.
        """
        return {}

    async def _incoming_quantities(self, *, store_id: str) -> dict[str, Decimal]:
        """입고 예정량 — 입고 대기 상태인 발주 품목의 확정 수량 합계 (01_basic_design.md §3.7.2)."""
        rows = (
            await self.session.execute(
                select(OrderItem.item_id, func.sum(OrderItem.final_quantity))
                .join(Order, Order.order_id == OrderItem.order_id)
                .where(
                    Order.store_id == store_id,
                    OrderItem.receipt_status == ReceiptStatus.PENDING,
                )
                .group_by(OrderItem.item_id)
            )
        ).all()
        return {item_id: Decimal(total) for item_id, total in rows}

    async def recommend(self, *, store_id: str) -> dict:
        """저장된 예측과 그 시점 재고로 추천발주를 계산해 추천안으로 저장한다 (§3.7.2)."""
        forecast = ForecastService(self.session)
        predictions = await forecast.get_forecast(store_id=store_id)
        last_open = await forecast.last_sale_date(store_id=store_id)

        # 메뉴별 대상 기간 예상 판매량 = 대상일별 저장 수량의 합
        menu_qty: dict[str, float] = {}
        menu_names: dict[str, str] = {}
        for p in predictions:
            for m in p["menu_forecast"]:
                menu_qty[m["menu_id"]] = menu_qty.get(m["menu_id"], 0.0) + m["expected_quantity"]
                menu_names[m["menu_id"]] = m["menu_name"]
        low = next((p for p in predictions if p["is_low_confidence"]), None)

        recipe_rows = (
            await self.session.execute(
                select(Recipe.menu_id, RecipeIngredient.item_id, RecipeIngredient.quantity)
                .join(RecipeIngredient, RecipeIngredient.recipe_id == Recipe.recipe_id)
                .join(Menu, Menu.menu_id == Recipe.menu_id)
                .where(Menu.store_id == store_id)
            )
        ).all()
        need: dict[str, float] = {}
        for menu_id, item_id, per_menu in recipe_rows:
            need[item_id] = need.get(item_id, 0.0) + menu_qty.get(menu_id, 0.0) * float(per_menu)

        stocks = await InventoryService(self.session).list_stocks(store_id=store_id)
        incoming = await self._incoming_quantities(store_id=store_id)
        horizon = len(predictions)

        # 같은 날 추천안 중 발주에 연결되지 않은 것은 대체한다 (하위 품목은 FK CASCADE)
        today = datetime.now(KST).date()
        linked = select(Order.recommendation_id).where(Order.recommendation_id.is_not(None))
        await self.session.execute(
            delete(OrderRecommendation).where(
                OrderRecommendation.store_id == store_id,
                OrderRecommendation.target_date == today,
                OrderRecommendation.recommendation_id.not_in(linked),
            )
        )
        rec = OrderRecommendation(store_id=store_id, target_date=today)
        self.session.add(rec)
        await self.session.flush()

        prices = await self._unit_prices(item_ids=[st.item.item_id for st in stocks])
        recommendations = []
        for st in stocks:
            inv = st.item
            configured = inv.lead_time_days is not None and inv.safety_stock is not None
            lead_time = inv.lead_time_days if inv.lead_time_days is not None else 1
            safety = float(inv.safety_stock) if inv.safety_stock is not None else 0.0
            current = float(st.total_quantity)  # 로트 잔여 수량 합계
            arriving = float(incoming.get(inv.item_id, ZERO))
            calc = _recommend_item(
                need=need.get(inv.item_id, 0.0), horizon=horizon, lead_time=lead_time,
                safety=safety, current=current, incoming=arriving, unit=inv.unit,
                last_open=last_open,
            )
            config_status = (
                ConfigStatus.USER_CONFIGURED if configured else ConfigStatus.DEFAULT_USED
            )
            self.session.add(
                OrderRecommendationItem(
                    recommendation_id=rec.recommendation_id,
                    item_id=inv.item_id,
                    recommended_quantity=_dec(calc["recommended_quantity"]),
                    lead_time_days=lead_time,
                    safety_stock=_dec(safety),
                    config_status=config_status,
                )
            )
            recommendations.append(
                {
                    "item_id": inv.item_id,
                    "item_name": inv.name,
                    "unit": inv.unit,
                    **calc,
                    "lead_time_days": lead_time,
                    "safety_stock": safety,
                    "config_status": config_status.value,
                    "unit_price": float(p) if (p := prices.get(inv.item_id)) is not None else None,
                }
            )
        await self.session.commit()

        return {
            "recommendation_id": rec.recommendation_id,
            "target_dates": [p["target_date"] for p in predictions],
            "is_low_confidence": low is not None,
            "low_confidence_reason": low["low_confidence_reason"] if low else None,
            "menu_forecast": [
                {"menu_id": m, "menu_name": menu_names[m], "expected_quantity": round(q, 1)}
                for m, q in sorted(menu_qty.items(), key=lambda kv: kv[1], reverse=True)
            ],
            "recommendations": recommendations,
        }

    async def approve_order(
        self,
        *,
        store_id: str,
        recommendation_id: str | None,
        items: list[OrderApproveItem],
        note: str | None,
    ) -> Order:
        item_ids = [i.item_id for i in items]
        found = set(
            (
                await self.session.scalars(
                    select(InventoryItem.item_id).where(
                        InventoryItem.store_id == store_id, InventoryItem.item_id.in_(item_ids)
                    )
                )
            ).all()
        )
        missing = [item_id for item_id in item_ids if item_id not in found]
        if missing:
            raise errors.DomainError(
                status_code=404,
                error_code="NOT_FOUND",
                message="존재하지 않는 재료가 포함되어 있습니다.",
                detail={"item_ids": missing},
            )

        rec_items: dict[str, OrderRecommendationItem] = {}
        if recommendation_id is not None:
            rec = await self.session.scalar(
                select(OrderRecommendation).where(
                    OrderRecommendation.recommendation_id == recommendation_id,
                    OrderRecommendation.store_id == store_id,
                )
            )
            if rec is None:
                raise _not_found("추천안을 찾을 수 없습니다.")
            if await self.session.scalar(
                select(Order.order_id).where(Order.recommendation_id == recommendation_id)
            ):
                raise _already_approved()
            rec_items = {
                ri.item_id: ri
                for ri in (
                    await self.session.scalars(
                        select(OrderRecommendationItem).where(
                            OrderRecommendationItem.recommendation_id == recommendation_id
                        )
                    )
                ).all()
            }

        # 확정 시점 단가 — 미설정이면 단가·소계를 비운다 (01_basic_design.md §3.7.4)
        prices = await self._unit_prices(item_ids=item_ids)
        subtotals = {
            i.item_id: int(
                (i.final_quantity * prices[i.item_id]).quantize(Decimal(1), rounding=ROUND_HALF_UP)
            )
            for i in items
            if i.item_id in prices
        }
        order = Order(
            store_id=store_id,
            recommendation_id=recommendation_id,
            status=OrderStatus.APPROVED,
            total_estimated_cost=sum(subtotals.values()),
            note=note,
        )
        self.session.add(order)
        try:
            await self.session.flush()
        except IntegrityError as exc:  # 같은 추천안 확정이 동시에 들어온 경우
            await self.session.rollback()
            if "uq_orders_recommendation_id" in str(exc.orig).lower():
                raise _already_approved() from exc
            raise

        for i in items:
            self.session.add(
                OrderItem(
                    order_id=order.order_id,
                    item_id=i.item_id,
                    final_quantity=i.final_quantity,
                    unit_price=prices.get(i.item_id),
                    subtotal=subtotals.get(i.item_id),
                )
            )

        if recommendation_id is not None:
            finals = {i.item_id: i.final_quantity for i in items}
            for item_id in [*rec_items, *(x for x in finals if x not in rec_items)]:
                ri = rec_items.get(item_id)
                recommended = ri.recommended_quantity if ri else ZERO
                final = finals.get(item_id, ZERO)
                self.session.add(
                    OrderApprovalLog(
                        order_id=order.order_id,
                        item_id=item_id,
                        recommended_quantity=recommended,
                        final_quantity=final,
                        was_modified=final != recommended,
                    )
                )

        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def list_orders(
        self, *, store_id: str, page: int, size: int
    ) -> tuple[list[tuple[Order, int]], int]:
        total = await self.session.scalar(
            select(func.count()).select_from(Order).where(Order.store_id == store_id)
        )
        rows = (
            await self.session.execute(
                select(Order, func.count(OrderItem.id))
                .outerjoin(OrderItem, OrderItem.order_id == Order.order_id)
                .where(Order.store_id == store_id)
                .group_by(Order.order_id)
                .order_by(Order.approved_at.desc(), Order.order_id)
                .offset((page - 1) * size)
                .limit(size)
            )
        ).all()
        return [(order, count) for order, count in rows], total or 0

    async def get_order(self, *, store_id: str, order_id: str) -> Order:
        order = await self.session.scalar(
            select(Order).where(Order.order_id == order_id, Order.store_id == store_id)
        )
        if order is None:
            raise _not_found("발주 내역을 찾을 수 없습니다.")
        return order

    async def get_order_items(self, *, order_id: str) -> list[tuple[OrderItem, str, str]]:
        rows = (
            await self.session.execute(
                select(OrderItem, InventoryItem.name, InventoryItem.unit)
                .join(InventoryItem, InventoryItem.item_id == OrderItem.item_id)
                .where(OrderItem.order_id == order_id)
                .order_by(InventoryItem.name)
            )
        ).all()
        return [(item, name, unit) for item, name, unit in rows]

    async def get_approval_logs(self, *, order_id: str) -> list[tuple[OrderApprovalLog, str, str]]:
        rows = (
            await self.session.execute(
                select(OrderApprovalLog, InventoryItem.name, InventoryItem.unit)
                .join(InventoryItem, InventoryItem.item_id == OrderApprovalLog.item_id)
                .where(OrderApprovalLog.order_id == order_id)
                .order_by(InventoryItem.name)
            )
        ).all()
        return [(log, name, unit) for log, name, unit in rows]

    async def pending_items(self, *, item_id: str) -> list[tuple[OrderItem, Order]]:
        """재료 하나의 입고 대기 발주 품목 — 확정일 오름차순.

        매장 확인은 호출 쪽(재료 조회)이 한다.
        """
        rows = (
            await self.session.execute(
                select(OrderItem, Order)
                .join(Order, Order.order_id == OrderItem.order_id)
                .where(
                    OrderItem.item_id == item_id,
                    OrderItem.receipt_status == ReceiptStatus.PENDING,
                )
                .order_by(Order.approved_at, OrderItem.id)
            )
        ).all()
        return [(oi, order) for oi, order in rows]

    async def _pending_item_for_update(self, *, store_id: str, order_item_id: str) -> OrderItem:
        order_item = await self.session.scalar(
            select(OrderItem)
            .join(Order, Order.order_id == OrderItem.order_id)
            .where(OrderItem.id == order_item_id, Order.store_id == store_id)
            .with_for_update()
        )
        if order_item is None:
            raise _not_found("발주 품목을 찾을 수 없습니다.")
        if order_item.receipt_status != ReceiptStatus.PENDING:
            raise errors.state_conflict("이미 입고 처리한 발주 품목입니다.")
        return order_item

    async def receive_item(
        self,
        *,
        store_id: str,
        order_item_id: str,
        quantity: Decimal,
        received_at: date,
        expiry_date: date | None,
        purchase_price: int,
    ) -> InventoryLot:
        """입고 처리 — 로트를 만들고 입고 완료로 바꾼다. 한 트랜잭션 (01_basic_design.md §3.7.5)."""
        order_item = await self._pending_item_for_update(
            store_id=store_id, order_item_id=order_item_id
        )
        lot = await InventoryService(self.session).stage_lot(
            store_id=store_id,
            item_id=order_item.item_id,
            quantity=quantity,
            received_at=received_at,
            expiry_date=expiry_date,
            purchase_price=purchase_price,
        )
        order_item.receipt_status = ReceiptStatus.RECEIVED
        order_item.lot_id = lot.lot_id
        order_item.processed_at = func.now()
        await self.session.commit()
        await self.session.refresh(lot)
        return lot

    async def skip_item(self, *, store_id: str, order_item_id: str) -> None:
        """입고 안 함 — 끝내 오지 않은 품목을 로트 없이 닫는다."""
        order_item = await self._pending_item_for_update(
            store_id=store_id, order_item_id=order_item_id
        )
        order_item.receipt_status = ReceiptStatus.SKIPPED
        order_item.processed_at = func.now()
        await self.session.commit()
