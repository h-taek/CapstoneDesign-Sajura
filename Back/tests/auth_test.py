"""auth_test (M3.B5) — 인증 통합 시험.

Coverage: register(사업자 인증 포함) / 소셜 가입 대기 / login / refresh / logout / logout-all /
get_me + 인증 가드 + 사업자 검증 전 계정의 Refresh Token.
spec: docs/spec/02_implementation_design.md §3.2, 03_be.md §7.1·§7.3.
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update

import app.db as app_db
from app.config import get_settings
from app.core import security
from app.models.store import BusinessStatus, Store
from app.models.user import User
from tests.conftest import (
    TEST_PASSWORD,
    cert_file,
    make_biz_no,
    make_test_email,
    register_user,
)


def _auth(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def _register_form(email: str, business_no: str) -> dict:
    return {
        "email": email, "password": TEST_PASSWORD, "name": "테스트유저", "business_no": business_no,
    }


async def _user_exists(email: str) -> bool:
    async with app_db.SessionLocal() as session:
        return await session.scalar(select(User.user_id).where(User.email == email)) is not None


async def _set_status(email: str, status: BusinessStatus) -> None:
    async with app_db.SessionLocal() as session:
        user_id = await session.scalar(select(User.user_id).where(User.email == email))
        await session.execute(
            update(Store).where(Store.user_id == user_id).values(business_status=status)
        )
        await session.commit()


def _cookie_cleared(r, name: str) -> bool:
    return any(
        h.startswith(f"{name}=") and ("Max-Age=0" in h or 'expires=Thu, 01 Jan 1970' in h)
        for h in r.headers.get_list("set-cookie")
    )


# ----------------------------------------------------------------------
# 이메일 회원가입 — 사업자 인증까지 통과해야 계정 생성, 가입 즉시 로그인
# ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_register_with_business_logs_in_as_pending(client: AsyncClient) -> None:
    email = make_test_email()
    r = await client.post(
        "/api/auth/register", data=_register_form(email, make_biz_no()), files=cert_file()
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["access_token"]
    assert body["business_status"] == "PENDING"
    assert body["onboarding_completed"] is False
    assert "refresh_token" in r.cookies
    me = await client.get("/api/auth/me", headers=_auth(body))
    assert me.json()["email"] == email
    assert me.json()["business_status"] == "PENDING"


@pytest.mark.asyncio
async def test_register_master_code_is_verified_without_cert(client: AsyncClient) -> None:
    master = get_settings().NTS_MASTER_BYPASS_CODE
    if not master:
        pytest.skip("NTS_MASTER_BYPASS_CODE 미설정")
    tokens = await register_user(client, make_test_email())
    assert tokens["business_status"] == "VERIFIED"
    store = (await client.get("/api/store", headers=_auth(tokens))).json()
    # 마스터 통과는 실 번호를 저장하지 않는다 (unique 충돌 방지)
    assert store["business_no"] is None


@pytest.mark.asyncio
async def test_register_duplicate_email_returns_409(client: AsyncClient) -> None:
    email = make_test_email()
    await register_user(client, email)
    r = await client.post(
        "/api/auth/register", data=_register_form(email, make_biz_no()), files=cert_file()
    )
    assert r.status_code == 409
    assert r.json()["error"] == "AUTH_EMAIL_DUPLICATE"


@pytest.mark.asyncio
async def test_register_invalid_business_no_creates_nothing(client: AsyncClient) -> None:
    email = make_test_email()
    r = await client.post(
        "/api/auth/register", data=_register_form(email, "abc-xx-yyyyy"), files=cert_file()
    )
    assert r.status_code == 400
    assert r.json()["error"] == "AUTH_BUSINESS_NO_INVALID"
    assert not await _user_exists(email)


@pytest.mark.asyncio
async def test_register_without_cert_creates_nothing(client: AsyncClient) -> None:
    email = make_test_email()
    r = await client.post("/api/auth/register", data=_register_form(email, make_biz_no()))
    assert r.status_code == 400
    assert r.json()["error"] == "VALIDATION_ERROR"
    assert not await _user_exists(email)


@pytest.mark.asyncio
async def test_register_duplicate_business_no_creates_nothing(client: AsyncClient) -> None:
    biz = make_biz_no()
    await register_user(client, make_test_email("a"), business_no=biz)
    email_b = make_test_email("b")
    r = await client.post(
        "/api/auth/register", data=_register_form(email_b, biz), files=cert_file()
    )
    assert r.status_code == 409
    assert r.json()["error"] == "AUTH_BUSINESS_NO_DUPLICATE"
    assert not await _user_exists(email_b)


# ----------------------------------------------------------------------
# 로그인·Refresh — 사업자 검증 전 계정은 Refresh Token 없음 (03_be.md §7.3)
# ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_login_success_returns_token_and_sets_refresh_cookie(client: AsyncClient) -> None:
    email = make_test_email()
    await register_user(client, email)
    client.cookies.clear()
    r = await client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["expires_in"] > 0
    assert "refresh_token" in r.cookies


@pytest.mark.asyncio
async def test_login_before_verification_has_no_refresh_cookie(client: AsyncClient) -> None:
    email = make_test_email()
    await register_user(client, email)
    await _set_status(email, BusinessStatus.REJECTED)
    client.cookies.clear()
    r = await client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert r.status_code == 200, r.text
    assert r.json()["business_status"] == "REJECTED"
    assert r.json()["access_token"]
    assert "refresh_token" not in r.cookies


@pytest.mark.asyncio
async def test_login_invalid_password_returns_401(client: AsyncClient) -> None:
    email = make_test_email()
    await register_user(client, email)
    r = await client.post("/api/auth/login", json={"email": email, "password": "WrongPass1!"})
    assert r.status_code == 401
    assert r.json()["error"] == "AUTH_INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_login_unknown_email_returns_401(client: AsyncClient) -> None:
    r = await client.post(
        "/api/auth/login", json={"email": make_test_email("nobody"), "password": TEST_PASSWORD}
    )
    assert r.status_code == 401
    assert r.json()["error"] == "AUTH_INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_get_me_without_auth_header_returns_401(client: AsyncClient) -> None:
    r = await client.get("/api/auth/me")
    assert r.status_code == 401
    assert r.json()["error"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_get_me_with_bearer_returns_profile(client: AsyncClient) -> None:
    email = make_test_email()
    tokens = await register_user(client, email, business_no=make_biz_no())
    r = await client.get("/api/auth/me", headers=_auth(tokens))
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == email
    assert body["auth_provider"] == "LOCAL"
    assert body["business_status"] == "PENDING"
    assert body["onboarding_completed"] is False


@pytest.mark.asyncio
async def test_refresh_rotates_token(client: AsyncClient) -> None:
    await register_user(client, make_test_email())
    old_refresh = client.cookies.get("refresh_token")
    assert old_refresh
    r = await client.post("/api/auth/refresh")
    assert r.status_code == 200
    assert r.json()["access_token"]
    new_refresh = r.cookies.get("refresh_token") or client.cookies.get("refresh_token")
    assert new_refresh and new_refresh != old_refresh

    # 회전 후 옛 refresh 재사용은 거부되어야 함.
    r2 = await client.post("/api/auth/refresh", cookies={"refresh_token": old_refresh})
    assert r2.status_code == 401


@pytest.mark.asyncio
async def test_refresh_before_verification_drops_cookie(client: AsyncClient) -> None:
    email = make_test_email()
    await register_user(client, email)
    refresh = client.cookies.get("refresh_token")
    await _set_status(email, BusinessStatus.REJECTED)  # 로그인 뒤 관리자가 반려

    r = await client.post("/api/auth/refresh", cookies={"refresh_token": refresh})
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]
    assert _cookie_cleared(r, "refresh_token")
    # 쓴 Refresh Token은 폐기되어 다시 쓸 수 없다
    r2 = await client.post("/api/auth/refresh", cookies={"refresh_token": refresh})
    assert r2.status_code == 401


@pytest.mark.asyncio
async def test_refresh_with_invalid_cookie_returns_401(client: AsyncClient) -> None:
    r = await client.post("/api/auth/refresh", cookies={"refresh_token": "not-a-real-token"})
    assert r.status_code == 401
    assert r.json()["error"] == "AUTH_REFRESH_TOKEN_INVALID"


@pytest.mark.asyncio
async def test_logout_revokes_current_refresh(client: AsyncClient) -> None:
    tokens = await register_user(client, make_test_email())
    refresh_before = client.cookies.get("refresh_token")
    r = await client.post("/api/auth/logout", headers=_auth(tokens))
    assert r.status_code == 204
    r2 = await client.post("/api/auth/refresh", cookies={"refresh_token": refresh_before})
    assert r2.status_code == 401


@pytest.mark.asyncio
async def test_logout_all_revokes_every_session(client: AsyncClient) -> None:
    email = make_test_email()
    # 세션 A(가입) → refresh 보관.
    tokens_a = await register_user(client, email)
    refresh_a = client.cookies.get("refresh_token")

    # 세션 B 로그인 (동일 사용자, 다른 디바이스 시뮬레이션).
    r = await client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert r.status_code == 200
    refresh_b = r.cookies.get("refresh_token") or client.cookies.get("refresh_token")
    assert refresh_a and refresh_b and refresh_a != refresh_b

    r = await client.post("/api/auth/logout-all", headers=_auth(tokens_a))
    assert r.status_code == 204

    for tok in (refresh_a, refresh_b):
        rr = await client.post("/api/auth/refresh", cookies={"refresh_token": tok})
        assert rr.status_code == 401


# ----------------------------------------------------------------------
# 사업자 검증 화면 — 반려 재제출·기존 미인증 계정 (02 §3.3)
# ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_verify_business_resubmit_sets_pending_and_issues_refresh(
    client: AsyncClient,
) -> None:
    email = make_test_email()
    await register_user(client, email, business_no=make_biz_no())
    await _set_status(email, BusinessStatus.REJECTED)
    client.cookies.clear()
    r = await client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})
    auth = _auth(r.json())
    assert "refresh_token" not in r.cookies

    r = await client.post(
        "/api/store/business/verify",
        data={"business_no": make_biz_no()}, files=cert_file(), headers=auth,
    )
    assert r.status_code == 200, r.text
    assert r.json()["business_status"] == "PENDING"
    assert "refresh_token" in r.cookies  # 통과한 지금 처음 발급


@pytest.mark.asyncio
async def test_verify_business_invalid_format_returns_400(client: AsyncClient) -> None:
    tokens = await register_user(client, make_test_email())
    r = await client.post(
        "/api/store/business/verify",
        data={"business_no": "abc-xx-yyyyy"}, files=cert_file(), headers=_auth(tokens),
    )
    assert r.status_code == 400
    assert r.json()["error"] == "AUTH_BUSINESS_NO_INVALID"


@pytest.mark.asyncio
async def test_verify_business_without_cert_returns_400(client: AsyncClient) -> None:
    tokens = await register_user(client, make_test_email())
    r = await client.post(
        "/api/store/business/verify",
        data={"business_no": make_biz_no()}, headers=_auth(tokens),
    )
    assert r.status_code == 400
    assert r.json()["error"] == "VALIDATION_ERROR"


# ----------------------------------------------------------------------
# 소셜 가입 대기 — 사업자 인증까지 마쳐야 계정 생성 (03_be.md §7.1)
# ----------------------------------------------------------------------


def _signup_token(email: str, social_id: str | None = None) -> str:
    return security.create_signup_token(
        provider="kakao", social_id=social_id or uuid.uuid4().hex, email=email, name="카카오점주"
    )


@pytest.mark.asyncio
async def test_social_signup_info_requires_signup_token(client: AsyncClient) -> None:
    r = await client.get("/api/auth/register/social")
    assert r.status_code == 401
    assert r.json()["error"] == "AUTH_SIGNUP_TOKEN_INVALID"

    # Access Token처럼 다른 용도의 토큰은 가입 대기 토큰으로 쓸 수 없다
    access, _ = security.create_access_token(user_id="u", store_id=None)
    r = await client.get("/api/auth/register/social", cookies={"signup_token": access})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_social_signup_creates_account_and_logs_in(client: AsyncClient) -> None:
    email = make_test_email("kakao")
    client.cookies.set("signup_token", _signup_token(email))

    r = await client.get("/api/auth/register/social")
    assert r.status_code == 200, r.text
    assert r.json() == {"provider": "KAKAO", "email": email, "name": "카카오점주"}
    assert not await _user_exists(email)  # 가입 대기 중에는 계정이 없다

    r = await client.post(
        "/api/auth/register/social", data={"business_no": make_biz_no()}, files=cert_file()
    )
    assert r.status_code == 201, r.text
    assert r.json()["business_status"] == "PENDING"
    assert "refresh_token" in r.cookies
    assert _cookie_cleared(r, "signup_token")
    me = (await client.get("/api/auth/me", headers=_auth(r.json()))).json()
    assert me["auth_provider"] == "KAKAO"
    assert me["email"] == email


@pytest.mark.asyncio
async def test_social_signup_failure_creates_nothing_and_can_retry(client: AsyncClient) -> None:
    email = make_test_email("kakao")
    client.cookies.set("signup_token", _signup_token(email))

    r = await client.post(
        "/api/auth/register/social", data={"business_no": "abc-xx-yyyyy"}, files=cert_file()
    )
    assert r.status_code == 400
    assert not await _user_exists(email)

    # 가입 대기 토큰은 만료 전까지 남아 다시 제출할 수 있다
    r = await client.post(
        "/api/auth/register/social", data={"business_no": make_biz_no()}, files=cert_file()
    )
    assert r.status_code == 201, r.text


@pytest.mark.asyncio
async def test_social_signup_resubmit_logs_in_same_account(client: AsyncClient) -> None:
    email = make_test_email("kakao")
    token = _signup_token(email)
    r1 = await client.post(
        "/api/auth/register/social", data={"business_no": make_biz_no()}, files=cert_file(),
        cookies={"signup_token": token},
    )
    r2 = await client.post(
        "/api/auth/register/social", data={"business_no": make_biz_no()}, files=cert_file(),
        cookies={"signup_token": token},
    )
    assert r1.status_code == 201 and r2.status_code == 201, r2.text
    me1 = (await client.get("/api/auth/me", headers=_auth(r1.json()))).json()
    me2 = (await client.get("/api/auth/me", headers=_auth(r2.json()))).json()
    assert me1["user_id"] == me2["user_id"]


# ----------------------------------------------------------------------
# OAuth — state(CSRF)·콜백 분기 (03_be.md §7.1, §13.1)
# ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_oauth_login_redirect_issues_state(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from urllib.parse import parse_qs, urlparse

    from app.api import oauth

    monkeypatch.setattr(oauth, "_ensure_oauth_configured", lambda p: None)
    r = await client.get("/api/auth/login/kakao")
    client.cookies.clear()
    assert r.status_code == 302, r.text
    location = urlparse(r.headers["location"])
    assert location.netloc == "kauth.kakao.com"
    assert parse_qs(location.query)["state"][0]
    assert "oauth_session=" in r.headers.get("set-cookie", "")


@pytest.mark.asyncio
async def test_oauth_callback_rejects_mismatched_state(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.api import oauth

    monkeypatch.setattr(oauth, "_ensure_oauth_configured", lambda p: None)
    r = await client.get("/api/auth/login/kakao")
    assert r.status_code == 302, r.text
    r = await client.get("/api/auth/callback/kakao", params={"code": "c", "state": "forged"})
    client.cookies.clear()
    assert r.status_code == 400, r.text
    assert r.json()["error"] == "AUTH_SOCIAL_LOGIN_FAILED"


def _fake_provider(monkeypatch: pytest.MonkeyPatch, profile: dict) -> None:
    from app.api import oauth

    async def _authorize(provider: str, request: object) -> dict:
        return {}

    async def _userinfo(provider: str, token: dict) -> dict:
        return profile

    monkeypatch.setattr(oauth, "_ensure_oauth_configured", lambda p: None)
    monkeypatch.setattr(oauth, "_authorize", _authorize)
    monkeypatch.setattr(oauth, "_fetch_userinfo", _userinfo)


@pytest.mark.asyncio
async def test_oauth_callback_new_account_goes_to_signup(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    email = make_test_email("kakao")
    _fake_provider(monkeypatch, {"social_id": uuid.uuid4().hex, "email": email, "name": "카카오"})

    r = await client.get("/api/auth/callback/kakao")
    assert r.status_code == 302, r.text
    assert r.headers["location"].endswith("/register?social=1")
    assert "signup_token" in r.cookies
    assert "refresh_token" not in r.cookies
    assert not await _user_exists(email)


@pytest.mark.asyncio
async def test_oauth_callback_existing_account_logs_in(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    email = make_test_email("kakao")
    social_id = uuid.uuid4().hex
    r = await client.post(
        "/api/auth/register/social", data={"business_no": make_biz_no()}, files=cert_file(),
        cookies={"signup_token": _signup_token(email, social_id)},
    )
    assert r.status_code == 201, r.text
    client.cookies.clear()
    _fake_provider(monkeypatch, {"social_id": social_id, "email": email, "name": "카카오"})

    r = await client.get("/api/auth/callback/kakao")
    assert r.status_code == 302, r.text
    assert not r.headers["location"].endswith("/register?social=1")
    assert "refresh_token" in r.cookies


# ----------------------------------------------------------------------
# Rate Limit — 03_be.md §13.4
# ----------------------------------------------------------------------


@pytest.mark.asyncio
async def test_login_rate_limited_per_ip(client: AsyncClient) -> None:
    from httpx import ASGITransport

    from app.main import app

    body = {"email": make_test_email("rl"), "password": "Wrong-pass1!"}
    for _ in range(5):
        r = await client.post("/api/auth/login", json=body)
        assert r.status_code == 401, r.text
    r = await client.post("/api/auth/login", json=body)
    assert r.status_code == 429, r.text
    assert r.json()["error"] == "TOO_MANY_REQUESTS"
    assert int(r.headers["retry-after"]) > 0

    # 다른 IP는 영향 없음
    other = ASGITransport(app=app, client=("10.0.0.2", 50000))
    async with AsyncClient(transport=other, base_url="http://localhost") as c:
        r = await c.post("/api/auth/login", json=body)
    assert r.status_code == 401, r.text
