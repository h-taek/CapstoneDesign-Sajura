"""PosConnection ORM — 08_schema.md §3 (M3.B6 stub)."""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import CHAR, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, new_uuid


class PosStatus(str, enum.Enum):
    CONNECTED = "CONNECTED"
    ERROR = "ERROR"
    CSV_MODE = "CSV_MODE"
    DISCONNECTED = "DISCONNECTED"


class PosConnection(Base):
    __tablename__ = "pos_connections"

    pos_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    store_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("stores.store_id", ondelete="CASCADE"), unique=True, nullable=False
    )
    pos_type: Mapped[str] = mapped_column(String(50), nullable=False)
    api_key: Mapped[str] = mapped_column(String(255), nullable=False)
    store_code: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[PosStatus] = mapped_column(
        Enum(PosStatus, name="pos_status"), nullable=False, default=PosStatus.DISCONNECTED
    )
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
    connected_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
