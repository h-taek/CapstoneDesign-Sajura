"""PipelineService — n8n 예측 작업 상태·이력과 예측 완료 알림 (02_implementation_design.md §3.9).

pipeline_jobs는 n8n이 쓰고(01_basic_design.md §3.11.1) BE는 읽기만 한다.
"""

from __future__ import annotations

import math
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import errors
from app.models.forecast import PipelineJob, PipelineType
from app.models.notification import NotificationType
from app.models.store import Store
from app.schemas.pipeline import (
    JobSummary,
    PipelineHistoryResponse,
    PipelineJobItem,
    PipelineStatusResponse,
)
from app.services.notification_service import NotificationService


def _utc(dt: datetime | None) -> datetime | None:
    return dt.replace(tzinfo=UTC) if dt is not None else None  # DB는 UTC로 저장한다


class PipelineService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def status(self, *, store_id: str) -> PipelineStatusResponse:
        job = await self.session.scalar(
            select(PipelineJob)
            .where(PipelineJob.store_id == store_id, PipelineJob.type == PipelineType.FORECAST)
            .order_by(PipelineJob.started_at.desc())
            .limit(1)
        )
        summary = (
            JobSummary(
                last_run_at=_utc(job.started_at),
                status=job.status.value,
                error_message=job.error_message,
            )
            if job is not None
            else None
        )
        return PipelineStatusResponse(forecast_job=summary, train_job=None)

    async def history(
        self, *, store_id: str, type: PipelineType | None, page: int, size: int
    ) -> PipelineHistoryResponse:
        conds = [PipelineJob.store_id == store_id]
        if type is not None:
            conds.append(PipelineJob.type == type)
        total = await self.session.scalar(select(func.count(PipelineJob.job_id)).where(*conds))
        rows = (
            await self.session.scalars(
                select(PipelineJob)
                .where(*conds)
                .order_by(PipelineJob.started_at.desc(), PipelineJob.job_id.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
        ).all()
        return PipelineHistoryResponse(
            items=[
                PipelineJobItem(
                    job_id=j.job_id,
                    type=j.type.value,
                    status=j.status.value,
                    triggered_by=j.triggered_by.value,
                    started_at=_utc(j.started_at),
                    finished_at=_utc(j.finished_at),
                    error_message=j.error_message,
                )
                for j in rows
            ],
            total=total,
            page=page,
            size=size,
            total_pages=math.ceil(total / size),
        )

    async def forecast_done(self, *, store_id: str) -> None:
        """n8n이 매장 예측을 저장한 뒤 부른다 — 예측 완료 알림 한 건 (01_basic_design.md §3.12)."""
        if await self.session.get(Store, store_id) is None:
            raise errors.DomainError(
                status_code=404, error_code="NOT_FOUND", message="매장을 찾을 수 없습니다."
            )
        await NotificationService(self.session).create_and_push(
            store_id=store_id,
            type=NotificationType.FORECAST_DONE,
            title="새 수요예측이 나왔어요",
            body="앞으로 3일 예상 매출과 추천 발주를 확인해 보세요.",
            related_resource_type="forecast",
        )
