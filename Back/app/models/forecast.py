"""예측·파이프라인 ORM — 02_implementation_design.md §4.3.14·§4.3.15·§4.3.21.

n8n 예측 워크플로우가 쓰고(01_basic_design.md §3.11.1), BE는 읽는다.
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CHAR,
    DECIMAL,
    JSON,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, new_uuid


class ForecastResult(Base):
    __tablename__ = "forecast_results"

    forecast_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    store_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("stores.store_id"), nullable=False
    )
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    horizon_days: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    predicted_sales: Mapped[int] = mapped_column(Integer, nullable=False)
    interval_p10: Mapped[int] = mapped_column(Integer, nullable=False)
    interval_p90: Mapped[int] = mapped_column(Integer, nullable=False)
    is_low_confidence: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    low_confidence_reason: Mapped[str | None] = mapped_column(String(32), nullable=True)
    explanation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )


class ForecastMenuItem(Base):
    __tablename__ = "forecast_menu_items"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    forecast_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("forecast_results.forecast_id", ondelete="CASCADE"), nullable=False
    )
    menu_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("menus.menu_id"), nullable=False)
    expected_quantity: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False)


class PipelineType(str, enum.Enum):
    FORECAST = "FORECAST"
    TRAIN = "TRAIN"


class PipelineStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"


class PipelineTrigger(str, enum.Enum):
    USER = "USER"
    N8N = "N8N"


class PipelineJob(Base):
    __tablename__ = "pipeline_jobs"

    job_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    store_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("stores.store_id"), nullable=False
    )
    type: Mapped[PipelineType] = mapped_column(
        Enum(PipelineType, name="pipeline_type"), nullable=False
    )
    status: Mapped[PipelineStatus] = mapped_column(
        Enum(PipelineStatus, name="pipeline_status"), nullable=False
    )
    triggered_by: Mapped[PipelineTrigger] = mapped_column(
        Enum(PipelineTrigger, name="pipeline_trigger"), nullable=False
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
