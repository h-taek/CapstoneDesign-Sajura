"""알림 API 스키마 — 02_implementation_design.md §3.10."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    from app.models.notification import Notification


class NotificationItem(BaseModel):
    notification_id: str
    type: str
    priority: str
    title: str
    body: str | None
    related_resource_type: str | None
    related_resource_id: str | None
    is_read: bool
    created_at: datetime  # UTC

    @classmethod
    def from_orm_row(cls, n: Notification) -> NotificationItem:
        return cls(
            notification_id=n.notification_id,
            type=n.type.value,
            priority=n.priority.value,
            title=n.title,
            body=n.body,
            related_resource_type=n.related_resource_type,
            related_resource_id=n.related_resource_id,
            is_read=bool(n.is_read),
            created_at=n.created_at.replace(tzinfo=UTC),  # DB는 UTC로 저장한다
        )


class NotificationListResponse(BaseModel):
    items: list[NotificationItem]
    total: int
    page: int
    size: int
    total_pages: int


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=255)
    auth: str = Field(min_length=1, max_length=255)


class SubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=1, max_length=500)
    keys: PushKeys
    user_agent: str | None = Field(default=None, max_length=255)


class SubscribeResponse(BaseModel):
    subscription_id: str


class NotificationSettings(BaseModel):
    """알림 설정 묶음별 켜짐 여부 (01_basic_design.md §3.12)."""

    expiry: bool
    stock_low: bool
    forecast_done: bool
    anomaly: bool


class NotificationSettingsUpdate(BaseModel):
    expiry: bool | None = None
    stock_low: bool | None = None
    forecast_done: bool | None = None
    anomaly: bool | None = None
