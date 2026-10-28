"""DashboardService — 날짜별 예측 매출과 실제 매출 비교 (02_implementation_design.md §3.9).

예측은 n8n이 대상일마다 덮어써 가장 마지막 예측 하나만 남는다 — 지난 날짜는 보통 하루 전 예측.
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.forecast import ForecastResult
from app.models.sale_record import SaleRecord
from app.schemas.dashboard import ForecastActualPoint, ForecastVsActualResponse
from app.services.forecast_service import ForecastService, _as_date
from app.services.sale_service import _check_range, _period


class DashboardService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def forecast_vs_actual(
        self, *, store_id: str, start_date: date, end_date: date
    ) -> ForecastVsActualResponse:
        _check_range(start_date, end_date)
        d = func.date(SaleRecord.sold_at)
        actual = {
            _as_date(day): int(total)
            for day, total in (
                await self.session.execute(
                    select(d, func.sum(SaleRecord.total_price))
                    .where(SaleRecord.store_id == store_id, *_period(start_date, end_date))
                    .group_by(d)
                )
            ).all()
        }
        forecasts = {
            f.target_date: f
            for f in (
                await self.session.scalars(
                    select(ForecastResult).where(
                        ForecastResult.store_id == store_id,
                        ForecastResult.target_date.between(start_date, end_date),
                    )
                )
            ).all()
        }
        last = await ForecastService(self.session).last_sale_date(store_id=store_id)

        data = []
        for i in range((end_date - start_date).days + 1):
            day = start_date + timedelta(days=i)
            f = forecasts.get(day)
            data.append(ForecastActualPoint(
                date=day,
                actual_sales=actual.get(day, 0) if last is not None and day <= last else None,
                predicted_sales=f.predicted_sales if f else None,
                interval_p10=f.interval_p10 if f else None,
                interval_p90=f.interval_p90 if f else None,
                horizon_days=f.horizon_days if f else None,
            ))
        return ForecastVsActualResponse(start_date=start_date, end_date=end_date, data=data)
