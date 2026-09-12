"""수요예측 라우터 — 07_api_spec.md §8 (M7.A2: predict 구현).

- POST /ai/forecast/predict [MVP]  : V1-t stateless 학습·예측 (app/model/predictor.py)
- POST /ai/forecast/train  [2단계] : 주간 재학습 트리거 — pipeline_jobs 연동은 M7.A5
- GET  /ai/forecast/status [MVP]   : 작업 상태 조회 — M7.A5
"""
from __future__ import annotations

import pandas as pd
from fastapi import APIRouter, HTTPException

from app.model.predictor import MIN_OPEN_DAYS, SalesForecaster
from app.schemas import (
    JobStatusResponse,
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
    preds = [Prediction(**forecaster.predict_one(d)) for d in sorted(body.target_dates)]
    return PredictResponse(store_id=body.store_id, predictions=preds)


@router.post("/train", response_model=TrainResponse)
async def train(body: TrainRequest) -> TrainResponse:
    raise HTTPException(status_code=501, detail="M7.A5에서 구현 — [2단계] 주간 재학습 트리거")


@router.get("/status", response_model=JobStatusResponse)
async def status(job_id: str) -> JobStatusResponse:
    raise HTTPException(status_code=501, detail="M7.A5에서 구현 — pipeline_jobs 상태 조회")
