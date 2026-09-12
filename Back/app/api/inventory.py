"""/api/inventory — 재고 품목 CRUD + 임계값 기반 발주추천."""
from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.api.deps import CurrentUserDep, SessionDep
from app.models.inventory_item import InventoryItem
from app.schemas.inventory import (
    InventoryItemCreateRequest,
    InventoryItemResponse,
    InventoryItemUpdateRequest,
    InventoryListResponse,
    ReorderSuggestion,
)
from app.services.inventory_service import InventoryService
from app.services.store_service import StoreService

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


async def _store_id(session, user_id: str) -> str:
    return (await StoreService(session).get_store(user_id)).store_id


def _to_dto(item: InventoryItem) -> InventoryItemResponse:
    return InventoryItemResponse(
        item_id=item.item_id, name=item.name, unit=item.unit,
        current_quantity=item.current_quantity, low_stock_threshold=item.low_stock_threshold,
        lead_time_days=item.lead_time_days, safety_stock=item.safety_stock,
        is_low_stock=item.current_quantity <= item.low_stock_threshold,
        updated_at=item.updated_at,
    )


@router.get("", response_model=InventoryListResponse)
async def list_inventory(session: SessionDep, current: CurrentUserDep) -> InventoryListResponse:
    store_id = await _store_id(session, current.user_id)
    items = await InventoryService(session).list_items(store_id=store_id)
    return InventoryListResponse(items=[_to_dto(i) for i in items])


@router.post("", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    payload: InventoryItemCreateRequest, session: SessionDep, current: CurrentUserDep
) -> InventoryItemResponse:
    store_id = await _store_id(session, current.user_id)
    item = await InventoryService(session).create_item(store_id=store_id, **payload.model_dump())
    return _to_dto(item)


@router.patch("/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: str, payload: InventoryItemUpdateRequest, session: SessionDep, current: CurrentUserDep
) -> InventoryItemResponse:
    store_id = await _store_id(session, current.user_id)
    item = await InventoryService(session).update_item(
        store_id=store_id, item_id=item_id, patch=payload.model_dump(exclude_unset=True)
    )
    return _to_dto(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, response_model=None)
async def delete_inventory_item(item_id: str, session: SessionDep, current: CurrentUserDep) -> None:
    store_id = await _store_id(session, current.user_id)
    await InventoryService(session).delete_item(store_id=store_id, item_id=item_id)


@router.get("/reorder-suggestions", response_model=list[ReorderSuggestion])
async def get_reorder_suggestions(session: SessionDep, current: CurrentUserDep) -> list[ReorderSuggestion]:
    """임계값(low_stock_threshold) 이하로 떨어진 재료 + 안전재고까지 채울 제안 수량.
    AI 수요예측 기반 추천(리드타임 중 예상 소비 반영)은 별도 후속 작업."""
    store_id = await _store_id(session, current.user_id)
    rows = await InventoryService(session).get_reorder_suggestions(store_id=store_id)
    return [
        ReorderSuggestion(
            item_id=item.item_id, name=item.name, unit=item.unit,
            current_quantity=item.current_quantity, low_stock_threshold=item.low_stock_threshold,
            safety_stock=item.safety_stock, suggested_order_quantity=suggested,
        )
        for item, suggested in rows
    ]
