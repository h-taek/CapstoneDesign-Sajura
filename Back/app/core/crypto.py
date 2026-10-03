"""AES-256-GCM 필드 암호화 — 12_security.md §4.1 (pos_connections.api_key).

저장 형식은 base64(nonce 12B ‖ 암호문 ‖ 태그 16B). aad에 소유 행의 식별자(store_id)를 넣어
암호문을 다른 매장 행으로 옮겨 붙이면 복호화가 실패하게 한다.
"""

from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings

_NONCE_BYTES = 12


def _cipher() -> AESGCM:
    raw = get_settings().AES_GCM_KEY_BASE64
    key = base64.b64decode(raw) if raw else b""
    if len(key) != 32:
        raise RuntimeError("AES_GCM_KEY_BASE64는 32바이트 키의 base64여야 합니다.")
    return AESGCM(key)


def encrypt(plain: str, *, aad: str) -> str:
    nonce = os.urandom(_NONCE_BYTES)
    sealed = _cipher().encrypt(nonce, plain.encode(), aad.encode())
    return base64.b64encode(nonce + sealed).decode()


def decrypt(token: str, *, aad: str) -> str:
    blob = base64.b64decode(token)
    return _cipher().decrypt(blob[:_NONCE_BYTES], blob[_NONCE_BYTES:], aad.encode()).decode()
