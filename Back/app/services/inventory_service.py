"""InventoryService — 재고 품목·로트·폐기·경고·FIFO 차감 (01_basic_design.md §3.3).

수량은 품목에 두지 않고 로트(`inventory_lots.remaining_quantity`) 합계로 계산한다.
판매 차감 규칙(차감 기준 시각·로트 순서·재고 확인 필요)은 01_basic_design.md §3.3.3.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import errors
from app.models.coupang import CoupangProduct
from app.models.inventory_item import (
    AdjustmentReason,
    DisposalLog,
    InventoryAdjustmentLog,
    InventoryItem,
    InventoryLot,
)
from app.models.menu import Menu, Recipe, RecipeIngredient
from app.models.notification import Notification, NotificationType
from app.models.order import OrderApprovalLog, OrderItem, OrderRecommendationItem
from app.services.notification_service import NotificationService

KST = ZoneInfo("Asia/Seoul")

# 소비기한 알림 조건 — 오늘 기준 일수, 알림 유형, 제목, 본문 (01_basic_design.md §3.3.6)
EXPIRY_RULES = (
    (3, NotificationType.EXPIRY_D3, "소비기한 D-3 임박", "{name} 로트 {n}개가 3일 뒤 만료됩니다."),
    (1, NotificationType.EXPIRY_D1, "소비기한 D-1 임박", "{name} 로트 {n}개가 내일 만료됩니다."),
    (
        -1,
        NotificationType.EXPIRY_OVER,
        "소비기한 초과",
        "{name} 로트 {n}개가 소비기한을 넘겼습니다. 폐기 처리해 주세요.",
    ),
)

# FIFO 순서 — 소비기한 빠른 순, 소비기한 없는 로트는 뒤에 입고일 순 (01_basic_design.md §3.3.3)
FIFO_ORDER = (
    InventoryLot.expiry_date.is_(None),
    InventoryLot.expiry_date,
    InventoryLot.received_at,
    InventoryLot.created_at,
)


def now_kst() -> datetime:
    """판매 시각(sold_at)과 같은 기준의 매장 현지 시각 (naive)."""
    return datetime.now(KST).replace(tzinfo=None)


@dataclass
class ItemStock:
    item: InventoryItem
    total_quantity: Decimal
    nearest_expiry: date | None  # 잔여 수량이 남은 로트 중 가장 빠른 소비기한
    product: CoupangProduct | None = None  # 연결된 공용 쿠팡 상품


@dataclass
class DeductionContext:
    """업로드 1회분 차감 준비물. 기준 시각은 업로드 시작 시점 값으로 고정한다 —
    파일 안 판매 순서가 섞여 있어도 같은 기준으로 거른다."""

    recipes: dict[str, list[tuple[str, Decimal]]]  # menu_id → [(item_id, 메뉴 1개당 사용량)]
    deducted_until: dict[str, datetime]  # item_id → 업로드 시작 시점의 차감 기준 시각


@dataclass
class DeductionResult:
    deducted_sales: int = 0
    needs_check_items: list[tuple[str, str]] = field(default_factory=list)  # (item_id, name)


class InventoryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ------------------------------------------------------------------ 품목

    async def list_stocks(self, *, store_id: str) -> list[ItemStock]:
        items = (
            await self.session.scalars(
                select(InventoryItem)
                .where(InventoryItem.store_id == store_id)
                .order_by(InventoryItem.name)
            )
        ).all()
        agg = await self._lot_aggregates([i.item_id for i in items])
        products = await self._products(items)
        return [
            ItemStock(
                i, *agg.get(i.item_id, (Decimal(0), None)), products.get(i.coupang_item_id)
            )
            for i in items
        ]

    async def get_stock(self, *, store_id: str, item_id: str) -> ItemStock:
        item = await self.get_item(store_id=store_id, item_id=item_id)
        agg = await self._lot_aggregates([item_id])
        products = await self._products([item])
        return ItemStock(
            item, *agg.get(item_id, (Decimal(0), None)), products.get(item.coupang_item_id)
        )

    async def _products(self, items: list[InventoryItem]) -> dict[str | None, CoupangProduct]:
        ids = {i.coupang_item_id for i in items if i.coupang_item_id}
        if not ids:
            return {}
        rows = await self.session.scalars(
            select(CoupangProduct).where(CoupangProduct.item_id.in_(ids))
        )
        return {p.item_id: p for p in rows}

    async def get_item(self, *, store_id: str, item_id: str) -> InventoryItem:
        item = await self.session.get(InventoryItem, item_id)
        if item is None:
            raise errors.DomainError(
                status_code=404, error_code="NOT_FOUND", message="재료를 찾을 수 없습니다."
            )
        if item.store_id != store_id:
            raise errors.forbidden()
        return item

    async def create_item(
        self,
        *,
        store_id: str,
        name: str,
        unit: str,
        quantity: Decimal,
        expiry_date: date | None,
        purchase_price: int | None,
        low_stock_threshold: Decimal,
        lead_time_days: int | None,
        safety_stock: Decimal | None,
    ) -> ItemStock:
        await self._assert_unique_name(store_id=store_id, name=name)
        now = now_kst()
        item = InventoryItem(
            store_id=store_id,
            name=name,
            unit=unit,
            low_stock_threshold=low_stock_threshold,
            lead_time_days=lead_time_days,
            safety_stock=safety_stock,
            deducted_until=now,
        )
        self.session.add(item)
        await self.session.flush()
        if quantity > 0:
            # 등록 수량은 첫 로트로 저장 (01_basic_design.md §3.3.1)
            self.session.add(
                InventoryLot(
                    item_id=item.item_id,
                    quantity=quantity,
                    remaining_quantity=quantity,
                    purchase_price=purchase_price or 0,
                    received_at=now.date(),
                    expiry_date=expiry_date,
                )
            )
        await self.session.commit()
        await self.session.refresh(item)
        return ItemStock(item, quantity, expiry_date if quantity > 0 else None)

    async def update_item(self, *, store_id: str, item_id: str, patch: dict) -> ItemStock:
        item = await self.get_item(store_id=store_id, item_id=item_id)
        new_name = patch.get("name")
        if new_name is not None and new_name != item.name:
            await self._assert_unique_name(store_id=store_id, name=new_name)
        for k, v in patch.items():
            if v is not None:
                setattr(item, k, v)
        await self.session.commit()
        await self.session.refresh(item)
        return await self.get_stock(store_id=store_id, item_id=item_id)

    async def delete_item(self, *, store_id: str, item_id: str) -> None:
        item = await self.get_item(store_id=store_id, item_id=item_id)
        used = await self.session.scalar(
            select(RecipeIngredient.id).where(RecipeIngredient.item_id == item_id).limit(1)
        )
        if used is not None:
            raise errors.DomainError(
                status_code=409,
                error_code="INVENTORY_ITEM_IN_USE",
                message="레시피에서 사용 중인 재료는 삭제할 수 없습니다.",
            )
        ordered = await self.session.scalar(
            select(OrderItem.id).where(OrderItem.item_id == item_id).limit(1)
        ) or await self.session.scalar(
            select(OrderApprovalLog.id).where(OrderApprovalLog.item_id == item_id).limit(1)
        )
        if ordered is not None:
            raise errors.DomainError(
                status_code=409,
                error_code="INVENTORY_ITEM_IN_USE",
                message="발주 내역에 포함된 재료는 삭제할 수 없습니다.",
            )
        await self.session.execute(
            delete(OrderRecommendationItem).where(OrderRecommendationItem.item_id == item_id)
        )
        # 조정·폐기 이력은 로트 FK가 CASCADE가 아니라 먼저 지운다. 로트는 품목 삭제에 CASCADE
        await self.session.execute(
            delete(InventoryAdjustmentLog).where(InventoryAdjustmentLog.item_id == item_id)
        )
        await self.session.execute(delete(DisposalLog).where(DisposalLog.item_id == item_id))
        await self.session.delete(item)
        await self.session.commit()

    async def total_quantities(self, *, store_id: str) -> dict[str, Decimal]:
        return {s.item.item_id: s.total_quantity for s in await self.list_stocks(store_id=store_id)}

    # ------------------------------------------------------------------ 로트

    async def add_lot(
        self,
        *,
        store_id: str,
        item_id: str,
        quantity: Decimal,
        received_at: date,
        expiry_date: date | None,
        purchase_price: int,
    ) -> InventoryLot:
        lot = await self.stage_lot(
            store_id=store_id,
            item_id=item_id,
            quantity=quantity,
            received_at=received_at,
            expiry_date=expiry_date,
            purchase_price=purchase_price,
        )
        await self.session.commit()
        await self.session.refresh(lot)
        return lot

    async def stage_lot(
        self,
        *,
        store_id: str,
        item_id: str,
        quantity: Decimal,
        received_at: date,
        expiry_date: date | None,
        purchase_price: int,
    ) -> InventoryLot:
        """로트를 만들되 커밋하지 않는다 — 발주 입고 처리가 같은 트랜잭션에서 쓴다."""
        item = await self.get_item(store_id=store_id, item_id=item_id)
        lot = InventoryLot(
            item_id=item_id,
            quantity=quantity,
            remaining_quantity=quantity,
            purchase_price=purchase_price,
            received_at=received_at,
            expiry_date=expiry_date,
        )
        self.session.add(lot)
        item.needs_check = False
        await self.session.flush()
        return lot

    async def get_lots(
        self, *, store_id: str, item_id: str
    ) -> tuple[InventoryItem, list[InventoryLot]]:
        item = await self.get_item(store_id=store_id, item_id=item_id)
        lots = (
            await self.session.scalars(
                select(InventoryLot).where(InventoryLot.item_id == item_id).order_by(*FIFO_ORDER)
            )
        ).all()
        return item, list(lots)

    async def update_lot(
        self,
        *,
        store_id: str,
        item_id: str,
        lot_id: str,
        user_id: str,
        changes: dict,
        reason: AdjustmentReason,
        memo: str | None,
    ) -> InventoryAdjustmentLog:
        """changes에는 보낸 필드만 담긴다 (remaining_quantity, expiry_date)."""
        item = await self.get_item(store_id=store_id, item_id=item_id)
        lot = await self._get_lot(item_id=item_id, lot_id=lot_id)
        before_qty, before_exp = lot.remaining_quantity, lot.expiry_date
        if changes.get("remaining_quantity") is not None:
            lot.remaining_quantity = changes["remaining_quantity"]
        if "expiry_date" in changes:
            lot.expiry_date = changes["expiry_date"]
        if reason == AdjustmentReason.STOCKTAKE:
            item.needs_check = False
        log = InventoryAdjustmentLog(
            lot_id=lot_id,
            item_id=item_id,
            store_id=store_id,
            user_id=user_id,
            before_quantity=before_qty,
            after_quantity=lot.remaining_quantity,
            delta_quantity=lot.remaining_quantity - before_qty,
            before_expiry_date=before_exp,
            after_expiry_date=lot.expiry_date,
            reason=reason,
            memo=memo,
        )
        self.session.add(log)
        await self.session.commit()
        await self.session.refresh(log)
        return log

    async def dispose(
        self,
        *,
        store_id: str,
        item_id: str,
        lot_id: str,
        quantity: Decimal,
        reason: str | None,
        user_id: str,
    ) -> tuple[DisposalLog, Decimal]:
        """(폐기 이력, 차감 후 로트 잔여 수량)."""
        await self.get_item(store_id=store_id, item_id=item_id)
        lot = await self._get_lot(item_id=item_id, lot_id=lot_id, for_update=True)
        if quantity > lot.remaining_quantity:
            raise errors.DomainError(
                status_code=422,
                error_code="INVENTORY_DISPOSE_EXCEEDS",
                message="폐기 수량이 로트 잔여 수량보다 많습니다.",
            )
        lot.remaining_quantity -= quantity
        log = DisposalLog(
            lot_id=lot_id,
            item_id=item_id,
            store_id=store_id,
            user_id=user_id,
            quantity=quantity,
            reason=reason,
        )
        self.session.add(log)
        await self.session.commit()
        await self.session.refresh(log)
        await self.session.refresh(lot)
        return log, lot.remaining_quantity

    # ------------------------------------------------------------------ FIFO 차감

    async def deduction_context(self, *, store_id: str) -> DeductionContext:
        rows = (
            await self.session.execute(
                select(Recipe.menu_id, RecipeIngredient.item_id, RecipeIngredient.quantity)
                .join(RecipeIngredient, RecipeIngredient.recipe_id == Recipe.recipe_id)
                .join(Menu, Menu.menu_id == Recipe.menu_id)
                .where(Menu.store_id == store_id, Menu.use_inventory_deduction.is_(True))
            )
        ).all()
        recipes: dict[str, list[tuple[str, Decimal]]] = defaultdict(list)
        for menu_id, item_id, qty in rows:
            recipes[menu_id].append((item_id, qty))
        marks = (
            await self.session.execute(
                select(InventoryItem.item_id, InventoryItem.deducted_until).where(
                    InventoryItem.store_id == store_id
                )
            )
        ).all()
        return DeductionContext(recipes=dict(recipes), deducted_until=dict(marks))

    async def deduct_stock(
        self, ctx: DeductionContext, sales: list[tuple[str, int, datetime]]
    ) -> DeductionResult:
        """새로 저장된 판매 (menu_id, 수량, 판매 시각)를 FIFO 차감한다.
        커밋은 호출자가 판매 저장과 함께 한다."""
        result = DeductionResult()
        need: dict[str, Decimal] = defaultdict(Decimal)
        latest: dict[str, datetime] = {}
        for menu_id, qty, sold_at in sales:
            if qty <= 0:
                continue
            hit = False
            for item_id, per_menu in ctx.recipes.get(menu_id, ()):
                mark = ctx.deducted_until.get(item_id)
                if mark is None or sold_at <= mark:
                    continue
                need[item_id] += per_menu * qty
                latest[item_id] = max(latest.get(item_id, sold_at), sold_at)
                hit = True
            if hit:
                result.deducted_sales += 1

        for item_id in sorted(need):
            item = await self.session.get(InventoryItem, item_id, with_for_update=True)
            if item is None:
                continue
            left = need[item_id]
            lots = (
                await self.session.scalars(
                    select(InventoryLot)
                    .where(InventoryLot.item_id == item_id, InventoryLot.remaining_quantity > 0)
                    .order_by(*FIFO_ORDER)
                    .with_for_update()
                )
            ).all()
            for lot in lots:
                if left <= 0:
                    break
                take = min(lot.remaining_quantity, left)
                lot.remaining_quantity -= take
                left -= take
            if left > 0 and not item.needs_check:
                item.needs_check = True
                result.needs_check_items.append((item_id, item.name))
            item.deducted_until = max(item.deducted_until, latest[item_id])
        return result

    async def check_expiry_batch(self, *, today: date) -> int:
        """소비기한 D-3·D-1·초과 첫날 로트를 품목·조건별 알림 한 건으로 보낸다. 만든 알림 수를 반환.

        같은 날(한국 시각) 같은 품목·조건 알림이 이미 있으면 건너뛴다 — 배치 재실행 대비.
        """
        rules = {today + timedelta(days=days): rule for days, *rule in EXPIRY_RULES}
        rows = (
            await self.session.execute(
                select(
                    InventoryItem.store_id,
                    InventoryItem.item_id,
                    InventoryItem.name,
                    InventoryLot.expiry_date,
                    func.count(InventoryLot.lot_id),
                )
                .join(InventoryLot, InventoryLot.item_id == InventoryItem.item_id)
                .where(
                    InventoryLot.remaining_quantity > 0,
                    InventoryLot.expiry_date.in_(list(rules)),
                )
                .group_by(
                    InventoryItem.store_id,
                    InventoryItem.item_id,
                    InventoryItem.name,
                    InventoryLot.expiry_date,
                )
            )
        ).all()
        if not rows:
            return 0

        # notifications.created_at은 UTC — 한국 시각 오늘 0시를 UTC로 바꿔 비교한다
        day_start = (
            datetime.combine(today, time.min, tzinfo=KST).astimezone(UTC).replace(tzinfo=None)
        )
        sent = set(
            (
                await self.session.execute(
                    select(Notification.type, Notification.related_resource_id).where(
                        Notification.created_at >= day_start,
                        Notification.type.in_([rule[0] for rule in rules.values()]),
                        Notification.related_resource_id.in_({r.item_id for r in rows}),
                    )
                )
            ).all()
        )

        notifier = NotificationService(self.session)
        created = 0
        for store_id, item_id, name, expiry_date, lot_count in rows:
            type_, title, body = rules[expiry_date]
            if (type_, item_id) in sent:
                continue
            n = await notifier.create_and_push(
                store_id=store_id,
                type=type_,
                title=title,
                body=body.format(name=name, n=lot_count),
                related_resource_type="inventory_item",
                related_resource_id=item_id,
            )
            created += n is not None
        return created

    # ------------------------------------------------------------------ 내부

    async def _lot_aggregates(self, item_ids: list[str]) -> dict[str, tuple[Decimal, date | None]]:
        if not item_ids:
            return {}
        rows = (
            await self.session.execute(
                select(
                    InventoryLot.item_id,
                    func.sum(InventoryLot.remaining_quantity),
                    func.min(InventoryLot.expiry_date),
                )
                .where(InventoryLot.item_id.in_(item_ids), InventoryLot.remaining_quantity > 0)
                .group_by(InventoryLot.item_id)
            )
        ).all()
        return {item_id: (total, nearest) for item_id, total, nearest in rows}

    async def _get_lot(
        self, *, item_id: str, lot_id: str, for_update: bool = False
    ) -> InventoryLot:
        lot = await self.session.get(InventoryLot, lot_id, with_for_update=for_update)
        if lot is None or lot.item_id != item_id:
            raise errors.DomainError(
                status_code=404,
                error_code="INVENTORY_LOT_NOT_FOUND",
                message="로트를 찾을 수 없습니다.",
            )
        return lot

    async def _assert_unique_name(self, *, store_id: str, name: str) -> None:
        exists = await self.session.scalar(
            select(InventoryItem.item_id).where(
                InventoryItem.store_id == store_id, InventoryItem.name == name
            )
        )
        if exists is not None:
            raise errors.DomainError(
                status_code=409,
                error_code="INVENTORY_ITEM_DUPLICATE",
                message="이미 등록된 재료명입니다.",
            )
