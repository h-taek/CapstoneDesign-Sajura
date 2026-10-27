"""NotificationService — 점주 알림의 단일 창구 (01_basic_design.md §3.12, 03_be.md §4).

create_and_push가 인앱 알림 저장과 Web Push 발송을 함께 처리한다. 알림 설정에서 끈 묶음은
만들지 않는다. 푸시 실패는 저장된 알림에 영향을 주지 않고, 만료된 구독(404·410)만 지운다.
"""

from __future__ import annotations

import asyncio
import json
import math

import structlog
from pywebpush import WebPushException, webpush
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core import errors
from app.models.notification import (
    Notification,
    NotificationPriority,
    NotificationType,
    PushSubscription,
)
from app.models.store import Store
from app.models.user import User
from app.schemas.notifications import (
    NotificationItem,
    NotificationListResponse,
    NotificationSettings,
    NotificationSettingsUpdate,
)

log = structlog.get_logger(__name__)

PRIORITY = {
    NotificationType.STOCK_LOW: NotificationPriority.WARNING,
    NotificationType.EXPIRY_D3: NotificationPriority.WARNING,
    NotificationType.EXPIRY_D1: NotificationPriority.URGENT,
    NotificationType.EXPIRY_OVER: NotificationPriority.URGENT,
    NotificationType.FORECAST_DONE: NotificationPriority.INFO,
    NotificationType.ANOMALY_HIGH: NotificationPriority.WARNING,
}

# 알림 설정 묶음 → users 칸
SETTING_COLUMN = {
    NotificationType.STOCK_LOW: "notify_stock_low",
    NotificationType.EXPIRY_D3: "notify_expiry",
    NotificationType.EXPIRY_D1: "notify_expiry",
    NotificationType.EXPIRY_OVER: "notify_expiry",
    NotificationType.FORECAST_DONE: "notify_forecast_done",
    NotificationType.ANOMALY_HIGH: "notify_anomaly",
}

# 알림을 눌렀을 때 열 화면 (01_basic_design.md §4.11)
PUSH_URL = {
    NotificationType.STOCK_LOW: "/inventory",
    NotificationType.EXPIRY_D3: "/inventory",
    NotificationType.EXPIRY_D1: "/inventory",
    NotificationType.EXPIRY_OVER: "/inventory",
    NotificationType.FORECAST_DONE: "/orders",
    NotificationType.ANOMALY_HIGH: "/sales",
}

_GONE_STATUS = (404, 410)


class NotificationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_and_push(
        self,
        *,
        store_id: str,
        type: NotificationType,
        title: str,
        body: str | None = None,
        related_resource_type: str | None = None,
        related_resource_id: str | None = None,
    ) -> Notification | None:
        """알림 저장 + Web Push. 설정에서 끈 묶음이면 만들지 않고 None."""
        user = await self.session.scalar(
            select(User).join(Store, Store.user_id == User.user_id).where(
                Store.store_id == store_id
            )
        )
        if user is None or not getattr(user, SETTING_COLUMN[type]):
            return None

        notification = Notification(
            user_id=user.user_id,
            store_id=store_id,
            type=type,
            priority=PRIORITY[type],
            title=title,
            body=body,
            related_resource_type=related_resource_type,
            related_resource_id=related_resource_id,
        )
        self.session.add(notification)
        await self.session.commit()
        await self._push(
            user.user_id, {"title": title, "body": body, "url": PUSH_URL[type]}
        )
        return notification

    async def _push(self, user_id: str, payload: dict) -> None:
        settings = get_settings()
        if not settings.VAPID_PUBLIC_KEY or not settings.VAPID_PRIVATE_KEY:
            return
        subs = (
            await self.session.scalars(
                select(PushSubscription).where(PushSubscription.user_id == user_id)
            )
        ).all()
        gone: list[str] = []
        data = json.dumps(payload, ensure_ascii=False)
        for sub in subs:
            try:
                # pywebpush는 동기 HTTP — 이벤트 루프를 막지 않게 워커 스레드에서 보낸다
                await asyncio.to_thread(
                    webpush,
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    },
                    data=data,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": settings.VAPID_SUBJECT},
                )
            except WebPushException as exc:
                status = getattr(exc.response, "status_code", None)
                if status in _GONE_STATUS:
                    gone.append(sub.subscription_id)
                else:
                    log.warning(
                        "web_push_failed", subscription_id=sub.subscription_id, status=status
                    )
            except Exception:  # 네트워크 오류 등 — 알림 저장은 이미 끝났다
                log.exception("web_push_error", subscription_id=sub.subscription_id)
        if gone:
            await self.session.execute(
                delete(PushSubscription).where(PushSubscription.subscription_id.in_(gone))
            )
            await self.session.commit()

    # ------------------------------------------------------------------ 조회·읽음

    async def list_notifications(
        self, *, user_id: str, is_read: bool | None, page: int, size: int
    ) -> NotificationListResponse:
        conds = [Notification.user_id == user_id]
        if is_read is not None:
            conds.append(Notification.is_read.is_(is_read))
        total = await self.session.scalar(
            select(func.count(Notification.notification_id)).where(*conds)
        )
        rows = (
            await self.session.scalars(
                select(Notification)
                .where(*conds)
                .order_by(Notification.created_at.desc(), Notification.notification_id.desc())
                .offset((page - 1) * size)
                .limit(size)
            )
        ).all()
        return NotificationListResponse(
            items=[NotificationItem.from_orm_row(n) for n in rows],
            total=total,
            page=page,
            size=size,
            total_pages=math.ceil(total / size),
        )

    async def mark_read(self, *, user_id: str, notification_id: str) -> None:
        n = await self.session.get(Notification, notification_id)
        if n is None or n.user_id != user_id:
            raise errors.DomainError(
                status_code=404, error_code="NOT_FOUND", message="알림을 찾을 수 없습니다."
            )
        n.is_read = True
        await self.session.commit()

    async def mark_all_read(self, *, user_id: str) -> None:
        await self.session.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read.is_(False))
            .values(is_read=True)
        )
        await self.session.commit()

    # ------------------------------------------------------------------ 구독

    async def subscribe(
        self, *, user_id: str, endpoint: str, p256dh: str, auth: str, user_agent: str | None
    ) -> str:
        """같은 endpoint(같은 브라우저)가 있으면 현재 사용자·키로 갱신한다."""
        sub = await self.session.scalar(
            select(PushSubscription).where(PushSubscription.endpoint == endpoint)
        )
        if sub is None:
            sub = PushSubscription(endpoint=endpoint)
            self.session.add(sub)
        sub.user_id = user_id
        sub.p256dh = p256dh
        sub.auth = auth
        sub.user_agent = user_agent
        await self.session.commit()
        return sub.subscription_id

    async def unsubscribe(self, *, user_id: str, subscription_id: str) -> None:
        sub = await self.session.get(PushSubscription, subscription_id)
        if sub is None or sub.user_id != user_id:
            raise errors.DomainError(
                status_code=404, error_code="NOT_FOUND", message="구독을 찾을 수 없습니다."
            )
        await self.session.delete(sub)
        await self.session.commit()

    # ------------------------------------------------------------------ 설정

    async def get_settings(self, *, user_id: str) -> NotificationSettings:
        user = await self.session.get(User, user_id)
        if user is None:
            raise errors.unauthorized()
        return _settings_of(user)

    async def update_settings(
        self, *, user_id: str, payload: NotificationSettingsUpdate
    ) -> NotificationSettings:
        user = await self.session.get(User, user_id)
        if user is None:
            raise errors.unauthorized()
        for key, value in payload.model_dump(exclude_unset=True, exclude_none=True).items():
            setattr(user, f"notify_{key}", value)
        await self.session.commit()
        return _settings_of(user)


def _settings_of(user: User) -> NotificationSettings:
    return NotificationSettings(
        expiry=user.notify_expiry,
        stock_low=user.notify_stock_low,
        forecast_done=user.notify_forecast_done,
        anomaly=user.notify_anomaly,
    )
