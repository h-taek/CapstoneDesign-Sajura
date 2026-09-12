"""ForecastService — 실제 판매·재고·레시피 데이터를 AI 계약 형태로 집계해 AI 서버 호출.

AI Server는 stateless(사전 학습 모델 불필요)라 매 요청마다 이 서비스가 판매 이력을
모아 보내면 즉석 학습·예측한다 (model_spec §3, api_spec §8).
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import errors
from app.integrations import ai_client
from app.models.inventory_item import InventoryItem
from app.models.menu import Menu, Recipe, RecipeIngredient
from app.models.sale_record import SaleRecord


def _as_date(v: object) -> date:
    return v if isinstance(v, date) else date.fromisoformat(str(v))


class ForecastService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _daily_sales_history(self, *, store_id: str) -> list[dict]:
        d = func.date(SaleRecord.sold_at)
        rows = (
            await self.session.execute(
                select(d, func.sum(SaleRecord.total_price), func.count(SaleRecord.sale_id))
                .where(SaleRecord.store_id == store_id)
                .group_by(d)
                .order_by(d)
            )
        ).all()
        return [
            {"date": _as_date(row[0]).isoformat(), "total_amount": int(row[1]), "order_count": int(row[2])}
            for row in rows
        ]

    async def _menu_sales_history(self, *, store_id: str) -> list[dict]:
        d = func.date(SaleRecord.sold_at)
        rows = (
            await self.session.execute(
                select(d, SaleRecord.menu_id, func.sum(SaleRecord.quantity))
                .where(SaleRecord.store_id == store_id)
                .group_by(d, SaleRecord.menu_id)
                .order_by(d)
            )
        ).all()
        return [
            {"date": _as_date(row[0]).isoformat(), "menu_id": row[1], "quantity": int(row[2])}
            for row in rows
        ]

    async def _target_dates(self, *, store_id: str) -> list[date]:
        last = await self.session.scalar(
            select(func.max(func.date(SaleRecord.sold_at))).where(SaleRecord.store_id == store_id)
        )
        if last is None:
            raise errors.DomainError(
                status_code=422, error_code="AI_INSUFFICIENT_HISTORY",
                message="판매 이력이 없어 예측할 수 없습니다.",
            )
        last = _as_date(last)
        return [last + timedelta(days=i) for i in (1, 2, 3)]

    async def predict(self, *, store_id: str) -> dict:
        history = await self._daily_sales_history(store_id=store_id)
        target_dates = await self._target_dates(store_id=store_id)
        payload = {
            "store_id": store_id,
            "target_dates": [d.isoformat() for d in target_dates],
            "sales_history": history,
        }
        return await ai_client.predict(payload)

    async def recommend(self, *, store_id: str) -> dict:
        history = await self._daily_sales_history(store_id=store_id)
        menu_history = await self._menu_sales_history(store_id=store_id)
        target_dates = await self._target_dates(store_id=store_id)

        recipe_rows = (
            await self.session.execute(
                select(
                    Recipe.menu_id, RecipeIngredient.item_id,
                    RecipeIngredient.quantity, RecipeIngredient.unit,
                )
                .join(RecipeIngredient, RecipeIngredient.recipe_id == Recipe.recipe_id)
                .join(Menu, Menu.menu_id == Recipe.menu_id)
                .where(Menu.store_id == store_id)
            )
        ).all()
        recipes = [
            {"menu_id": menu_id, "item_id": item_id, "quantity_per_menu": float(qty), "unit": unit}
            for menu_id, item_id, qty, unit in recipe_rows
        ]

        inventory_rows = (
            await self.session.scalars(select(InventoryItem).where(InventoryItem.store_id == store_id))
        ).all()
        inventory = [
            {
                "item_id": i.item_id,
                "current_quantity": float(i.current_quantity),
                "unit": i.unit,
                "lead_time_days": i.lead_time_days if i.lead_time_days is not None else 1,
                "safety_stock": (
                    float(i.safety_stock) if i.safety_stock is not None else float(i.low_stock_threshold)
                ),
            }
            for i in inventory_rows
        ]

        payload = {
            "store_id": store_id,
            "target_dates": [d.isoformat() for d in target_dates],
            "sales_history": history,
            "menu_sales_history": menu_history,
            "recipes": recipes,
            "inventory": inventory,
        }
        return await ai_client.recommend(payload)
