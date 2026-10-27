"""AI Server 요청/응답 스키마 — 02_implementation_design.md §3.8 정합 (M7.A1).

필드명·구조는 `docs/spec/02_implementation_design.md` §3.8을 그대로 따른다(contract-first).
[조사 중] 표기 입력(search_trend_data·event_data)은 Optional.
예측 구간(P10/P90)·예측 근거(top_factors·sentence) 필드는 M6.A7·고도화 확정분 —
spec §8 갱신(docs PR)과 함께 M7.A2에서 응답에 추가한다.
"""
from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, Field


# ── 공통 ──────────────────────────────────────────────────────
class SalesRecord(BaseModel):
    """메뉴-일 판매 레코드 — train[2단계] 계약용."""

    date: dt.date
    menu_id: str
    quantity: int


# ── POST /ai/forecast/predict — 계약 v2 (38차 AI 범위 재확정 반영) ──
# 타깃 = 매장 일 매출(05_ai.md §3), 다일 D+1~3(§3 고도화)·P10/P90 구간·예측 근거(§9)·
# 신뢰도(01_basic_design.md §3.6.3) 포함. 공휴일·학사일정은 AI Server 내장 지식이라 payload에 없음.
class DailySales(BaseModel):
    date: dt.date
    total_amount: int = Field(ge=0)
    order_count: int = Field(ge=0)


class WeatherDay(BaseModel):
    """과거 관측 + 대상일 예보 — sales_history 기간과 target_dates를 커버해야 한다."""

    date: dt.date
    temp_min: float
    temp_max: float
    rainfall_mm: float = 0.0


class StoreConfig(BaseModel):
    reopen_date: dt.date | None = None  # 리뉴얼 재개장일 — regime 피처 기준(EDA §2.6)


class MenuDailySales(BaseModel):
    date: dt.date
    menu_id: str
    quantity: int = Field(ge=0)


class PredictRequest(BaseModel):
    store_id: str
    target_dates: list[dt.date] = Field(min_length=1, max_length=3)  # D+1~D+3
    sales_history: list[DailySales] = Field(min_length=1)  # 일계 이력(무매출일 생략 가능)
    weather: list[WeatherDay] = Field(default_factory=list)
    store_config: StoreConfig | None = None
    # 모델 ② 비중 분해용 메뉴×일 이력(판매일만) — 없으면 menu_forecast는 빈 배열
    menu_sales_history: list[MenuDailySales] = Field(default_factory=list)


class TopFactor(BaseModel):
    feature: str
    label: str
    pct: float  # 평소 대비 기여(exp(φ)−1)


class Explanation(BaseModel):
    baseline: str  # "직전 7영업일 평균"
    deviation_vs_baseline: float
    top_factors: list[TopFactor]
    sentence: str


class MenuForecastItem(BaseModel):
    menu_id: str
    expected_quantity: float  # 대상일 예상 수량 (참고치)


class Prediction(BaseModel):
    target_date: dt.date
    horizon_days: int
    predicted_sales: int
    interval_p10: int
    interval_p90: int
    is_low_confidence: bool
    low_confidence_reason: str | None = None  # 01_basic_design.md §3.6.3 코드 6종
    explanation: Explanation
    menu_forecast: list[MenuForecastItem] = Field(default_factory=list)  # 모델 ②, 내림차순


class PredictResponse(BaseModel):
    store_id: str
    predictions: list[Prediction]


# ── POST /ai/forecast/train · GET /ai/forecast/status ───────
class TrainRequest(BaseModel):
    store_id: str
    training_data: list[SalesRecord]


class TrainResponse(BaseModel):
    job_id: str
    status: str  # QUEUED
    started_at: dt.datetime


class JobStatusResponse(BaseModel):
    job_id: str
    type: str  # TRAIN | PREDICT
    status: str  # QUEUED | RUNNING | DONE | FAILED
    started_at: dt.datetime
    finished_at: dt.datetime | None = None
    error_message: str | None = None


# ── GET /ai/health ───────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str  # ok | degraded
    model_loaded: bool
    last_trained_at: dt.datetime | None = None
    # M7.A6 확장(additive): serving_stack·academic_calendar·holidays 컴포넌트별 상태
    components: dict[str, dict[str, object]] = Field(default_factory=dict)
