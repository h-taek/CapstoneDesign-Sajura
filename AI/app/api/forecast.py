"""수요예측 라우터 — 02_implementation_design.md §3.8 (M7.A2: predict 구현).

- POST /ai/forecast/predict [MVP]  : V1-t stateless 학습·예측 (app/model/predictor.py)
  + 모델 ② 메뉴 비중 분해로 대상일별 메뉴 예상 수량 (app/model/decompose.py, 05_ai.md §2)
- POST /ai/forecast/train  [2단계] : 주간 재학습 트리거 — pipeline_jobs 연동은 M7.A5
- GET  /ai/forecast/status [MVP]   : 작업 상태 조회 — M7.A5
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, HTTPException

from app.model.decompose import MIN_MENU_OPEN_DAYS, menu_shares, qty_per_krw
from app.model.predictor import MIN_OPEN_DAYS, SalesForecaster
from app.schemas import (
    JobStatusResponse,
    MenuForecastItem,
    Prediction,
    PredictRequest,
    PredictResponse,
    TrainRequest,
    TrainResponse,
)

router = APIRouter(prefix="/ai/forecast", tags=["forecast"])


@router.post("/predict", response_model=PredictResponse)
async def predict(body: PredictRequest) -> PredictResponse:
    history = pd.DataFrame([r.model_dump() for r in body.sales_history])
    history["date"] = pd.to_datetime(history["date"])
    n_open = int((history["total_amount"] > 0).sum())
    if n_open < MIN_OPEN_DAYS:
        raise HTTPException(
            status_code=422,
            detail=f"영업일 이력 {n_open}일 — 최소 {MIN_OPEN_DAYS}일 필요 (lag·rolling 피처 구성 불가)",
        )
    last_open = history.loc[history["total_amount"] > 0, "date"].max().date()
    if min(body.target_dates) <= last_open:
        raise HTTPException(status_code=422, detail="target_dates는 이력 마지막 영업일 이후여야 합니다")

    weather = (pd.DataFrame([w.model_dump() for w in body.weather])
               if body.weather else pd.DataFrame(columns=["date", "temp_min", "temp_max", "rainfall_mm"]))
    reopen = body.store_config.reopen_date if body.store_config else None

    forecaster = SalesForecaster(history, weather, reopen)
    forecaster.fit()
    raw = [forecaster.predict_one(d) for d in sorted(body.target_dates)]
    split = _menu_split(body, history)
    preds = [Prediction(**p, menu_forecast=split(p["predicted_sales"])) for p in raw]
    return PredictResponse(store_id=body.store_id, predictions=preds)


def _menu_split(body: PredictRequest, history: pd.DataFrame):
    """예측 매출 → 메뉴별 예상 수량 (비중 × 매출 × 수량/매출 계수).

    메뉴 이력이 모자라거나 일계 이력과 날짜가 겹치지 않으면 빈 배열 — 매출 예측은 그대로 낸다.
    """
    menu_hist = pd.DataFrame([m.model_dump() for m in body.menu_sales_history])
    if menu_hist.empty:
        return lambda _sales: []
    menu_hist["date"] = pd.to_datetime(menu_hist["date"])
    if menu_hist.loc[menu_hist["quantity"] > 0, "date"].nunique() < MIN_MENU_OPEN_DAYS:
        return lambda _sales: []
    shares = menu_shares(menu_hist)
    ratio = qty_per_krw(menu_hist, history)
    if ratio <= 0:
        return lambda _sales: []

    def split(sales: int) -> list[MenuForecastItem]:
        qty = (shares * float(sales) * ratio).sort_values(ascending=False)
        return [MenuForecastItem(menu_id=str(m), expected_quantity=round(float(q), 1))
                for m, q in qty.items()]

    return split


@router.post("/train", response_model=TrainResponse)
async def train(body: TrainRequest) -> TrainResponse:
    raise HTTPException(status_code=501, detail="M7.A5에서 구현 — [2단계] 주간 재학습 트리거")


@router.get("/status", response_model=JobStatusResponse)
async def status(job_id: str) -> JobStatusResponse:
    raise HTTPException(status_code=501, detail="M7.A5에서 구현 — pipeline_jobs 상태 조회")
