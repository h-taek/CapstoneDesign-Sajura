"""알림 — 01_basic_design.md §3.12, 02_implementation_design.md §3.10."""
from __future__ import annotations

import json
from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from pywebpush import WebPushException
from sqlalchemy import select, update

import app.db as app_db
import app.services.notification_service as notification_module
from app.config import get_settings
from app.models.notification import Notification, NotificationType, PushSubscription
from app.models.store import Store
from app.models.user import User
from app.services.notification_service import NotificationService
from tests.sales_test import _register_verified_user


async def _store_id(email: str) -> str:
    async with app_db.SessionLocal() as session:
        return await session.scalar(
            select(Store.store_id).join(User, User.user_id == Store.user_id).where(
                User.email == email
            )
        )


async def _notify(store_id: str, type_: NotificationType, title: str = "알림") -> str | None:
    async with app_db.SessionLocal() as session:
        n = await NotificationService(session).create_and_push(
            store_id=store_id,
            type=type_,
            title=title,
            body=f"{title} 본문",
            related_resource_type="inventory_item",
            related_resource_id="00000000-0000-0000-0000-000000000001",
        )
        return n.notification_id if n else None


async def _set_created_at(notification_id: str, at: datetime) -> None:
    async with app_db.SessionLocal() as session:
        await session.execute(
            update(Notification)
            .where(Notification.notification_id == notification_id)
            .values(created_at=at)
        )
        await session.commit()


def _sub_body(endpoint: str) -> dict:
    return {"endpoint": endpoint, "keys": {"p256dh": "p-key", "auth": "a-key"}, "user_agent": "UA"}


