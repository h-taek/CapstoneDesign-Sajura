"""/api/notifications — 02_implementation_design.md §3.10."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUserDep, SessionDep
from app.core.rate_limit import NOTIFICATION_LIST_LIMIT, NOTIFICATION_SUBSCRIBE_LIMIT
from app.schemas.notifications import (
    NotificationListResponse,
    NotificationSettings,
    NotificationSettingsUpdate,
    SubscribeRequest,
    SubscribeResponse,
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse, dependencies=[NOTIFICATION_LIST_LIMIT])
async def list_notifications(
    session: SessionDep,
    current: CurrentUserDep,
    is_read: bool | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> NotificationListResponse:
    return await NotificationService(session).list_notifications(
        user_id=current.user_id, is_read=is_read, page=page, size=size
    )


@router.patch(
    "/read-all",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
async def read_all(session: SessionDep, current: CurrentUserDep) -> Response:
    await NotificationService(session).mark_all_read(user_id=current.user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/settings", response_model=NotificationSettings)
async def get_settings(session: SessionDep, current: CurrentUserDep) -> NotificationSettings:
    return await NotificationService(session).get_settings(user_id=current.user_id)


@router.patch("/settings", response_model=NotificationSettings)
async def update_settings(
    payload: NotificationSettingsUpdate, session: SessionDep, current: CurrentUserDep
) -> NotificationSettings:
    return await NotificationService(session).update_settings(
        user_id=current.user_id, payload=payload
    )


@router.patch(
    "/{notification_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
async def read_one(notification_id: str, session: SessionDep, current: CurrentUserDep) -> Response:
    await NotificationService(session).mark_read(
        user_id=current.user_id, notification_id=notification_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/subscribe",
    response_model=SubscribeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[NOTIFICATION_SUBSCRIBE_LIMIT],
)
async def subscribe(
    payload: SubscribeRequest, session: SessionDep, current: CurrentUserDep
) -> SubscribeResponse:
    subscription_id = await NotificationService(session).subscribe(
        user_id=current.user_id,
        endpoint=payload.endpoint,
        p256dh=payload.keys.p256dh,
        auth=payload.keys.auth,
        user_agent=payload.user_agent,
    )
    return SubscribeResponse(subscription_id=subscription_id)


@router.delete(
    "/subscribe/{subscription_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
async def unsubscribe(
    subscription_id: str, session: SessionDep, current: CurrentUserDep
) -> Response:
    await NotificationService(session).unsubscribe(
        user_id=current.user_id, subscription_id=subscription_id
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
