"""대시보드 API 스키마 — 02_implementation_design.md §3.9."""
from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class ForecastActualPoint(BaseModel):
    date: date
    actual_sales: int | None  # 매장 마지막 판매일 이후는 null
    predicted_sales: int | None  # 저장된 예측이 없으면 예측 칸 모두 null
    interval_p10: int | None
    interval_p90: int | None
    horizon_days: int | None


class ForecastVsActualResponse(BaseModel):
    start_date: date
    end_date: date
    data: list[ForecastActualPoint]
