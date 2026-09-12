"""/api/orders — 추천발주 조회 + 승인(확정) 기록 (07_api_spec.md §7)."""
from __future__ import annotations

from fastapi import APIRouter, status
from sqlalchemy import select

from app.api.deps import CurrentUserDep, SessionDep
from app.models.inventory_item import InventoryItem
from app.models.menu import Menu
from app.models.purchase_order import PurchaseOrder
from app.schemas.forecast import AIRecommendResponse
from app.schemas.orders import (
    OrderConfirmRequest,
    OrderItemResponse,
    PurchaseOrderListResponse,
    PurchaseOrderResponse,
)
from app.services.forecast_service import ForecastService
from app.services.order_service import OrderService
from app.services.store_service import StoreService

router = APIRouter(prefix="/api/orders", tags=["orders"])


async def _store_id(session, user_id: str) -> str:
    return (await StoreService(session).get_store(user_id)).store_id


def _to_dto(order: PurchaseOrder) -> PurchaseOrderResponse:
    return PurchaseOrderResponse(
        order_id=order.order_id,
        items=[OrderItemResponse(**i) for i in order.items],
        status=order.status,
        created_at=order.created_at,
    )


@router.post("/confirm", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
async def confirm_order(
    payload: OrderConfirmRequest, session: SessionDep, current: CurrentUserDep
) -> PurchaseOrderResponse:
    store_id = await _store_id(session, current.user_id)
    order = await OrderService(session).confirm_order(
        store_id=store_id, items=[(i.item_id, i.quantity) for i in payload.items]
    )
    return _to_dto(order)


@router.get("", response_model=PurchaseOrderListResponse)
async def list_orders(session: SessionDep, current: CurrentUserDep) -> PurchaseOrderListResponse:
    store_id = await _store_id(session, current.user_id)
    orders = await OrderService(session).list_orders(store_id=store_id)
    return PurchaseOrderListResponse(orders=[_to_dto(o) for o in orders])


@router.get("/recommend", response_model=AIRecommendResponse)
async def get_recommendations(
    session: SessionDep, current: CurrentUserDep
) -> AIRecommendResponse:
    store_id = await _store_id(session, current.user_id)
    result = await ForecastService(session).recommend(store_id=store_id)

    menu_names = dict(
        (await session.execute(select(Menu.menu_id, Menu.name).where(Menu.store_id == store_id))).all()
    )
    item_rows = (
        await session.execute(
            select(InventoryItem.item_id, InventoryItem.name, InventoryItem.unit)
            .where(InventoryItem.store_id == store_id)
        )
    ).all()
    item_info = {item_id: (name, unit) for item_id, name, unit in item_rows}

    return AIRecommendResponse(
        target_dates=result["target_dates"],
        is_low_confidence=result["is_low_confidence"],
        low_confidence_reason=result.get("low_confidence_reason"),
        menu_forecast=[
            {
                "menu_id": m["menu_id"],
                "menu_name": menu_names.get(m["menu_id"], "알 수 없음"),
                "expected_quantity": m["expected_quantity"],
            }
            for m in result["menu_forecast"]
        ],
        recommendations=[
            {
                "item_id": r["item_id"],
                "item_name": item_info.get(r["item_id"], ("알 수 없음", ""))[0],
                "unit": item_info.get(r["item_id"], ("", ""))[1],
                "recommended_quantity": r["recommended_quantity"],
                "expected_stockout_date": r.get("expected_stockout_date"),
                "lead_time_days": r["lead_time_days"],
                "safety_stock": r["safety_stock"],
                "config_status": r["config_status"],
                "recommendation_reason": r["recommendation_reason"],
            }
            for r in result["recommendations"]
        ],
    )
