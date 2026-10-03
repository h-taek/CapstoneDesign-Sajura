"""POS 자격증명 AES-256-GCM 저장 암호화 — 12_security.md §4.1."""

from __future__ import annotations

import pytest
from cryptography.exceptions import InvalidTag
from httpx import AsyncClient
from sqlalchemy import select

import app.db as app_db
from app.core import crypto
from app.models.pos_connection import PosConnection
from tests.sales_test import _register_verified_user


def test_roundtrip_and_random_nonce() -> None:
    a = crypto.encrypt("secret-key-123", aad="store-1")
    b = crypto.encrypt("secret-key-123", aad="store-1")
    assert a != b  # 매번 새 nonce
    assert "secret-key-123" not in a
    assert crypto.decrypt(a, aad="store-1") == "secret-key-123"


def test_ciphertext_bound_to_store() -> None:
    token = crypto.encrypt("secret-key-123", aad="store-1")
    with pytest.raises(InvalidTag):
        crypto.decrypt(token, aad="store-2")


def test_ciphertext_fits_column_at_max_input() -> None:
    assert len(crypto.encrypt("k" * 150, aad="store-1")) <= 255


@pytest.mark.asyncio
async def test_pos_api_key_stored_encrypted(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    r = await client.post(
        "/api/store/pos",
        json={"pos_type": "TOSS", "api_key": "plain-api-key-0001", "store_code": "S1"},
        headers=auth,
    )
    assert r.status_code == 201, r.text
    assert r.json()["api_key"] == "pl**************01"

    r = await client.patch("/api/store/pos", json={"api_key": "rotated-key-0002"}, headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["api_key"].endswith("02")

    store_id = (await client.get("/api/store", headers=auth)).json()["store_id"]
    async with app_db.SessionLocal() as session:
        stored = await session.scalar(
            select(PosConnection.api_key).where(PosConnection.store_id == store_id)
        )
    assert stored is not None and "rotated-key-0002" not in stored
    assert crypto.decrypt(stored, aad=store_id) == "rotated-key-0002"
