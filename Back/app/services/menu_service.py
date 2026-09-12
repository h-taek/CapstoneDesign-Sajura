"""MenuService — docs/plan/01_be.md 서비스별 주요 메서드 (M3.B7)."""
from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import errors
from app.models.inventory_item import InventoryItem
from app.models.menu import Menu, Recipe, RecipeIngredient


class MenuService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_menus(
        self, *, store_id: str, page: int, size: int, category: str | None
    ) -> tuple[list[Menu], int]:
        where = [Menu.store_id == store_id, Menu.is_deleted.is_(False)]
        if category:
            where.append(Menu.category == category)
        total = await self.session.scalar(select(func.count()).select_from(Menu).where(*where)) or 0
        rows = (
            await self.session.scalars(
                select(Menu).where(*where).order_by(Menu.name).limit(size).offset((page - 1) * size)
            )
        ).all()
        return list(rows), int(total)

    async def get_menu(self, *, store_id: str, menu_id: str) -> Menu:
        menu = await self.session.get(Menu, menu_id)
        if menu is None or menu.is_deleted:
            raise errors.DomainError(status_code=404, error_code="NOT_FOUND", message="메뉴를 찾을 수 없습니다.")
        if menu.store_id != store_id:
            raise errors.forbidden()
        return menu

    async def create_menu(
        self, *, store_id: str, name: str, category: str | None,
        price: int, is_active: bool, use_inventory_deduction: bool,
    ) -> Menu:
        await self._assert_unique_name(store_id=store_id, name=name)
        menu = Menu(
            store_id=store_id, name=name, category=category, price=price,
            is_active=is_active, use_inventory_deduction=use_inventory_deduction,
        )
        self.session.add(menu)
        await self.session.commit()
        await self.session.refresh(menu)
        return menu

    async def create_menus_bulk(
        self, *, store_id: str, items: list[dict]
    ) -> tuple[int, list[str]]:
        existing = set(
            (
                await self.session.scalars(
                    select(Menu.name).where(Menu.store_id == store_id, Menu.is_deleted.is_(False))
                )
            ).all()
        )
        created = 0
        skipped: list[str] = []
        for it in items:
            if it["name"] in existing:
                skipped.append(it["name"])
                continue
            self.session.add(Menu(store_id=store_id, **it))
            existing.add(it["name"])
            created += 1
        await self.session.commit()
        return created, skipped

    async def update_menu(self, *, store_id: str, menu_id: str, patch: dict) -> Menu:
        menu = await self.get_menu(store_id=store_id, menu_id=menu_id)
        new_name = patch.get("name")
        if new_name is not None and new_name != menu.name:
            await self._assert_unique_name(store_id=store_id, name=new_name)
        for k, v in patch.items():
            if v is not None:
                setattr(menu, k, v)
        await self.session.commit()
        await self.session.refresh(menu)
        return menu

    async def delete_menu(self, *, store_id: str, menu_id: str) -> None:
        menu = await self.get_menu(store_id=store_id, menu_id=menu_id)
        menu.is_deleted = True
        menu.deleted_at = datetime.now(UTC).replace(tzinfo=None)
        await self.session.commit()

    async def get_recipe(self, *, store_id: str, menu_id: str) -> Recipe:
        menu = await self.get_menu(store_id=store_id, menu_id=menu_id)
        recipe = await self.session.scalar(select(Recipe).where(Recipe.menu_id == menu.menu_id))
        if recipe is None:
            raise errors.DomainError(status_code=404, error_code="NOT_FOUND", message="레시피가 없습니다.")
        return recipe

    async def upsert_recipe(
        self, *, store_id: str, menu_id: str,
        ingredients: list[tuple[str, Decimal, str]],
    ) -> Recipe:
        menu = await self.get_menu(store_id=store_id, menu_id=menu_id)
        if menu.use_inventory_deduction and not ingredients:
            raise errors.DomainError(
                status_code=422, error_code="MENU_RECIPE_REQUIRED",
                message="재고 차감 사용 메뉴는 레시피가 필요합니다.",
            )
        item_ids = [iid for iid, _, _ in ingredients]
        if item_ids:
            count = await self.session.scalar(
                select(func.count()).select_from(InventoryItem).where(
                    and_(InventoryItem.item_id.in_(item_ids), InventoryItem.store_id == store_id)
                )
            )
            if int(count or 0) != len(set(item_ids)):
                raise errors.DomainError(
                    status_code=400, error_code="VALIDATION_ERROR",
                    message="존재하지 않거나 다른 매장의 재고 품목이 포함되어 있습니다.",
                )
        recipe = await self.session.scalar(select(Recipe).where(Recipe.menu_id == menu_id))
        if recipe is None:
            recipe = Recipe(menu_id=menu_id)
            self.session.add(recipe)
            await self.session.flush()
        else:
            for ing in list(recipe.ingredients):
                await self.session.delete(ing)
            await self.session.flush()
        for item_id, qty, unit in ingredients:
            self.session.add(
                RecipeIngredient(recipe_id=recipe.recipe_id, item_id=item_id, quantity=qty, unit=unit)
            )
        await self.session.commit()
        await self.session.refresh(recipe)
        return recipe

    async def delete_recipe(self, *, store_id: str, menu_id: str) -> None:
        recipe = await self.get_recipe(store_id=store_id, menu_id=menu_id)
        await self.session.delete(recipe)
        await self.session.commit()

    async def list_ingredients_with_name(
        self, recipe_id: str
    ) -> list[tuple[str, str, Decimal, str]]:
        rows = (
            await self.session.execute(
                select(
                    RecipeIngredient.item_id, InventoryItem.name,
                    RecipeIngredient.quantity, RecipeIngredient.unit,
                )
                .join(InventoryItem, InventoryItem.item_id == RecipeIngredient.item_id)
                .where(RecipeIngredient.recipe_id == recipe_id)
            )
        ).all()
        return [(r[0], r[1], r[2], r[3]) for r in rows]

    async def _assert_unique_name(self, *, store_id: str, name: str) -> None:
        exists = await self.session.scalar(
            select(Menu.menu_id).where(
                Menu.store_id == store_id, Menu.name == name, Menu.is_deleted.is_(False)
            )
        )
        if exists is not None:
            raise errors.DomainError(
                status_code=409, error_code="MENU_DUPLICATE_NAME",
                message="이미 등록된 메뉴명입니다.",
            )
