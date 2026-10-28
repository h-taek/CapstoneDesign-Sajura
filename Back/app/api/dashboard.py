"""/api/dashboard — 02_implementation_design.md §3.9."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUserDep, SessionDep, require_business_access
from app.schemas.dashboard import ForecastVsActualResponse
from app.services.dashboard_service import DashboardService
from app.services.store_service import StoreService

router = APIRouter(
    prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(require_business_access)]
)


@router.get("/forecast-vs-actual", response_model=ForecastVsActualResponse)
async def get_forecast_vs_actual(
    session: SessionDep, current: CurrentUserDep, start_date: date, end_date: date
) -> ForecastVsActualResponse:
    """대시보드 '수요예측 vs 실제 판매량' 그래프 — 날짜별 예측 매출과 실제 매출."""
    store_id = (await StoreService(session).get_store(current.user_id)).store_id
    return await DashboardService(session).forecast_vs_actual(
        store_id=store_id, start_date=start_date, end_date=end_date
    )
