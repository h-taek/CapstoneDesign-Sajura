"""알림 ORM — 02_implementation_design.md §4.3.23·§4.3.24 (테이블은 0001_init에 존재)."""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import CHAR, Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, new_uuid


class NotificationType(str, enum.Enum):
    STOCK_LOW = "STOCK_LOW"
    EXPIRY_D3 = "EXPIRY_D3"
    EXPIRY_D1 = "EXPIRY_D1"
    EXPIRY_OVER = "EXPIRY_OVER"
    FORECAST_DONE = "FORECAST_DONE"
    ANOMALY_HIGH = "ANOMALY_HIGH"


class NotificationPriority(str, enum.Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    URGENT = "URGENT"


class Notification(Base):
    __tablename__ = "notifications"

    notification_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    store_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("stores.store_id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type"), nullable=False
    )
    priority: Mapped[NotificationPriority] = mapped_column(
        Enum(NotificationPriority, name="notification_priority"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    related_resource_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_resource_id: Mapped[str | None] = mapped_column(CHAR(36), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    subscription_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    endpoint: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(255), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
