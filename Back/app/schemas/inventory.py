"""재고 DTOs — 02_implementation_design.md §3.5."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.models.inventory_item import AdjustmentReason

AlertStatus = Literal["NORMAL", "LOW", "EXPIRED_SOON", "EMPTY", "NEEDS_CHECK"]


class InventoryItemCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=20)
    quantity: Decimal = Field(ge=0)
    expiry_date: date | None = None
    purchase_price: int | None = Field(default=None, ge=0)
    low_stock_threshold: Decimal = Field(default=Decimal(0), ge=0)
    lead_time_days: int | None = Field(default=None, ge=0)
    safety_stock: Decimal | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _price_with_quantity(self) -> InventoryItemCreateRequest:
        if self.quantity > 0 and self.purchase_price is None:
            raise ValueError("수량이 있으면 구매 금액을 입력해야 합니다.")
        return self


class InventoryItemUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    low_stock_threshold: Decimal | None = Field(default=None, ge=0)
    lead_time_days: int | None = Field(default=None, ge=0)
    safety_stock: Decimal | None = Field(default=None, ge=0)


class InventoryItemResponse(BaseModel):
    item_id: str
    name: str
    unit: str
    total_quantity: Decimal
    alert_status: AlertStatus
    low_stock_threshold: Decimal
    lead_time_days: int | None
    safety_stock: Decimal | None
    # 품목↔쿠팡 상품 매핑 도메인(inventory_item_sites) 완성 전까지 항상 null
    coupang_url: str | None = None
    last_price: int | None = None
    created_at: datetime
    updated_at: datetime


class InventoryListResponse(BaseModel):
    items: list[InventoryItemResponse]


class InventorySummaryResponse(BaseModel):
    total_items: int
    low_stock_count: int
    expired_soon_count: int
    empty_count: int
    needs_check_count: int


class InventoryAlert(BaseModel):
    item_id: str
    name: str
    alert_status: AlertStatus
    alert_message: str
    quantity: Decimal
    expiry_date: date | None


class InventoryAlertListResponse(BaseModel):
    items: list[InventoryAlert]
    total: int


class LotCreateRequest(BaseModel):
    quantity: Decimal = Field(gt=0)
    received_at: date
    expiry_date: date | None = None
    purchase_price: int = Field(ge=0)


class LotResponse(BaseModel):
    lot_id: str
    item_id: str
    quantity: Decimal
    remaining_quantity: Decimal
    received_at: date
    expiry_date: date | None
    purchase_price: int


class LotListResponse(BaseModel):
    item_id: str
    item_name: str
    lots: list[LotResponse]


class LotUpdateRequest(BaseModel):
    """변경할 필드만 보낸다. expiry_date를 null로 보내면 소비기한을 지운다."""

    remaining_quantity: Decimal | None = Field(default=None, ge=0)
    expiry_date: date | None = None
    reason: AdjustmentReason
    memo: str | None = Field(default=None, max_length=255)


class AdjustmentResponse(BaseModel):
    adjustment_id: str
    lot_id: str
    item_id: str
    before_quantity: Decimal
    after_quantity: Decimal
    delta_quantity: Decimal
    before_expiry_date: date | None
    after_expiry_date: date | None
    reason: AdjustmentReason
    memo: str | None
    adjusted_at: datetime


class DisposeRequest(BaseModel):
    lot_id: str
    quantity: Decimal = Field(gt=0)
    reason: str | None = Field(default=None, max_length=255)


class DisposeResponse(BaseModel):
    disposed_quantity: Decimal
    remaining_quantity: Decimal
    disposed_at: datetime
