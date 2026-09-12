"""/api/forecast — AI 서버 연동 수요예측 (07_api_spec.md §7 경로 / §8 AI 계약 프록시)."""
from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUserDep, SessionDep
from app.schemas.forecast import ForecastPredictResponse
from app.services.forecast_service import ForecastService
from app.services.store_service import StoreService

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


async def _store_id(session, user_id: str) -> str:
    return (await StoreService(session).get_store(user_id)).store_id


@router.get("", response_model=ForecastPredictResponse)
async def get_forecast(session: SessionDep, current: CurrentUserDep) -> ForecastPredictResponse:
    store_id = await _store_id(session, current.user_id)
    result = await ForecastService(session).predict(store_id=store_id)
    return ForecastPredictResponse(predictions=result["predictions"])
