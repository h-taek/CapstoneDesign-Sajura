"""파이프라인 API 스키마 — 02_implementation_design.md §3.9."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class JobSummary(BaseModel):
    last_run_at: datetime  # UTC
    status: str
    error_message: str | None


class PipelineStatusResponse(BaseModel):
    forecast_job: JobSummary | None
    train_job: JobSummary | None  # 재학습은 [2단계] — 항상 null


class PipelineJobItem(BaseModel):
    job_id: str
    type: str
    status: str
    triggered_by: str
    started_at: datetime  # UTC
    finished_at: datetime | None
    error_message: str | None


class PipelineHistoryResponse(BaseModel):
    items: list[PipelineJobItem]
    total: int
    page: int
    size: int
    total_pages: int


class ForecastDoneRequest(BaseModel):
    store_id: str
