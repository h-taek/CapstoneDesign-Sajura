"""/api/inventory — 재고 품목·로트·폐기. 경고 판정·정렬은 FE 몫(03_be.md §2).

02_implementation_design.md §3.5.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.api.deps import CurrentUserDep, SessionDep, require_business_access
from app.models.inventory_item import InventoryLot
from app.schemas.inventory import (
    AdjustmentResponse,
    DisposeRequest,
    DisposeResponse,
    InventoryItemCreateRequest,
    InventoryItemResponse,
    InventoryItemUpdateRequest,
    InventoryListResponse,
    LotCreateRequest,
    LotListResponse,
    LotResponse,
    LotUpdateRequest,
    PendingOrderItem,
)
from app.services.inventory_service import InventoryService, ItemStock
from app.services.order_service import OrderService
from app.services.store_service import StoreService

router = APIRouter(
    prefix="/api/inventory", tags=["inventory"], dependencies=[Depends(require_business_access)]
)


async def _store_id(session, user_id: str) -> str:
    return (await StoreService(session).get_store(user_id)).store_id


def _to_dto(stock: ItemStock) -> InventoryItemResponse:
    item = stock.item
    return InventoryItemResponse(
        item_id=item.item_id,
        name=item.name,
        unit=item.unit,
        total_quantity=stock.total_quantity,
        nearest_expiry_date=stock.nearest_expiry,
        needs_check=bool(item.needs_check),
        low_stock_threshold=item.low_stock_threshold,
        lead_time_days=item.lead_time_days,
        safety_stock=item.safety_stock,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def lot_dto(lot: InventoryLot) -> LotResponse:
    return LotResponse(
        lot_id=lot.lot_id,
        item_id=lot.item_id,
        quantity=lot.quantity,
        remaining_quantity=lot.remaining_quantity,
        received_at=lot.received_at,
        expiry_date=lot.expiry_date,
        purchase_price=lot.purchase_price,
    )


@router.get("", response_model=InventoryListResponse)
async def list_inventory(session: SessionDep, current: CurrentUserDep) -> InventoryListResponse:
    store_id = await _store_id(session, current.user_id)
    stocks = await InventoryService(session).list_stocks(store_id=store_id)
    return InventoryListResponse(items=[_to_dto(s) for s in stocks])


@router.post("", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    payload: InventoryItemCreateRequest, session: SessionDep, current: CurrentUserDep
) -> InventoryItemResponse:
    store_id = await _store_id(session, current.user_id)
    stock = await InventoryService(session).create_item(store_id=store_id, **payload.model_dump())
    return _to_dto(stock)


@router.get("/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(
    item_id: str, session: SessionDep, current: CurrentUserDep
) -> InventoryItemResponse:
    store_id = await _store_id(session, current.user_id)
    return _to_dto(await InventoryService(session).get_stock(store_id=store_id, item_id=item_id))


@router.patch("/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: str, payload: InventoryItemUpdateRequest, session: SessionDep, current: CurrentUserDep
) -> InventoryItemResponse:
    store_id = await _store_id(session, current.user_id)
    stock = await InventoryService(session).update_item(
        store_id=store_id, item_id=item_id, patch=payload.model_dump(exclude_unset=True)
    )
    return _to_dto(stock)


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
async def delete_inventory_item(item_id: str, session: SessionDep, current: CurrentUserDep) -> None:
    store_id = await _store_id(session, current.user_id)
    await InventoryService(session).delete_item(store_id=store_id, item_id=item_id)


@router.post("/{item_id}/lots", response_model=LotResponse, status_code=status.HTTP_201_CREATED)
async def add_lot(
    item_id: str, payload: LotCreateRequest, session: SessionDep, current: CurrentUserDep
) -> LotResponse:
    store_id = await _store_id(session, current.user_id)
    lot = await InventoryService(session).add_lot(
        store_id=store_id, item_id=item_id, **payload.model_dump()
    )
    return lot_dto(lot)


@router.get("/{item_id}/lots", response_model=LotListResponse)
async def list_lots(item_id: str, session: SessionDep, current: CurrentUserDep) -> LotListResponse:
    store_id = await _store_id(session, current.user_id)
    item, lots = await InventoryService(session).get_lots(store_id=store_id, item_id=item_id)
    pending = await OrderService(session).pending_items(item_id=item.item_id)
    return LotListResponse(
        item_id=item.item_id,
        item_name=item.name,
        lots=[lot_dto(lot) for lot in lots],
        pending_orders=[
            PendingOrderItem(
                order_item_id=oi.id,
                order_id=order.order_id,
                approved_at=order.approved_at,
                final_quantity=oi.final_quantity,
                subtotal=oi.subtotal,
            )
            for oi, order in pending
        ],
    )


@router.patch("/{item_id}/lots/{lot_id}", response_model=AdjustmentResponse)
async def update_lot(
    item_id: str,
    lot_id: str,
    payload: LotUpdateRequest,
    session: SessionDep,
    current: CurrentUserDep,
) -> AdjustmentResponse:
    store_id = await _store_id(session, current.user_id)
    changes = payload.model_dump(include={"remaining_quantity", "expiry_date"}, exclude_unset=True)
    log = await InventoryService(session).update_lot(
        store_id=store_id,
        item_id=item_id,
        lot_id=lot_id,
        user_id=current.user_id,
        changes=changes,
        reason=payload.reason,
        memo=payload.memo,
    )
    return AdjustmentResponse(
        adjustment_id=log.adjustment_id,
        lot_id=log.lot_id,
        item_id=log.item_id,
        before_quantity=log.before_quantity,
        after_quantity=log.after_quantity,
        delta_quantity=log.delta_quantity,
        before_expiry_date=log.before_expiry_date,
        after_expiry_date=log.after_expiry_date,
        reason=log.reason,
        memo=log.memo,
        adjusted_at=log.adjusted_at,
    )


@router.post("/{item_id}/dispose", response_model=DisposeResponse)
async def dispose(
    item_id: str, payload: DisposeRequest, session: SessionDep, current: CurrentUserDep
) -> DisposeResponse:
    store_id = await _store_id(session, current.user_id)
    log, remaining = await InventoryService(session).dispose(
        store_id=store_id,
        item_id=item_id,
        lot_id=payload.lot_id,
        quantity=payload.quantity,
        reason=payload.reason,
        user_id=current.user_id,
    )
    return DisposeResponse(
        disposed_quantity=log.quantity, remaining_quantity=remaining, disposed_at=log.disposed_at
    )
