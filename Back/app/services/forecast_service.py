"""ForecastService — n8n이 저장한 수요예측 조회와 수동 실행 (01_basic_design.md §3.6.2).

BE는 AI Server를 호출하지 않는다. 예측은 n8n 예측 워크플로우가 만들어 forecast_results·
forecast_menu_items에 저장한다(§3.11.1). 수동 실행은 그 워크플로우를 매장 하나로 실행시킨다.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import httpx
import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import errors
from app.integrations import n8n
from app.models.forecast import (
    ForecastMenuItem,
    ForecastResult,
    PipelineJob,
    PipelineStatus,
    PipelineType,
)
from app.models.menu import Menu
from app.models.sale_record import SaleRecord

log = structlog.get_logger(__name__)

# 이보다 오래된 RUNNING 작업은 멈춘 것으로 보고 새 실행을 막지 않는다
STALE_RUNNING = timedelta(minutes=10)


def _as_date(v: object) -> date:
    return v if isinstance(v, date) else date.fromisoformat(str(v))


def forecast_not_found() -> errors.DomainError:
    return errors.DomainError(
        status_code=404, error_code="FORECAST_NOT_FOUND",
        message="저장된 예측이 없습니다. 예측을 실행해 주세요.",
    )


class ForecastService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def last_sale_date(self, *, store_id: str) -> date | None:
        last = await self.session.scalar(
            select(func.max(func.date(SaleRecord.sold_at))).where(SaleRecord.store_id == store_id)
        )
        return _as_date(last) if last is not None else None

    async def stored(self, *, store_id: str, target_date: date | None = None) -> list[dict]:
        """판매 이력 마지막 날 기준 D+1~D+3의 저장된 예측(대상일 오름차순). 메뉴 이름을 붙인다."""
        last = await self.last_sale_date(store_id=store_id)
        if last is None:
            return []
        targets = [last + timedelta(days=i) for i in (1, 2, 3)]
        if target_date is not None:
            targets = [d for d in targets if d == target_date]
        rows = (
            await self.session.scalars(
                select(ForecastResult)
                .where(ForecastResult.store_id == store_id, ForecastResult.target_date.in_(targets))
                .order_by(ForecastResult.target_date)
            )
        ).all()
        if not rows:
            return []
        menu_rows = (
            await self.session.execute(
                select(
                    ForecastMenuItem.forecast_id, ForecastMenuItem.menu_id, Menu.name,
                    ForecastMenuItem.expected_quantity,
                )
                .join(Menu, Menu.menu_id == ForecastMenuItem.menu_id)
                .where(ForecastMenuItem.forecast_id.in_([f.forecast_id for f in rows]))
                .order_by(ForecastMenuItem.expected_quantity.desc())
            )
        ).all()
        menus: dict[str, list[dict]] = {f.forecast_id: [] for f in rows}
        for forecast_id, menu_id, name, qty in menu_rows:
            menus[forecast_id].append(
                {"menu_id": menu_id, "menu_name": name, "expected_quantity": float(qty)}
            )
        return [
            {
                "target_date": f.target_date,
                "horizon_days": f.horizon_days,
                "predicted_sales": f.predicted_sales,
                "interval_p10": f.interval_p10,
                "interval_p90": f.interval_p90,
                "is_low_confidence": bool(f.is_low_confidence),
                "low_confidence_reason": f.low_confidence_reason,
                "explanation": f.explanation,
                "menu_forecast": menus[f.forecast_id],
            }
            for f in rows
        ]

    async def get_forecast(self, *, store_id: str, target_date: date | None = None) -> list[dict]:
        predictions = await self.stored(store_id=store_id, target_date=target_date)
        if not predictions:
            raise forecast_not_found()
        return predictions

    async def run(self, *, store_id: str) -> list[dict]:
        """그 매장 예측 워크플로우를 n8n 웹훅으로 실행하고 끝나면 저장된 예측을 반환한다."""
        since = datetime.now(UTC).replace(tzinfo=None) - STALE_RUNNING
        running = await self.session.scalar(
            select(func.count(PipelineJob.job_id)).where(
                PipelineJob.store_id == store_id,
                PipelineJob.type == PipelineType.FORECAST,
                PipelineJob.status == PipelineStatus.RUNNING,
                PipelineJob.started_at >= since,
            )
        )
        if running:
            raise errors.DomainError(
                status_code=429, error_code="PIPELINE_ALREADY_RUNNING",
                message="이 매장의 예측이 이미 실행 중입니다. 잠시 후 다시 확인해 주세요.",
            )
        try:
            outcome = await n8n.run_forecast(store_id)
        except httpx.HTTPError as exc:
            log.warning("forecast_webhook_failed", store_id=store_id, error=str(exc))
            raise _pipeline_unavailable() from exc
        if outcome.get("status") != "DONE":
            if outcome.get("insufficient_history"):
                raise errors.DomainError(
                    status_code=422, error_code="AI_INSUFFICIENT_HISTORY",
                    message="판매 이력이 부족해 예측할 수 없습니다(영업일 10일 이상 필요).",
                )
            log.warning("forecast_run_failed", store_id=store_id, error=outcome.get("error"))
            raise _pipeline_unavailable()
        await self.session.rollback()  # n8n이 다른 연결로 쓴 행을 새로 읽는다
        return await self.get_forecast(store_id=store_id)


def _pipeline_unavailable() -> errors.DomainError:
    return errors.DomainError(
        status_code=503, error_code="PIPELINE_AI_SERVER_UNAVAILABLE",
        message="예측을 실행하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    )
