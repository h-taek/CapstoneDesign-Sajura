"""발주 확정·내역 DTOs — 07_api_spec.md §7."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class OrderApproveItem(BaseModel):
    item_id: str
    final_quantity: Decimal = Field(gt=0, max_digits=10, decimal_places=3)
    unit_price: int = Field(default=0, ge=0)


class OrderApproveRequest(BaseModel):
    recommendation_id: str | None = None
    items: list[OrderApproveItem] = Field(min_length=1)
    note: str | None = Field(default=None, max_length=500)

    @field_validator("items")
    @classmethod
    def _unique_items(cls, v: list[OrderApproveItem]) -> list[OrderApproveItem]:
        if len({i.item_id for i in v}) != len(v):
            raise ValueError("같은 재료가 중복되었습니다.")
        return v


class OrderApproveResponse(BaseModel):
    order_id: str
    approved_at: datetime
    total_estimated_cost: int
    status: str


class OrderSummary(OrderApproveResponse):
    item_count: int


class OrderListResponse(BaseModel):
    items: list[OrderSummary]
    total: int
    page: int
    size: int
    total_pages: int


class OrderDetailItem(BaseModel):
    item_id: str
    item_name: str
    final_quantity: float
    unit: str
    unit_price: int
    subtotal: int


class OrderDetailResponse(BaseModel):
    order_id: str
    approved_at: datetime
    status: str
    total_estimated_cost: int
    note: str | None
    items: list[OrderDetailItem]


class ApprovalLogItem(BaseModel):
    item_id: str
    item_name: str
    recommended_quantity: float
    adjusted_quantity: float
    final_quantity: float
    unit: str
    was_modified: bool


class ApprovalLogResponse(BaseModel):
    order_id: str
    items: list[ApprovalLogItem]
