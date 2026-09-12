"""AI 수요예측·발주추천 DTOs — api_spec.md §8 계약을 BE 응답 형태로 재노출."""
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


class DailyPrediction(BaseModel):
    target_date: date
    horizon_days: int
    predicted_sales: int
    interval_p10: int
    interval_p90: int
    is_low_confidence: bool
    low_confidence_reason: str | None = None
    explanation: Explanation


class ForecastPredictResponse(BaseModel):
    predictions: list[DailyPrediction]


class MenuForecastItem(BaseModel):
    menu_id: str
    menu_name: str
    expected_quantity: float


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


class AIRecommendResponse(BaseModel):
    target_dates: list[date]
    is_low_confidence: bool
    low_confidence_reason: str | None = None
    menu_forecast: list[MenuForecastItem]
    recommendations: list[OrderRecommendation]
