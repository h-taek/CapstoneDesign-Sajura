"""/api/forecast — 저장된 수요예측 조회·수동 실행 (02_implementation_design.md §3.7)."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUserDep, SessionDep, require_business_access
from app.schemas.forecast import ForecastPredictResponse
from app.services.forecast_service import ForecastService
from app.services.store_service import StoreService

router = APIRouter(
    prefix="/api/forecast", tags=["forecast"], dependencies=[Depends(require_business_access)]
)


async def _store_id(session, user_id: str) -> str:
    return (await StoreService(session).get_store(user_id)).store_id


@router.get("", response_model=ForecastPredictResponse)
async def get_forecast(
    session: SessionDep, current: CurrentUserDep, target_date: date | None = None
) -> ForecastPredictResponse:
    store_id = await _store_id(session, current.user_id)
    predictions = await ForecastService(session).get_forecast(
        store_id=store_id, target_date=target_date
    )
    return ForecastPredictResponse(predictions=predictions)


@router.post("/run", response_model=ForecastPredictResponse)
async def run_forecast(session: SessionDep, current: CurrentUserDep) -> ForecastPredictResponse:
    """저장된 예측이 없을 때 그 매장 예측을 n8n으로 즉시 실행한다 (01_basic_design.md §3.6.2)."""
    store_id = await _store_id(session, current.user_id)
    predictions = await ForecastService(session).run(store_id=store_id)
    return ForecastPredictResponse(predictions=predictions)
