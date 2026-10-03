"""OrderService — 추천발주 저장 + 발주 확정·내역 (07_api_spec.md §7, 09_service_design.md §5).

추천안은 AI Server 결과를 조회 시점에 산출·저장한다. n8n 사전 생성(Phase 8)이 붙으면
당일 저장분을 그대로 돌려주는 경로가 앞에 선다.
"""

from __future__ import annotations

from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import errors
from app.models.inventory_item import InventoryItem
from app.models.menu import Menu
from app.models.order import (
    ConfigStatus,
    Order,
    OrderApprovalLog,
    OrderItem,
    OrderRecommendation,
    OrderRecommendationItem,
    OrderStatus,
)
from app.schemas.orders import OrderApproveItem
from app.services.forecast_service import ForecastService

KST = ZoneInfo("Asia/Seoul")
ZERO = Decimal(0)


def _dec(value: float) -> Decimal:
    return Decimal(str(round(float(value), 3)))


def _not_found(message: str) -> errors.DomainError:
    return errors.DomainError(status_code=404, error_code="NOT_FOUND", message=message)


class OrderService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def recommend(self, *, store_id: str) -> dict:
        result = await ForecastService(self.session).recommend(store_id=store_id)

        inventory = {
            i.item_id: i
            for i in (
                await self.session.scalars(
                    select(InventoryItem).where(InventoryItem.store_id == store_id)
                )
            ).all()
        }
        menu_names = dict(
            (
                await self.session.execute(
                    select(Menu.menu_id, Menu.name).where(Menu.store_id == store_id)
                )
            ).all()
        )

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

        recommendations = []
        for r in result["recommendations"]:
            inv = inventory.get(r["item_id"])
            if inv is None:  # AI 호출 사이에 삭제된 재료
                continue
            config_status = (
                ConfigStatus.USER_CONFIGURED
                if inv.lead_time_days is not None and inv.safety_stock is not None
                else ConfigStatus.DEFAULT_USED
            )
            quantity = _dec(r["recommended_quantity"])
            self.session.add(
                OrderRecommendationItem(
                    recommendation_id=rec.recommendation_id,
                    item_id=inv.item_id,
                    recommended_quantity=quantity,
                    adjusted_quantity=quantity,
                    lead_time_days=r["lead_time_days"],
                    safety_stock=_dec(r["safety_stock"]),
                    config_status=config_status,
                )
            )
            recommendations.append(
                {
                    "item_id": inv.item_id,
                    "item_name": inv.name,
                    "unit": inv.unit,
                    "recommended_quantity": r["recommended_quantity"],
                    "expected_stockout_date": r.get("expected_stockout_date"),
                    "lead_time_days": r["lead_time_days"],
                    "safety_stock": r["safety_stock"],
                    "config_status": config_status.value,
                    "recommendation_reason": r["recommendation_reason"],
                }
            )
        await self.session.commit()

        return {
            "recommendation_id": rec.recommendation_id,
            "target_dates": result["target_dates"],
            "is_low_confidence": result["is_low_confidence"],
            "low_confidence_reason": result.get("low_confidence_reason"),
            "menu_forecast": [
                {
                    "menu_id": m["menu_id"],
                    "menu_name": menu_names.get(m["menu_id"], "알 수 없음"),
                    "expected_quantity": m["expected_quantity"],
                }
                for m in result["menu_forecast"]
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

        subtotals = {
            i.item_id: int(
                (i.final_quantity * i.unit_price).quantize(Decimal(1), rounding=ROUND_HALF_UP)
            )
            for i in items
        }
        order = Order(
            store_id=store_id,
            recommendation_id=recommendation_id,
            status=OrderStatus.APPROVED,
            total_estimated_cost=sum(subtotals.values()),
            note=note,
        )
        self.session.add(order)
        await self.session.flush()

        for i in items:
            self.session.add(
                OrderItem(
                    order_id=order.order_id,
                    item_id=i.item_id,
                    final_quantity=i.final_quantity,
                    unit_price=i.unit_price,
                    subtotal=subtotals[i.item_id],
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
                        adjusted_quantity=ri.adjusted_quantity if ri else ZERO,
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
