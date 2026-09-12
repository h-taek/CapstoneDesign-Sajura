"""발주 확정 DTOs — 발주추천 화면 승인 플로우."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class OrderConfirmItem(BaseModel):
    item_id: str
    quantity: Decimal = Field(gt=0)


class OrderConfirmRequest(BaseModel):
    items: list[OrderConfirmItem] = Field(min_length=1)


class OrderItemResponse(BaseModel):
    item_id: str
    name: str
    unit: str
    quantity: Decimal


class PurchaseOrderResponse(BaseModel):
    order_id: str
    items: list[OrderItemResponse]
    status: str
    created_at: datetime


class PurchaseOrderListResponse(BaseModel):
    orders: list[PurchaseOrderResponse]
