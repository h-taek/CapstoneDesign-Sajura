"""Menu / Recipe DTOs — 02_implementation_design.md §3.4."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.types import JsonDecimal


class MenuCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category: str | None = Field(default=None, max_length=50)
    price: int = Field(ge=0)
    is_active: bool = True
    use_inventory_deduction: bool = False  # 등록 시점엔 레시피가 없어 True면 422


class MenuUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    category: str | None = Field(default=None, max_length=50)
    price: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
    use_inventory_deduction: bool | None = None


class MenuListItem(BaseModel):
    menu_id: str
    name: str
    category: str | None
    price: int
    is_active: bool
    use_inventory_deduction: bool
    has_recipe: bool  # 재료 1개 이상의 레시피 보유
    is_deleted: bool


class MenuResponse(MenuListItem):
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime | None = None


class MenuListResponse(BaseModel):
    items: list[MenuListItem]
    total: int
    page: int
    size: int
    total_pages: int


class BulkMenuItem(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category: str | None = Field(default=None, max_length=50)
    price: int = Field(ge=0)
    is_active: bool = True
    use_inventory_deduction: bool = False


class BulkMenuRequest(BaseModel):
    menus: list[BulkMenuItem]


class BulkMenuResponse(BaseModel):
    created: int
    skipped: int
    skipped_names: list[str]


class IngredientItem(BaseModel):
    item_id: str
    quantity: JsonDecimal
    unit: str = Field(min_length=1, max_length=20)


class IngredientItemWithName(IngredientItem):
    item_name: str


class RecipeResponse(BaseModel):
    menu_id: str
    ingredients: list[IngredientItemWithName]
    updated_at: datetime


class RecipeUpsertRequest(BaseModel):
    ingredients: list[IngredientItem]
