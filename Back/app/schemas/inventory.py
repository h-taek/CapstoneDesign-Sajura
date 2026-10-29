"""재고 DTOs — 02_implementation_design.md §3.5."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.models.inventory_item import AdjustmentReason
from app.schemas.types import JsonDecimal


class InventoryItemCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=20)
    quantity: JsonDecimal = Field(ge=0)
    expiry_date: date | None = None
    purchase_price: int | None = Field(default=None, ge=0)
    low_stock_threshold: JsonDecimal = Field(default=Decimal(0), ge=0)
    lead_time_days: int | None = Field(default=None, ge=0)
    safety_stock: JsonDecimal | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _price_with_quantity(self) -> InventoryItemCreateRequest:
        if self.quantity > 0 and self.purchase_price is None:
            raise ValueError("수량이 있으면 구매 금액을 입력해야 합니다.")
        return self


class InventoryItemUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    unit: str | None = Field(default=None, min_length=1, max_length=20)
    low_stock_threshold: JsonDecimal | None = Field(default=None, ge=0)
    lead_time_days: int | None = Field(default=None, ge=0)
    safety_stock: JsonDecimal | None = Field(default=None, ge=0)


class InventoryCoupangProduct(BaseModel):
    item_id: str  # 쿠팡 itemId
    product_id: str
    product_name: str
    option_name: str | None
    sale_price: int | None  # 판매가(원). 비었으면 null
    content_quantity: JsonDecimal | None  # 상품 1개 용량(g·ml·개). 모르면 null
    content_unit: str | None
    unit_price: JsonDecimal | None  # 공용 단가(용량 단위 1당 원). 대조를 통과하지 못했으면 null
    updated_at: datetime


class InventoryItemResponse(BaseModel):
    item_id: str
    name: str
    unit: str
    total_quantity: JsonDecimal  # 로트 잔여 수량 합계
    nearest_expiry_date: date | None  # 잔여 수량이 남은 로트 중 가장 이른 소비기한
    needs_check: bool
    low_stock_threshold: JsonDecimal
    lead_time_days: int | None
    safety_stock: JsonDecimal | None
    coupang_product: InventoryCoupangProduct | None  # 연결된 공용 쿠팡 상품
    unit_price: JsonDecimal | None  # 재료 단위당 원. 미설정이면 null
    created_at: datetime
    updated_at: datetime


class InventoryListResponse(BaseModel):
    items: list[InventoryItemResponse]


class LotCreateRequest(BaseModel):
    quantity: JsonDecimal = Field(gt=0)
    received_at: date
    expiry_date: date | None = None
    purchase_price: int = Field(ge=0)


class LotResponse(BaseModel):
    lot_id: str
    item_id: str
    quantity: JsonDecimal
    remaining_quantity: JsonDecimal
    received_at: date
    expiry_date: date | None
    purchase_price: int


class PendingOrderItem(BaseModel):
    order_item_id: str
    order_id: str
    approved_at: datetime
    final_quantity: JsonDecimal
    subtotal: int | None  # 확정 시 단가 미설정이면 null


class LotListResponse(BaseModel):
    item_id: str
    item_name: str
    lots: list[LotResponse]
    pending_orders: list[PendingOrderItem]  # 이 재료의 입고 대기 발주 품목, 확정일 오름차순


class LotUpdateRequest(BaseModel):
    """변경할 필드만 보낸다. expiry_date를 null로 보내면 소비기한을 지운다."""

    remaining_quantity: JsonDecimal | None = Field(default=None, ge=0)
    expiry_date: date | None = None
    reason: AdjustmentReason
    memo: str | None = Field(default=None, max_length=255)


class AdjustmentResponse(BaseModel):
    adjustment_id: str
    lot_id: str
    item_id: str
    before_quantity: JsonDecimal
    after_quantity: JsonDecimal
    delta_quantity: JsonDecimal
    before_expiry_date: date | None
    after_expiry_date: date | None
    reason: AdjustmentReason
    memo: str | None
    adjusted_at: datetime


class DisposeRequest(BaseModel):
    lot_id: str
    quantity: JsonDecimal = Field(gt=0)
    reason: str | None = Field(default=None, max_length=255)


class DisposeResponse(BaseModel):
    disposed_quantity: JsonDecimal
    remaining_quantity: JsonDecimal
    disposed_at: datetime
