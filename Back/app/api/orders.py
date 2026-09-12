"""/api/orders — 발주추천 승인(확정) 기록."""
from __future__ import annotations

from fastapi import APIRouter, status

from app.api.deps import CurrentUserDep, SessionDep
from app.models.purchase_order import PurchaseOrder
from app.schemas.orders import (
    OrderConfirmRequest,
    OrderItemResponse,
    PurchaseOrderListResponse,
    PurchaseOrderResponse,
)
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
