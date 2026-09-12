"""판매 API 스키마 — api_spec §6."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CSVUploadResponse(BaseModel):
    imported: int
    skipped: int
    skipped_reasons: list[str] = Field(default_factory=list)
    anomaly_count: int = 0
    auto_created_menus: int = 0


class SalesSummaryResponse(BaseModel):
    """홈 화면 매출 요약 카드용 — 대시보드 조회 API가 별도로 없어 최소 집계만 제공."""

    total_revenue: int
    total_sales_count: int
    this_month_revenue: int
    this_month_sales_count: int
    today_revenue: int
    today_sales_count: int
    last_sale_at: datetime | None


class MonthlyRevenuePoint(BaseModel):
    year_month: str  # "2026-05"
    revenue: int
    sales_count: int


class DailyRevenuePoint(BaseModel):
    date: str  # "2026-07-28"
    revenue: int
    sales_count: int


class WeeklyRevenuePoint(BaseModel):
    week_label: str  # "1주차"
    revenue: int
    sales_count: int


class TopMenuItem(BaseModel):
    menu_name: str
    quantity: int
    revenue: int
