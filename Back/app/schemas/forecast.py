"""수요예측·추천발주 응답 — 02_implementation_design.md §3.7 (예측은 n8n 저장분, 추천은 BE 계산)."""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class TopFactor(BaseModel):
    feature: str
    label: str
    pct: float


class Explanation(BaseModel):
    baseline: str
    deviation_vs_baseline: float
    top_factors: list[TopFactor]
    sentence: str


class MenuForecastItem(BaseModel):
    menu_id: str
    menu_name: str
    expected_quantity: float


class DailyPrediction(BaseModel):
    target_date: date
    horizon_days: int
    predicted_sales: int
    interval_p10: int
    interval_p90: int
    is_low_confidence: bool
    low_confidence_reason: str | None = None
    explanation: Explanation
    menu_forecast: list[MenuForecastItem]  # 대상일 메뉴별 예상 수량, 내림차순


class ForecastPredictResponse(BaseModel):
    predictions: list[DailyPrediction]


class OrderRecommendation(BaseModel):
    item_id: str
    item_name: str
    unit: str
    recommended_quantity: float
    expected_stockout_date: date | None
    lead_time_days: int
    safety_stock: float
    config_status: str
    recommendation_reason: str
    unit_price: float | None  # 재료 단위당 원 (01_basic_design.md §3.3.1). 미설정이면 null


class AIRecommendResponse(BaseModel):
    recommendation_id: str
    target_dates: list[date]
    is_low_confidence: bool
    low_confidence_reason: str | None = None
    menu_forecast: list[MenuForecastItem]
    recommendations: list[OrderRecommendation]
