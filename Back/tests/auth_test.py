"""auth_test (M3.B5) — 12 integration cases.

Coverage: register / login / refresh / logout / logout-all / get_me + 인증 가드.
spec: docs/spec/07_api_spec.md §2, plan: docs/plan/01_be.md M3.B1~B5.
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from tests.conftest import make_test_email


def _make_biz_no() -> str:
    n = uuid.uuid4().int
    return f"{n % 1000:03d}-{(n // 1000) % 100:02d}-{(n // 100000) % 100000:05d}"


def _cert_file() -> dict:
    """multipart 업로드용 더미 사업자등록증(PNG 헤더)."""
    return {"cert": ("cert.png", b"\x89PNG\r\n\x1a\n_dummy_cert_", "image/png")}


def _register_payload(email: str, *, password: str = "Passw0rd!") -> dict:
    return {"email": email, "password": password, "name": "테스트유저"}


async def _register_and_login(client: AsyncClient, email: str, password: str = "Passw0rd!") -> dict:
    r = await client.post("/api/auth/register", json=_register_payload(email, password=password))
    assert r.status_code == 201, r.text
    r = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


# 1
@pytest.mark.asyncio
async def test_register_success(client: AsyncClient) -> None:
    email = make_test_email()
    r = await client.post("/api/auth/register", json=_register_payload(email))
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == email
    assert body["name"] == "테스트유저"
    assert "user_id" in body and body["user_id"]


# 2
@pytest.mark.asyncio
async def test_register_duplicate_email_returns_409(client: AsyncClient) -> None:
    email = make_test_email()
    r1 = await client.post("/api/auth/register", json=_register_payload(email))
    assert r1.status_code == 201
    r2 = await client.post("/api/auth/register", json=_register_payload(email))
    assert r2.status_code == 409
    assert r2.json()["error"] == "AUTH_EMAIL_DUPLICATE"


# 3
@pytest.mark.asyncio
async def test_verify_business_invalid_format_returns_400(client: AsyncClient) -> None:
    email = make_test_email()
    tokens = await _register_and_login(client, email)
    r = await client.post(
        "/api/store/business/verify",
        data={"business_no": "abc-xx-yyyyy"},
        files=_cert_file(),
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert r.status_code == 400
    assert r.json()["error"] == "AUTH_BUSINESS_NO_INVALID"


# 4
@pytest.mark.asyncio
async def test_login_success_returns_token_and_sets_refresh_cookie(client: AsyncClient) -> None:
    email = make_test_email()
    await client.post("/api/auth/register", json=_register_payload(email))
    r = await client.post("/api/auth/login", json={"email": email, "password": "Passw0rd!"})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["expires_in"] > 0
    assert "refresh_token" in r.cookies


# 5
@pytest.mark.asyncio
async def test_login_invalid_password_returns_401(client: AsyncClient) -> None:
    email = make_test_email()
    await client.post("/api/auth/register", json=_register_payload(email))
    r = await client.post("/api/auth/login", json={"email": email, "password": "WrongPass1!"})
    assert r.status_code == 401
    assert r.json()["error"] == "AUTH_INVALID_CREDENTIALS"


# 6
@pytest.mark.asyncio
async def test_login_unknown_email_returns_401(client: AsyncClient) -> None:
    r = await client.post(
        "/api/auth/login", json={"email": make_test_email("nobody"), "password": "Passw0rd!"}
    )
    assert r.status_code == 401
    assert r.json()["error"] == "AUTH_INVALID_CREDENTIALS"


# 7
@pytest.mark.asyncio
async def test_get_me_without_auth_header_returns_401(client: AsyncClient) -> None:
    r = await client.get("/api/auth/me")
    assert r.status_code == 401
    assert r.json()["error"] == "UNAUTHORIZED"


# 8
@pytest.mark.asyncio
async def test_get_me_with_bearer_returns_profile(client: AsyncClient) -> None:
    email = make_test_email()
    tokens = await _register_and_login(client, email)
    r = await client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == email
    assert body["auth_provider"] == "LOCAL"
    assert body["business_status"] == "UNVERIFIED"
    assert body["onboarding_completed"] is False


# 8b — 사업자 검증: NTS 통과 + 등록증 업로드 → PENDING (stub 모드/유효 형식)
@pytest.mark.asyncio
async def test_verify_business_with_cert_sets_pending(client: AsyncClient) -> None:
    email = make_test_email()
    tokens = await _register_and_login(client, email)
    auth = {"Authorization": f"Bearer {tokens['access_token']}"}
    r = await client.post(
        "/api/store/business/verify",
        data={"business_no": _make_biz_no()}, files=_cert_file(), headers=auth,
    )
    assert r.status_code == 200, r.text
    assert r.json()["business_status"] == "PENDING"
    me = await client.get("/api/auth/me", headers=auth)
    assert me.json()["business_status"] == "PENDING"


# 8b-2 — 등록증 미첨부(비마스터) → 400
@pytest.mark.asyncio
async def test_verify_business_without_cert_returns_400(client: AsyncClient) -> None:
    email = make_test_email()
    tokens = await _register_and_login(client, email)
    r = await client.post(
        "/api/store/business/verify",
        data={"business_no": _make_biz_no()},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert r.status_code == 400
    assert r.json()["error"] == "VALIDATION_ERROR"


# 8c — 로그인 응답에 business_status 포함 (미검증 시 UNVERIFIED)
@pytest.mark.asyncio
async def test_login_includes_business_status_unverified(client: AsyncClient) -> None:
    email = make_test_email()
    tokens = await _register_and_login(client, email)
    assert tokens["business_status"] == "UNVERIFIED"


# 8d — 마스터 코드 강제 패스 → VERIFIED, 파일 불필요 (12_security.md §2.4). 미설정 시 skip.
@pytest.mark.asyncio
async def test_verify_business_master_code_bypass(client: AsyncClient) -> None:
    from app.config import get_settings

    master = get_settings().NTS_MASTER_BYPASS_CODE
    if not master:
        pytest.skip("NTS_MASTER_BYPASS_CODE 미설정")
    email = make_test_email()
    tokens = await _register_and_login(client, email)
    auth = {"Authorization": f"Bearer {tokens['access_token']}"}
    r = await client.post(
        "/api/store/business/verify", data={"business_no": master}, headers=auth
    )
    assert r.status_code == 200, r.text
    assert r.json()["business_status"] == "VERIFIED"
    # 마스터 통과는 실 번호를 저장하지 않는다 (unique 충돌 방지).
    assert r.json()["business_no"] is None


# 9
@pytest.mark.asyncio
async def test_refresh_rotates_token(client: AsyncClient) -> None:
    email = make_test_email()
    await _register_and_login(client, email)
    old_refresh = client.cookies.get("refresh_token")
    assert old_refresh
    r = await client.post("/api/auth/refresh")
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    new_refresh = r.cookies.get("refresh_token") or client.cookies.get("refresh_token")
    assert new_refresh and new_refresh != old_refresh

    # 회전 후 옛 refresh 재사용은 거부되어야 함.
    fresh_client_cookies = {"refresh_token": old_refresh}
    r2 = await client.post("/api/auth/refresh", cookies=fresh_client_cookies)
    assert r2.status_code == 401


# 10
@pytest.mark.asyncio
async def test_refresh_with_invalid_cookie_returns_401(client: AsyncClient) -> None:
    r = await client.post("/api/auth/refresh", cookies={"refresh_token": "not-a-real-token"})
    assert r.status_code == 401
    assert r.json()["error"] == "AUTH_REFRESH_TOKEN_INVALID"


# 11
@pytest.mark.asyncio
async def test_logout_revokes_current_refresh(client: AsyncClient) -> None:
    email = make_test_email()
    tokens = await _register_and_login(client, email)
    refresh_before = client.cookies.get("refresh_token")
    r = await client.post(
        "/api/auth/logout", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert r.status_code == 204
    r2 = await client.post("/api/auth/refresh", cookies={"refresh_token": refresh_before})
    assert r2.status_code == 401


# 12
@pytest.mark.asyncio
async def test_logout_all_revokes_every_session(client: AsyncClient) -> None:
    email = make_test_email()
    # 세션 A 로그인 → refresh 보관.
    tokens_a = await _register_and_login(client, email)
    refresh_a = client.cookies.get("refresh_token")

    # 세션 B 로그인 (동일 사용자, 다른 디바이스 시뮬레이션).
    r = await client.post("/api/auth/login", json={"email": email, "password": "Passw0rd!"})
    assert r.status_code == 200
    refresh_b = r.cookies.get("refresh_token") or client.cookies.get("refresh_token")
    assert refresh_a and refresh_b and refresh_a != refresh_b

    # logout-all
    r = await client.post(
        "/api/auth/logout-all",
        headers={"Authorization": f"Bearer {tokens_a['access_token']}"},
    )
    assert r.status_code == 204

    # 두 refresh 모두 401
    for tok in (refresh_a, refresh_b):
        rr = await client.post("/api/auth/refresh", cookies={"refresh_token": tok})
        assert rr.status_code == 401
