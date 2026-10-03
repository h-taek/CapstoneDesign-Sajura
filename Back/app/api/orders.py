"""/api/orders — 추천발주 조회 + 발주 확정·내역 (07_api_spec.md §7)."""

from __future__ import annotations

import math

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUserDep, SessionDep
from app.models.order import Order
from app.schemas.forecast import AIRecommendResponse
from app.schemas.orders import (
    ApprovalLogItem,
    ApprovalLogResponse,
    OrderApproveRequest,
    OrderApproveResponse,
    OrderDetailItem,
    OrderDetailResponse,
    OrderListResponse,
    OrderSummary,
)
from app.services.order_service import OrderService
from app.services.store_service import StoreService

router = APIRouter(prefix="/api/orders", tags=["orders"])


async def _store_id(session, user_id: str) -> str:
    return (await StoreService(session).get_store(user_id)).store_id


def _approve_dto(order: Order) -> OrderApproveResponse:
    return OrderApproveResponse(
        order_id=order.order_id,
        approved_at=order.approved_at,
        total_estimated_cost=order.total_estimated_cost,
        status=order.status.value,
    )


@router.get("/recommend", response_model=AIRecommendResponse)
async def get_recommendations(session: SessionDep, current: CurrentUserDep) -> AIRecommendResponse:
    store_id = await _store_id(session, current.user_id)
    return AIRecommendResponse(**await OrderService(session).recommend(store_id=store_id))


@router.post("/approve", response_model=OrderApproveResponse, status_code=status.HTTP_201_CREATED)
async def approve_order(
    payload: OrderApproveRequest, session: SessionDep, current: CurrentUserDep
) -> OrderApproveResponse:
    store_id = await _store_id(session, current.user_id)
    order = await OrderService(session).approve_order(
        store_id=store_id,
        recommendation_id=payload.recommendation_id,
        items=payload.items,
        note=payload.note,
    )
    return _approve_dto(order)


@router.get("", response_model=OrderListResponse)
async def list_orders(
    session: SessionDep,
    current: CurrentUserDep,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
) -> OrderListResponse:
    store_id = await _store_id(session, current.user_id)
    rows, total = await OrderService(session).list_orders(store_id=store_id, page=page, size=size)
    return OrderListResponse(
        items=[OrderSummary(**_approve_dto(o).model_dump(), item_count=count) for o, count in rows],
        total=total,
        page=page,
        size=size,
        total_pages=math.ceil(total / size),
    )


@router.get("/{order_id}", response_model=OrderDetailResponse)
async def get_order(
    order_id: str, session: SessionDep, current: CurrentUserDep
) -> OrderDetailResponse:
    store_id = await _store_id(session, current.user_id)
    service = OrderService(session)
    order = await service.get_order(store_id=store_id, order_id=order_id)
    items = await service.get_order_items(order_id=order_id)
    return OrderDetailResponse(
        order_id=order.order_id,
        approved_at=order.approved_at,
        status=order.status.value,
        total_estimated_cost=order.total_estimated_cost,
        note=order.note,
        items=[
            OrderDetailItem(
                item_id=i.item_id,
                item_name=name,
                final_quantity=float(i.final_quantity),
                unit=unit,
                unit_price=i.unit_price,
                subtotal=i.subtotal,
            )
            for i, name, unit in items
        ],
    )


@router.get("/{order_id}/approval-log", response_model=ApprovalLogResponse)
async def get_approval_log(
    order_id: str, session: SessionDep, current: CurrentUserDep
) -> ApprovalLogResponse:
    store_id = await _store_id(session, current.user_id)
    service = OrderService(session)
    await service.get_order(store_id=store_id, order_id=order_id)
    logs = await service.get_approval_logs(order_id=order_id)
    return ApprovalLogResponse(
        order_id=order_id,
        items=[
            ApprovalLogItem(
                item_id=log.item_id,
                item_name=name,
                recommended_quantity=float(log.recommended_quantity),
                adjusted_quantity=float(log.adjusted_quantity),
                final_quantity=float(log.final_quantity),
                unit=unit,
                was_modified=log.was_modified,
            )
            for log, name, unit in logs
        ],
    )
