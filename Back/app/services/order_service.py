"""OrderService — 발주추천 승인(확정) 기록.

AI 수요예측 기반 발주 확정·쿠팡 자동 담기는 별도 후속 작업. 우선 점주가
재고 임계값 기반 추천 중 선택·수정한 품목을 "발주 확정"으로 기록만 한다.
"""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import errors
from app.models.inventory_item import InventoryItem
from app.models.purchase_order import PurchaseOrder


class OrderService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def confirm_order(
        self, *, store_id: str, items: list[tuple[str, Decimal]]
    ) -> PurchaseOrder:
        item_ids = [item_id for item_id, _ in items]
        rows = (
            await self.session.scalars(
                select(InventoryItem).where(
                    InventoryItem.store_id == store_id, InventoryItem.item_id.in_(item_ids)
                )
            )
        ).all()
        by_id = {row.item_id: row for row in rows}
        missing = [item_id for item_id in item_ids if item_id not in by_id]
        if missing:
            raise errors.DomainError(
                status_code=404, error_code="NOT_FOUND",
                message="존재하지 않는 재료가 포함되어 있습니다.", detail={"item_ids": missing},
            )

        snapshot = [
            {
                "item_id": item_id,
                "name": by_id[item_id].name,
                "unit": by_id[item_id].unit,
                "quantity": str(quantity),
            }
            for item_id, quantity in items
        ]
        order = PurchaseOrder(store_id=store_id, items=snapshot, status="CONFIRMED")
        self.session.add(order)
        await self.session.commit()
        await self.session.refresh(order)
        return order

    async def list_orders(self, *, store_id: str) -> list[PurchaseOrder]:
        rows = (
            await self.session.scalars(
                select(PurchaseOrder)
                .where(PurchaseOrder.store_id == store_id)
                .order_by(PurchaseOrder.created_at.desc())
            )
        ).all()
        return list(rows)
