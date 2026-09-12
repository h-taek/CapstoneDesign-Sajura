"""InventoryService — 재고 품목 CRUD + 임계값 기반 발주추천.

발주추천은 AI 서버(AI/app/api/orders.py)에 실제 수요예측 기반 추천 엔진이 있지만
그 입력으로 필요한 실시간 재고 수량을 BE가 아직 보유하지 않아 (재고관리
current_quantity 도입 전) 호출할 수 없었다. 이 서비스가 그 수량을 갖게 되면서,
우선 AI 없이도 정직하게 계산 가능한 "임계값 이하 재고" 기준 추천을 제공한다.
AI 예측 기반 추천(리드타임 중 예상 소비량 반영)은 별도 후속 작업.
"""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import errors
from app.models.menu import RecipeIngredient
from app.models.inventory_item import InventoryItem


class InventoryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_items(self, *, store_id: str) -> list[InventoryItem]:
        rows = (
            await self.session.scalars(
                select(InventoryItem).where(InventoryItem.store_id == store_id).order_by(InventoryItem.name)
            )
        ).all()
        return list(rows)

    async def get_item(self, *, store_id: str, item_id: str) -> InventoryItem:
        item = await self.session.get(InventoryItem, item_id)
        if item is None:
            raise errors.DomainError(status_code=404, error_code="NOT_FOUND", message="재료를 찾을 수 없습니다.")
        if item.store_id != store_id:
            raise errors.forbidden()
        return item

    async def create_item(
        self, *, store_id: str, name: str, unit: str, current_quantity: Decimal,
        low_stock_threshold: Decimal, lead_time_days: int | None, safety_stock: Decimal | None,
    ) -> InventoryItem:
        await self._assert_unique_name(store_id=store_id, name=name)
        item = InventoryItem(
            store_id=store_id, name=name, unit=unit, current_quantity=current_quantity,
            low_stock_threshold=low_stock_threshold, lead_time_days=lead_time_days,
            safety_stock=safety_stock,
        )
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def update_item(self, *, store_id: str, item_id: str, patch: dict) -> InventoryItem:
        item = await self.get_item(store_id=store_id, item_id=item_id)
        new_name = patch.get("name")
        if new_name is not None and new_name != item.name:
            await self._assert_unique_name(store_id=store_id, name=new_name)
        for k, v in patch.items():
            if v is not None:
                setattr(item, k, v)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def delete_item(self, *, store_id: str, item_id: str) -> None:
        item = await self.get_item(store_id=store_id, item_id=item_id)
        used = await self.session.scalar(
            select(RecipeIngredient.id).where(RecipeIngredient.item_id == item_id).limit(1)
        )
        if used is not None:
            raise errors.DomainError(
                status_code=409, error_code="INVENTORY_ITEM_IN_USE",
                message="레시피에서 사용 중인 재료는 삭제할 수 없습니다.",
            )
        await self.session.delete(item)
        await self.session.commit()

    async def get_reorder_suggestions(self, *, store_id: str) -> list[tuple[InventoryItem, Decimal]]:
        items = await self.list_items(store_id=store_id)
        out: list[tuple[InventoryItem, Decimal]] = []
        for item in items:
            target = item.safety_stock if item.safety_stock is not None else item.low_stock_threshold
            if item.current_quantity <= item.low_stock_threshold:
                suggested = max(Decimal(0), target - item.current_quantity)
                out.append((item, suggested))
        return out

    async def _assert_unique_name(self, *, store_id: str, name: str) -> None:
        exists = await self.session.scalar(
            select(InventoryItem.item_id).where(
                InventoryItem.store_id == store_id, InventoryItem.name == name
            )
        )
        if exists is not None:
            raise errors.DomainError(
                status_code=409, error_code="INVENTORY_DUPLICATE_NAME",
                message="이미 등록된 재료명입니다.",
            )
