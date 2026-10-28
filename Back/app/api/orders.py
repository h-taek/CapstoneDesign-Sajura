"""/api/orders — 추천발주 조회 + 발주 확정·내역 (02_implementation_design.md §3.7)."""

from __future__ import annotations

import math

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import CurrentUserDep, SessionDep, require_business_access
from app.api.inventory import lot_dto
from app.models.coupang import CoupangProduct
from app.models.order import Order
from app.schemas.forecast import AIRecommendResponse
from app.schemas.inventory import LotCreateRequest, LotResponse
from app.schemas.orders import (
    ApprovalLogItem,
    ApprovalLogResponse,
    AutomationResultRequest,
    AutomationResultResponse,
    MatchRequest,
    MatchResponse,
    OrderApproveRequest,
    OrderApproveResponse,
    OrderCoupangProduct,
    OrderDetailItem,
    OrderDetailResponse,
    OrderListResponse,
    OrderSummary,
)
from app.services.automation_service import AutomationService, search_required, utcnow
from app.services.order_service import OrderService
from app.services.store_service import StoreService

router = APIRouter(
    prefix="/api/orders", tags=["orders"], dependencies=[Depends(require_business_access)]
)


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
    lines = await AutomationService(session).lines(order_id=order_id)
    now = utcnow()
    return OrderDetailResponse(
        order_id=order.order_id,
        approved_at=order.approved_at,
        status=order.status.value,
        total_estimated_cost=order.total_estimated_cost,
        note=order.note,
        items=[
            OrderDetailItem(
                order_item_id=i.id,
                item_id=i.item_id,
                item_name=name,
                final_quantity=float(i.final_quantity),
                unit=unit,
                unit_price=float(i.unit_price) if i.unit_price is not None else None,
                subtotal=i.subtotal,
                receipt_status=i.receipt_status.value,
                coupang_search_required=search_required(
                    lines[i.item_id].item, lines[i.item_id].product, now
                ),
                coupang_product=_coupang_product(lines[i.item_id].product),
            )
            for i, name, unit in items
        ],
    )


def _coupang_product(product: CoupangProduct | None) -> OrderCoupangProduct | None:
    if product is None:
        return None
    return OrderCoupangProduct(
        product_id=product.product_id,
        vendor_item_id=product.vendor_item_id,
        product_name=product.product_name,
        rocket_fresh=product.rocket_fresh,
    )


@router.post("/{order_id}/automate/match", response_model=MatchResponse)
async def automate_match(
    order_id: str, payload: MatchRequest, session: SessionDep, current: CurrentUserDep
) -> MatchResponse:
    """확장이 수집한 검색 결과로 담을 상품을 고른다 (03_be.md §2.4)."""
    store_id = await _store_id(session, current.user_id)
    return await AutomationService(session).match(
        store_id=store_id, order_id=order_id, req=payload
    )


@router.post("/{order_id}/automate/result", response_model=AutomationResultResponse)
async def automate_result(
    order_id: str, payload: AutomationResultRequest, session: SessionDep, current: CurrentUserDep
) -> AutomationResultResponse:
    """확장의 담기 결과 — 공용 쿠팡 상품·재료 연결·발주 상태를 갱신한다."""
    store_id = await _store_id(session, current.user_id)
    order, guide = await AutomationService(session).record_result(
        store_id=store_id, order_id=order_id, req=payload
    )
    return AutomationResultResponse(
        order_id=order.order_id,
        status=order.status.value,
        automated_at=order.automated_at,
        manual_guide_url=guide,
    )


@router.post(
    "/items/{order_item_id}/receive",
    response_model=LotResponse,
    status_code=status.HTTP_201_CREATED,
)
async def receive_order_item(
    order_item_id: str, payload: LotCreateRequest, session: SessionDep, current: CurrentUserDep
) -> LotResponse:
    store_id = await _store_id(session, current.user_id)
    lot = await OrderService(session).receive_item(
        store_id=store_id, order_item_id=order_item_id, **payload.model_dump()
    )
    return lot_dto(lot)


@router.post(
    "/items/{order_item_id}/skip",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
async def skip_order_item(order_item_id: str, session: SessionDep, current: CurrentUserDep) -> None:
    store_id = await _store_id(session, current.user_id)
    await OrderService(session).skip_item(store_id=store_id, order_item_id=order_item_id)


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
                final_quantity=float(log.final_quantity),
                unit=unit,
                was_modified=log.was_modified,
            )
            for log, name, unit in logs
        ],
    )