@pytest.fixture
def push_calls(monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    """pywebpush 호출을 기록으로 대체한다. endpoint에 'gone'이 있으면 410으로 실패시킨다."""
    calls: list[dict] = []

    class _Gone:
        status_code = 410

    def fake_webpush(subscription_info: dict, data: str, **kwargs: object) -> None:
        calls.append({"endpoint": subscription_info["endpoint"], "data": json.loads(data)})
        if "gone" in subscription_info["endpoint"]:
            raise WebPushException("gone", response=_Gone())

    monkeypatch.setattr(notification_module, "webpush", fake_webpush)
    settings = get_settings()
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", "test-public")
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", "test-private")
    return calls


# ----------------------------------------------------------------------
# 목록·읽음
# ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_newest_first_with_unread_filter(client: AsyncClient) -> None:
    email, auth = await _register_verified_user(client)
    store_id = await _store_id(email)
    base = datetime(2026, 10, 1, 9, 0, 0)
    ids = []
    for i, t in enumerate(
        [NotificationType.STOCK_LOW, NotificationType.EXPIRY_D1, NotificationType.ANOMALY_HIGH]
    ):
        nid = await _notify(store_id, t, title=f"알림{i}")
        await _set_created_at(nid, base + timedelta(hours=i))
        ids.append(nid)

    r = await client.patch(f"/api/notifications/{ids[2]}/read", headers=auth)
    assert r.status_code == 204, r.text

    r = await client.get("/api/notifications", headers=auth)
    assert r.status_code == 200, r.text
    body = r.json()
    assert (body["total"], body["page"], body["size"], body["total_pages"]) == (3, 1, 20, 1)
    assert [i["notification_id"] for i in body["items"]] == [ids[2], ids[1], ids[0]]
    first = body["items"][1]
    assert (first["type"], first["priority"], first["title"], first["body"]) == (
        "EXPIRY_D1", "URGENT", "알림1", "알림1 본문",
    )
    assert first["related_resource_type"] == "inventory_item"
    assert first["is_read"] is False
    assert first["created_at"] == "2026-10-01T10:00:00Z"

    r = await client.get("/api/notifications", params={"is_read": "false"}, headers=auth)
    assert [i["notification_id"] for i in r.json()["items"]] == [ids[1], ids[0]]


@pytest.mark.asyncio
async def test_read_other_users_notification_returns_404(client: AsyncClient) -> None:
    email, _ = await _register_verified_user(client)
    nid = await _notify(await _store_id(email), NotificationType.STOCK_LOW)
    _, other_auth = await _register_verified_user(client)

    r = await client.patch(f"/api/notifications/{nid}/read", headers=other_auth)
    assert r.status_code == 404, r.text


@pytest.mark.asyncio
async def test_read_all_marks_only_own(client: AsyncClient) -> None:
    email, auth = await _register_verified_user(client)
    other_email, other_auth = await _register_verified_user(client)
    await _notify(await _store_id(email), NotificationType.STOCK_LOW)
    await _notify(await _store_id(email), NotificationType.EXPIRY_D3)
    await _notify(await _store_id(other_email), NotificationType.STOCK_LOW)

    r = await client.patch("/api/notifications/read-all", headers=auth)
    assert r.status_code == 204, r.text

    r = await client.get("/api/notifications", params={"is_read": "false"}, headers=auth)
    assert r.json()["total"] == 0
    r = await client.get("/api/notifications", params={"is_read": "false"}, headers=other_auth)
    assert r.json()["total"] == 1


@pytest.mark.asyncio
async def test_list_rejects_size_over_100(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    r = await client.get("/api/notifications", params={"size": 101}, headers=auth)
    assert r.status_code == 400, r.text


@pytest.mark.asyncio
async def test_list_rate_limited_per_user(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    for _ in range(60):
        r = await client.get("/api/notifications", headers=auth)
        assert r.status_code == 200, r.text
    r = await client.get("/api/notifications", headers=auth)
    assert r.status_code == 429, r.text

    _, other_auth = await _register_verified_user(client)
    r = await client.get("/api/notifications", headers=other_auth)
    assert r.status_code == 200, r.text


# ----------------------------------------------------------------------
# 구독
# ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_subscribe_same_endpoint_moves_to_current_user(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    other_email, other_auth = await _register_verified_user(client)
    endpoint = "https://push.example.com/send/same-browser"

    r = await client.post("/api/notifications/subscribe", json=_sub_body(endpoint), headers=auth)
    assert r.status_code == 201, r.text
    sub_id = r.json()["subscription_id"]

    r = await client.post(
        "/api/notifications/subscribe", json=_sub_body(endpoint), headers=other_auth
    )
    assert r.status_code == 201, r.text
    assert r.json()["subscription_id"] == sub_id
    async with app_db.SessionLocal() as session:
        sub = await session.get(PushSubscription, sub_id)
        owner = await session.scalar(select(User.email).where(User.user_id == sub.user_id))
    assert owner == other_email

    r = await client.delete(f"/api/notifications/subscribe/{sub_id}", headers=auth)
    assert r.status_code == 404, r.text
    r = await client.delete(f"/api/notifications/subscribe/{sub_id}", headers=other_auth)
    assert r.status_code == 204, r.text
    r = await client.delete(f"/api/notifications/subscribe/{sub_id}", headers=other_auth)
    assert r.status_code == 404, r.text


# ----------------------------------------------------------------------
# 설정
# ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_settings_default_on_and_partial_patch(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    r = await client.get("/api/notifications/settings", headers=auth)
    assert r.status_code == 200, r.text
    assert r.json() == {"expiry": True, "stock_low": True, "forecast_done": True, "anomaly": True}

    r = await client.patch(
        "/api/notifications/settings", json={"stock_low": False}, headers=auth
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"expiry": True, "stock_low": False, "forecast_done": True, "anomaly": True}


@pytest.mark.asyncio
async def test_disabled_group_creates_nothing(client: AsyncClient) -> None:
    email, auth = await _register_verified_user(client)
    store_id = await _store_id(email)
    r = await client.patch("/api/notifications/settings", json={"expiry": False}, headers=auth)
    assert r.status_code == 200, r.text

    for t in (NotificationType.EXPIRY_D3, NotificationType.EXPIRY_D1, NotificationType.EXPIRY_OVER):
        assert await _notify(store_id, t) is None
    assert await _notify(store_id, NotificationType.STOCK_LOW) is not None

    r = await client.get("/api/notifications", headers=auth)
    assert [i["type"] for i in r.json()["items"]] == ["STOCK_LOW"]


# ----------------------------------------------------------------------
# Web Push
# ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_push_to_each_subscription_and_drop_gone(
    client: AsyncClient, push_calls: list[dict]
) -> None:
    email, auth = await _register_verified_user(client)
    alive = f"https://push.example.com/send/alive-{email}"
    gone = f"https://push.example.com/send/gone-{email}"
    for endpoint in (alive, gone):
        r = await client.post(
            "/api/notifications/subscribe", json=_sub_body(endpoint), headers=auth
        )
        assert r.status_code == 201, r.text

    nid = await _notify(await _store_id(email), NotificationType.STOCK_LOW, title="원두 재고 확인")
    assert nid is not None

    assert sorted(c["endpoint"] for c in push_calls) == sorted([alive, gone])
    assert push_calls[0]["data"] == {
        "title": "원두 재고 확인", "body": "원두 재고 확인 본문", "url": "/inventory",
    }
    async with app_db.SessionLocal() as session:
        left = (
            await session.scalars(
                select(PushSubscription.endpoint).where(
                    PushSubscription.endpoint.in_([alive, gone])
                )
            )
        ).all()
    assert left == [alive]


@pytest.mark.asyncio
async def test_push_skipped_without_vapid_keys(
    client: AsyncClient, push_calls: list[dict], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "VAPID_PRIVATE_KEY", "")
    email, auth = await _register_verified_user(client)
    r = await client.post(
        "/api/notifications/subscribe",
        json=_sub_body(f"https://push.example.com/send/novapid-{email}"),
        headers=auth,
    )
    assert r.status_code == 201, r.text

    assert await _notify(await _store_id(email), NotificationType.STOCK_LOW) is not None
    assert push_calls == []
