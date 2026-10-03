"""사업자 검증 게이트 BE 강제 — 04_feature_spec.md §1.4, 12_security.md §5.1."""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import update

import app.db as app_db
from app.config import get_settings
from app.models.store import BusinessStatus, Store
from tests.conftest import make_test_email

GUARDED = [
    ("GET", "/api/menus"),
    ("GET", "/api/inventory"),
    ("GET", "/api/sales/summary"),
    ("GET", "/api/orders"),
    ("GET", "/api/forecast"),
    ("GET", "/api/store/pos/status"),
    ("GET", "/api/prices/ingredients"),
    ("PATCH", "/api/store"),
    ("POST", "/api/store/onboarding/complete"),
]


async def _register(client: AsyncClient) -> tuple[dict, str]:
    email = make_test_email("guard")
    r = await client.post(
        "/api/auth/register", json={"email": email, "password": "Passw0rd!", "name": "가드"}
    )
    assert r.status_code == 201, r.text
    r = await client.post("/api/auth/login", json={"email": email, "password": "Passw0rd!"})
    auth = {"Authorization": f"Bearer {r.json()['access_token']}"}
    store_id = (await client.get("/api/store", headers=auth)).json()["store_id"]
    return auth, store_id


async def _set_status(store_id: str, status: BusinessStatus) -> None:
    async with app_db.SessionLocal() as session:
        await session.execute(
            update(Store).where(Store.store_id == store_id).values(business_status=status)
        )
        await session.commit()


@pytest.mark.asyncio
async def test_unverified_blocked_from_store_data(client: AsyncClient) -> None:
    auth, _ = await _register(client)
    for method, path in GUARDED:
        r = await client.request(method, path, json={}, headers=auth)
        assert r.status_code == 403, f"{method} {path} → {r.status_code}"
        assert r.json()["error"] == "BUSINESS_NOT_VERIFIED"

    # 검증 화면에서 쓰는 경로는 열려 있다
    assert (await client.get("/api/store", headers=auth)).status_code == 200
    assert (await client.get("/api/auth/me", headers=auth)).status_code == 200


@pytest.mark.asyncio
async def test_pending_passes_and_rejected_is_blocked_immediately(client: AsyncClient) -> None:
    auth, store_id = await _register(client)
    await _set_status(store_id, BusinessStatus.PENDING)
    assert (await client.get("/api/menus", headers=auth)).status_code == 200

    await _set_status(store_id, BusinessStatus.REJECTED)  # 같은 토큰으로도 즉시 차단
    r = await client.get("/api/menus", headers=auth)
    assert r.status_code == 403, r.text


@pytest.mark.asyncio
async def test_master_code_verification_opens_access(client: AsyncClient) -> None:
    master = get_settings().NTS_MASTER_BYPASS_CODE
    if not master:
        pytest.skip("NTS_MASTER_BYPASS_CODE 미설정")
    auth, _ = await _register(client)
    r = await client.post("/api/store/business/verify", data={"business_no": master}, headers=auth)
    assert r.status_code == 200, r.text
    assert (await client.get("/api/inventory", headers=auth)).status_code == 200
