"""판매 API 스키마 — 02_implementation_design.md §3.6."""
from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class NeedsCheckItem(BaseModel):
    item_id: str
    name: str


class InventoryDeduction(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)  # 응답엔 항상 포함
    deducted_sales: int = 0
    needs_check_items: list[NeedsCheckItem] = Field(default_factory=list)


class CSVUploadResponse(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)  # 응답엔 항상 포함
    imported: int
    skipped: int
    skipped_reasons: list[str] = Field(default_factory=list)
    anomaly_count: int = 0
    auto_created_menus: int = 0
    inventory_deduction: InventoryDeduction = Field(default_factory=InventoryDeduction)


class SalesSummaryResponse(BaseModel):
    """홈 화면 매출 요약 카드용 — 대시보드 조회 API가 별도로 없어 최소 집계만 제공."""

    total_revenue: int
    total_sales_count: int
    this_month_revenue: int
    this_month_sales_count: int
    today_revenue: int
    today_sales_count: int
    last_sale_at: datetime | None


class SaleListItem(BaseModel):
    sale_id: str
    menu_id: str
    menu_name: str
    quantity: int
    total_price: int
    sold_at: datetime  # 매장 현지 시각, 시간대 표기 없음


class SalesListResponse(BaseModel):
    items: list[SaleListItem]
    total: int  # 조건에 맞는 판매 기록 수
    total_revenue: int  # 조건에 맞는 매출 합계
    page: int
    size: int
    total_pages: int


SortOrder = Literal["asc", "desc"]
TrendGroupBy = Literal["day", "week", "month"]


class TrendPoint(BaseModel):
    date: date  # 구간 시작일 (month는 그 달 1일)
    quantity: int
    revenue: int


class SalesTrendsResponse(BaseModel):
    menu_id: str | None  # null = 매장 전체 합계
    menu_name: str | None
    group_by: TrendGroupBy
    data: list[TrendPoint]


class TopMenuItem(BaseModel):
    menu_name: str
    quantity: int
    revenue: int
