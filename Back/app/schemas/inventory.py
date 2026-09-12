"""재고 품목 DTOs — 재고관리·발주추천 화면.

lots/FIFO 기반 입출고 이력(schema.md §3.9~11)은 후속 마일스톤. 그 전까지
current_quantity 단일 수치로 관리하는 간소화 버전.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class InventoryItemCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=20)
    current_quantity: Decimal = Field(default=Decimal(0), ge=0)
    low_stock_threshold: Decimal = Field(default=Decimal(0), ge=0)
    lead_time_days: int | None = Field(default=None, ge=0)
    safety_stock: Decimal | None = Field(default=None, ge=0)


class InventoryItemUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    current_quantity: Decimal | None = Field(default=None, ge=0)
    low_stock_threshold: Decimal | None = Field(default=None, ge=0)
    lead_time_days: int | None = Field(default=None, ge=0)
    safety_stock: Decimal | None = Field(default=None, ge=0)


class InventoryItemResponse(BaseModel):
    item_id: str
    name: str
    unit: str
    current_quantity: Decimal
    low_stock_threshold: Decimal
    lead_time_days: int | None
    safety_stock: Decimal | None
    is_low_stock: bool
    updated_at: datetime


class InventoryListResponse(BaseModel):
    items: list[InventoryItemResponse]


class ReorderSuggestion(BaseModel):
    item_id: str
    name: str
    unit: str
    current_quantity: Decimal
    low_stock_threshold: Decimal
    safety_stock: Decimal | None
    suggested_order_quantity: Decimal
