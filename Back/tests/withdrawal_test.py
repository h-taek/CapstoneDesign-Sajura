"""회원 탈퇴 30일 유예 + 파기 배치 — 12_security.md §3.1, 07_api_spec.md DELETE /api/auth/me."""

from __future__ import annotations

import io
from datetime import datetime, timedelta
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, update

import app.db as app_db
from app.config import get_settings
from app.core import errors
from app.models.order import Order, OrderRecommendation
from app.models.refresh_token import RefreshToken
from app.models.sale_record import SaleRecord
from app.models.store import Store
from app.models.user import User
from app.services.account_purge_service import AccountPurgeService
from app.services.auth_service import AuthService
from tests.conftest import make_test_email
from tests.sales_test import _create_menu, _csv_bytes, _register_verified_user


async def _user_id(email: str) -> str:
    async with app_db.SessionLocal() as session:
        return await session.scalar(select(User.user_id).where(User.email == email))


async def _age_withdrawal(email: str, days: int) -> None:
    async with app_db.SessionLocal() as session:
        await session.execute(
            update(User)
            .where(User.email == email)
            .values(withdrawn_at=datetime.utcnow() - timedelta(days=days))
        )
        await session.commit()


async def _withdraw(client: AsyncClient, auth: dict) -> None:
    r = await client.request("DELETE", "/api/auth/me", json={"password": "Passw0rd!"}, headers=auth)
    assert r.status_code == 204, r.text


@pytest.mark.asyncio
async def test_withdrawal_blocks_login_register_and_api(client: AsyncClient) -> None:
    email, auth = await _register_verified_user(client)
    await _withdraw(client, auth)

    r = await client.post("/api/auth/login", json={"email": email, "password": "Passw0rd!"})
    assert r.status_code == 403, r.text
    assert r.json()["error"] == "AUTH_ACCOUNT_WITHDRAWN"

    r = await client.post(
        "/api/auth/register", json={"email": email, "password": "Passw0rd!", "name": "재가입"}
    )
    assert r.status_code == 409, r.text
    assert r.json()["error"] == "AUTH_ACCOUNT_WITHDRAWN"

    # 남은 Access Token으로도 매장 데이터 API는 막힌다
    r = await client.get("/api/menus", headers=auth)
    assert r.status_code == 403, r.text

    user_id = await _user_id(email)
    async with app_db.SessionLocal() as session:
        live = await session.scalar(
            select(func.count())
            .select_from(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.is_revoked.is_(False))
        )
    assert live == 0


@pytest.mark.asyncio
async def test_withdrawal_requires_password(client: AsyncClient) -> None:
    email, auth = await _register_verified_user(client)
    r = await client.request("DELETE", "/api/auth/me", json={"password": "wrong"}, headers=auth)
    assert r.status_code == 401, r.text
    r = await client.post("/api/auth/login", json={"email": email, "password": "Passw0rd!"})
    assert r.status_code == 200, r.text


@pytest.mark.asyncio
async def test_purge_deletes_expired_accounts_with_store_data(
    client: AsyncClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(get_settings(), "UPLOAD_DIR", str(tmp_path))
    email, auth = await _register_verified_user(client)
    menu_id = await _create_menu(client, auth, "아메리카노")
    r = await client.post(
        "/api/sales/upload",
        files={
            "file": (
                "s.csv",
                io.BytesIO(_csv_bytes(["2026-01-15,아메리카노,1,4500,r1"])),
                "text/csv",
            )
        },
        data={
            "date_column": "날짜",
            "menu_column": "메뉴명",
            "quantity_column": "수량",
            "price_column": "금액",
            "external_sale_id_column": "영수증번호",
        },
        headers=auth,
    )
    assert r.status_code == 201, r.text
    r = await client.post("/api/inventory", json={"name": "원두", "unit": "g"}, headers=auth)
    item_id = r.json()["item_id"]
    r = await client.put(
        f"/api/menus/{menu_id}/recipe",
        json={"ingredients": [{"item_id": item_id, "quantity": 18, "unit": "g"}]},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    r = await client.post(
        "/api/orders/approve",
        json={"items": [{"item_id": item_id, "final_quantity": 1}]},
        headers=auth,
    )
    assert r.status_code == 201, r.text

    user_id = await _user_id(email)
    cert = tmp_path / "business_cert" / "cert.pdf"
    cert.parent.mkdir(parents=True)
    cert.write_bytes(b"%PDF")
    async with app_db.SessionLocal() as session:
        store_id = await session.scalar(select(Store.store_id).where(Store.user_id == user_id))
        session.add(OrderRecommendation(store_id=store_id, target_date=datetime.utcnow().date()))
        await session.execute(
            update(Store)
            .where(Store.store_id == store_id)
            .values(business_cert_path="business_cert/cert.pdf")
        )
        await session.commit()

    keep_email, keep_auth = await _register_verified_user(client)
    await _withdraw(client, auth)
    await _withdraw(client, keep_auth)
    await _age_withdrawal(email, 31)
    await _age_withdrawal(keep_email, 29)

    async with app_db.SessionLocal() as session:
        purged = await AccountPurgeService(session).purge_expired()
    assert purged >= 1

    async with app_db.SessionLocal() as session:
        assert await session.get(User, user_id) is None
        assert await session.scalar(select(User.user_id).where(User.email == keep_email))
        for model in (Store, SaleRecord, Order, OrderRecommendation):
            left = await session.scalar(
                select(func.count()).select_from(model).where(model.store_id == store_id)
            )
            assert left == 0, model.__name__
    assert not cert.exists()


@pytest.mark.asyncio
async def test_withdrawn_social_account_cannot_log_in() -> None:
    email = make_test_email("social")
    async with app_db.SessionLocal() as session:
        await AuthService(session).login_with_oauth(
            provider="kakao", social_id=email, email=email, name="소셜"
        )
    async with app_db.SessionLocal() as session:
        user_id = await session.scalar(select(User.user_id).where(User.email == email))
        await AuthService(session).delete_account(user_id=user_id, password="")
    async with app_db.SessionLocal() as session:
        with pytest.raises(errors.DomainError) as exc:
            await AuthService(session).login_with_oauth(
                provider="kakao", social_id=email, email=email, name="소셜"
            )
    assert exc.value.detail["error"] == "AUTH_ACCOUNT_WITHDRAWN"


@pytest.mark.asyncio
async def test_oauth_callback_redirects_withdrawn_account(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.api import oauth

    email = make_test_email("social")
    async with app_db.SessionLocal() as session:
        await AuthService(session).login_with_oauth(
            provider="kakao", social_id=email, email=email, name="소셜"
        )
        user_id = await session.scalar(select(User.user_id).where(User.email == email))
        await AuthService(session).delete_account(user_id=user_id, password="")

    async def fake_exchange(provider: str, code: str) -> dict:
        return {"access_token": "t"}

    async def fake_userinfo(provider: str, access_token: str) -> dict[str, str]:
        return {"social_id": email, "email": email, "name": "소셜"}

    monkeypatch.setattr(oauth, "_ensure_oauth_configured", lambda p: None)
    monkeypatch.setattr(oauth, "_exchange_code", fake_exchange)
    monkeypatch.setattr(oauth, "_fetch_userinfo", fake_userinfo)

    client.cookies.set("oauth_state", "s1")
    r = await client.get("/api/auth/callback/kakao", params={"code": "c", "state": "s1"})
    client.cookies.clear()
    assert r.status_code == 302, r.text
    assert r.headers["location"].endswith("/login?error=withdrawn")
    assert "refresh_token" not in r.headers.get("set-cookie", "")
