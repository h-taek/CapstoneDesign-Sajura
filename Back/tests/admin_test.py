"""admin_test (M3.B9) — 관리자 사업자 검증 심사.

Coverage: 비ADMIN 403 / 심사 큐 / 승인→VERIFIED / 반려→REJECTED(+사유).
spec: 07_api_spec.md §3 관리자 API, plan: docs/plan/01_be.md M3.B9.
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import update

import app.db as app_db
from app.models.user import User, UserRole
from tests.conftest import make_test_email


def _biz_no() -> str:
    n = uuid.uuid4().int
    return f"{n % 1000:03d}-{(n // 1000) % 100:02d}-{(n // 100000) % 100000:05d}"


def _cert() -> dict:
    return {"cert": ("cert.png", b"\x89PNG\r\n\x1a\n_dummy_", "image/png")}


async def _register_login(client: AsyncClient, email: str) -> dict:
    await client.post(
        "/api/auth/register", json={"email": email, "password": "Passw0rd!", "name": "u"}
    )
    r = await client.post("/api/auth/login", json={"email": email, "password": "Passw0rd!"})
    return {"access_token": r.json()["access_token"]}


def _auth(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


async def _promote_admin(email: str) -> None:
    async with app_db.SessionLocal() as session:
        await session.execute(update(User).where(User.email == email).values(role=UserRole.ADMIN))
        await session.commit()


async def _owner_with_pending(client: AsyncClient) -> tuple[dict, str]:
    """점주 가입·로그인 + 검증 업로드 → PENDING. (auth, store_id) 반환."""
    email = make_test_email("owner")
    tokens = await _register_login(client, email)
    await client.post(
        "/api/store/business/verify",
        data={"business_no": _biz_no()}, files=_cert(), headers=_auth(tokens),
    )
    return _auth(tokens), email


# 1 — 비ADMIN은 관리자 API 접근 403
@pytest.mark.asyncio
async def test_admin_endpoint_forbidden_for_owner(client: AsyncClient) -> None:
    tokens = await _register_login(client, make_test_email("owner"))
    r = await client.get("/api/admin/verifications", headers=_auth(tokens))
    assert r.status_code == 403
    assert r.json()["error"] == "FORBIDDEN"


# 2 — 승인 흐름: PENDING → 목록 노출 → 승인 → VERIFIED
@pytest.mark.asyncio
async def test_admin_approve_sets_verified(client: AsyncClient) -> None:
    owner_auth, _ = await _owner_with_pending(client)

    admin_email = make_test_email("admin")
    admin_tokens = await _register_login(client, admin_email)
    await _promote_admin(admin_email)
    admin_auth = _auth(admin_tokens)

    lst = await client.get("/api/admin/verifications?size=100", headers=admin_auth)
    assert lst.status_code == 200, lst.text
    items = lst.json()["items"]
    me = await client.get("/api/auth/me", headers=owner_auth)
    my_uid = me.json()["user_id"]
    # 내 매장 store_id 찾기 — cert_url에서 추출.
    mine = next(i for i in items if i["business_status"] == "PENDING" and i["cert_url"])
    store_id = mine["store_id"]

    ap = await client.post(f"/api/admin/verifications/{store_id}/approve", headers=admin_auth)
    assert ap.status_code == 200, ap.text
    assert ap.json()["business_status"] == "VERIFIED"

    after = await client.get("/api/auth/me", headers=owner_auth)
    assert after.json()["business_status"] == "VERIFIED"
    assert after.json()["user_id"] == my_uid


# 3 — 반려 흐름: 반려 → REJECTED + 사유 (GET /store로 사유 노출)
@pytest.mark.asyncio
async def test_admin_reject_sets_rejected_with_reason(client: AsyncClient) -> None:
    owner_auth, _ = await _owner_with_pending(client)
    admin_email = make_test_email("admin")
    admin_tokens = await _register_login(client, admin_email)
    await _promote_admin(admin_email)
    admin_auth = _auth(admin_tokens)

    items = (await client.get("/api/admin/verifications?size=100", headers=admin_auth)).json()[
        "items"
    ]
    store_id = next(i for i in items if i["cert_url"])["store_id"]

    rj = await client.post(
        f"/api/admin/verifications/{store_id}/reject",
        json={"reason": "등록증과 사업자번호 불일치"}, headers=admin_auth,
    )
    assert rj.status_code == 200, rj.text
    assert rj.json()["business_status"] == "REJECTED"

    store = await client.get("/api/store", headers=owner_auth)
    assert store.json()["business_status"] == "REJECTED"
    assert store.json()["business_reject_reason"] == "등록증과 사업자번호 불일치"


# 4 — me 응답에 role 포함 (기본 OWNER)
@pytest.mark.asyncio
async def test_me_includes_role(client: AsyncClient) -> None:
    tokens = await _register_login(client, make_test_email("owner"))
    me = await client.get("/api/auth/me", headers=_auth(tokens))
    assert me.json()["role"] == "OWNER"
