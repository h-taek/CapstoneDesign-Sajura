"""/api/menus — 07_api_spec.md §4."""
from __future__ import annotations

import math
from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUserDep, SessionDep
from app.schemas.menu import (
    BulkMenuRequest,
    BulkMenuResponse,
    IngredientItemWithName,
    MenuCreateRequest,
    MenuListItem,
    MenuListResponse,
    MenuResponse,
    MenuUpdateRequest,
    RecipeResponse,
    RecipeUpsertRequest,
)
from app.services.menu_service import MenuService
from app.services.store_service import StoreService

router = APIRouter(prefix="/api/menus", tags=["menu"])


async def _store_id(session, user_id: str) -> str:
    return (await StoreService(session).get_store(user_id)).store_id


def _menu_to_dto(m) -> MenuResponse:
    return MenuResponse(
        menu_id=m.menu_id, name=m.name, category=m.category, price=m.price,
        is_active=bool(m.is_active), use_inventory_deduction=bool(m.use_inventory_deduction),
        is_deleted=bool(m.is_deleted), deleted_at=m.deleted_at,
        created_at=m.created_at, updated_at=m.updated_at,
    )


@router.get("", response_model=MenuListResponse)
async def list_menus(
    session: SessionDep, current: CurrentUserDep,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
    category: str | None = None,
) -> MenuListResponse:
    store_id = await _store_id(session, current.user_id)
    rows, total = await MenuService(session).list_menus(
        store_id=store_id, page=page, size=size, category=category
    )
    return MenuListResponse(
        items=[
            MenuListItem(
                menu_id=m.menu_id, name=m.name, category=m.category, price=m.price,
                is_active=bool(m.is_active),
                use_inventory_deduction=bool(m.use_inventory_deduction),
                is_deleted=bool(m.is_deleted),
            ) for m in rows
        ],
        total=total, page=page, size=size,
        total_pages=max(1, math.ceil(total / size)) if total else 0,
    )


@router.post("", response_model=MenuResponse, status_code=status.HTTP_201_CREATED)
async def create_menu(
    payload: MenuCreateRequest, session: SessionDep, current: CurrentUserDep
) -> MenuResponse:
    store_id = await _store_id(session, current.user_id)
    menu = await MenuService(session).create_menu(
        store_id=store_id, name=payload.name, category=payload.category,
        price=payload.price, is_active=payload.is_active,
        use_inventory_deduction=payload.use_inventory_deduction,
    )
    return _menu_to_dto(menu)


@router.post("/bulk", response_model=BulkMenuResponse, status_code=status.HTTP_201_CREATED)
async def create_menus_bulk(
    payload: BulkMenuRequest, session: SessionDep, current: CurrentUserDep
) -> BulkMenuResponse:
    store_id = await _store_id(session, current.user_id)
    created, skipped = await MenuService(session).create_menus_bulk(
        store_id=store_id, items=[m.model_dump() for m in payload.menus]
    )
    return BulkMenuResponse(created=created, skipped=len(skipped), skipped_names=skipped)


@router.get("/{menu_id}", response_model=MenuResponse)
async def get_menu(menu_id: str, session: SessionDep, current: CurrentUserDep) -> MenuResponse:
    store_id = await _store_id(session, current.user_id)
    return _menu_to_dto(await MenuService(session).get_menu(store_id=store_id, menu_id=menu_id))


@router.patch("/{menu_id}", response_model=MenuResponse)
async def update_menu(
    menu_id: str, payload: MenuUpdateRequest, session: SessionDep, current: CurrentUserDep
) -> MenuResponse:
    store_id = await _store_id(session, current.user_id)
    menu = await MenuService(session).update_menu(
        store_id=store_id, menu_id=menu_id,
        patch=payload.model_dump(exclude_unset=True),
    )
    return _menu_to_dto(menu)


@router.delete("/{menu_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, response_model=None)
async def delete_menu(menu_id: str, session: SessionDep, current: CurrentUserDep) -> None:
    store_id = await _store_id(session, current.user_id)
    await MenuService(session).delete_menu(store_id=store_id, menu_id=menu_id)


@router.get("/{menu_id}/recipe", response_model=RecipeResponse)
async def get_recipe(
    menu_id: str, session: SessionDep, current: CurrentUserDep
) -> RecipeResponse:
    store_id = await _store_id(session, current.user_id)
    svc = MenuService(session)
    recipe = await svc.get_recipe(store_id=store_id, menu_id=menu_id)
    items = await svc.list_ingredients_with_name(recipe.recipe_id)
    return RecipeResponse(
        menu_id=menu_id,
        ingredients=[
            IngredientItemWithName(item_id=i, item_name=n, quantity=q, unit=u)
            for i, n, q, u in items
        ],
        updated_at=recipe.updated_at,
    )


@router.put("/{menu_id}/recipe", response_model=RecipeResponse)
async def upsert_recipe(
    menu_id: str, payload: RecipeUpsertRequest,
    session: SessionDep, current: CurrentUserDep,
) -> RecipeResponse:
    store_id = await _store_id(session, current.user_id)
    await MenuService(session).upsert_recipe(
        store_id=store_id, menu_id=menu_id,
        ingredients=[(i.item_id, i.quantity, i.unit) for i in payload.ingredients],
    )
    return await get_recipe(menu_id, session, current)


@router.delete("/{menu_id}/recipe", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, response_model=None)
async def delete_recipe(menu_id: str, session: SessionDep, current: CurrentUserDep) -> None:
    store_id = await _store_id(session, current.user_id)
    await MenuService(session).delete_recipe(store_id=store_id, menu_id=menu_id)
