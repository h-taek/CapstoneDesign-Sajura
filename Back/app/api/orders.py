"""/api/orders — 추천발주 + 쿠팡 담기(발주 확정)·발주 내역 (02_implementation_design.md §3.7)."""

from __future__ import annotations

import math

from fastapi import APIRouter, Depends, Query, Response, status

from app.api.deps import CurrentUserDep, SessionDep, require_business_access
from app.api.inventory import lot_dto
from app.models.coupang import CoupangProduct
from app.schemas.forecast import AIRecommendResponse
from app.schemas.inventory import LotCreateRequest, LotResponse
from app.schemas.orders import (
    ApprovalLogItem,
    ApprovalLogResponse,
    AutomateFinishRequest,
    AutomateFinishResponse,
    AutomateStartRequest,
    AutomateStartResponse,
    AutomateStepAction,
    AutomateStepDone,
    AutomateStepRequest,
    OrderCoupangProduct,
    OrderDetailItem,
    OrderDetailResponse,
    OrderListResponse,
    OrderSummary,
)
from app.services.automation_service import AutomationService
from app.services.order_service import OrderService
from app.services.store_service import StoreService

router = APIRouter(
    prefix="/api/orders", tags=["orders"], dependencies=[Depends(require_business_access)]
)


async def _store_id(session, user_id: str) -> str:
    return (await StoreService(session).get_store(user_id)).store_id


@router.get("/recommend", response_model=AIRecommendResponse)
async def get_recommendations(session: SessionDep, current: CurrentUserDep) -> AIRecommendResponse:
    store_id = await _store_id(session, current.user_id)
    return AIRecommendResponse(**await OrderService(session).recommend(store_id=store_id))


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
        items=[
            OrderSummary(
                order_id=o.order_id,
                approved_at=o.approved_at,
                total_estimated_cost=o.total_estimated_cost,
                item_count=count,
            )
            for o, count in rows
        ],
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
    products = await service.linked_products(item_ids=[i.item_id for i, _, _ in items])
    return OrderDetailResponse(
        order_id=order.order_id,
        approved_at=order.approved_at,
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
                coupang_product=_coupang_product(products.get(i.item_id)),
            )
            for i, name, unit in items
        ],
    )


def _coupang_product(product: CoupangProduct | None) -> OrderCoupangProduct | None:
    if product is None:
        return None
    return OrderCoupangProduct(
        item_id=product.item_id,
        product_id=product.product_id,
        product_name=product.product_name,
        option_name=product.option_name,
        rocket_fresh=product.rocket_fresh,
    )


@router.post("/automate/start", response_model=AutomateStartResponse)
async def automate_start(
    payload: AutomateStartRequest, session: SessionDep, current: CurrentUserDep
) -> AutomateStartResponse:
    """[쿠팡 담기] — 담기를 시작한다. 발주는 아직 저장하지 않는다."""
    store_id = await _store_id(session, current.user_id)
    return await AutomationService(session).start(
        store_id=store_id,
        recommendation_id=payload.recommendation_id,
        items=payload.items,
        note=payload.note,
        logged_in=payload.coupang_logged_in,
    )


@router.post(
    "/automate/{run_id}/step", response_model=AutomateStepAction | AutomateStepDone
)
async def automate_step(
    run_id: str, payload: AutomateStepRequest, session: SessionDep, current: CurrentUserDep
) -> AutomateStepAction | AutomateStepDone:
    """담기 에이전트 한 걸음 (03_be.md §2.4)."""
    store_id = await _store_id(session, current.user_id)
    return await AutomationService(session).step(store_id=store_id, run_id=run_id, req=payload)


@router.post("/automate/{run_id}/finish", response_model=AutomateFinishResponse)
async def automate_finish(
    run_id: str, payload: AutomateFinishRequest, session: SessionDep, current: CurrentUserDep
) -> AutomateFinishResponse:
    """쿠팡 담기 마침 — 담긴 품목으로 발주를 확정한다."""
    store_id = await _store_id(session, current.user_id)
    return await AutomationService(session).finish(
        store_id=store_id, run_id=run_id, non_wow_prices=payload.non_wow_prices
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
