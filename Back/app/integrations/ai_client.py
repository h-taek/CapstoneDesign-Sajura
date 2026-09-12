"""AI Server 클라이언트 — api_spec.md §8 계약. stateless 서빙(사전 학습 모델 불필요).

AI 서버가 꺼져있거나 응답이 422(이력 부족 등)면 DomainError로 변환해 상위에서
"준비 중"으로 정직하게 표시할 수 있게 한다.
"""
from __future__ import annotations

import httpx

from app.config import get_settings
from app.core import errors


async def _post(path: str, payload: dict) -> dict:
    s = get_settings()
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(f"{s.AI_SERVER_BASE_URL}{path}", json=payload)
    except httpx.HTTPError as exc:
        raise errors.DomainError(
            status_code=503, error_code="SERVICE_UNAVAILABLE",
            message="AI 서버에 연결할 수 없습니다.",
        ) from exc
    if r.status_code == 422:
        raise errors.DomainError(
            status_code=422, error_code="AI_INSUFFICIENT_HISTORY",
            message="AI 예측에 필요한 판매 이력이 부족합니다.", detail=r.json().get("detail"),
        )
    if r.status_code != 200:
        raise errors.DomainError(
            status_code=502, error_code="AI_SERVER_ERROR",
            message="AI 서버 응답 오류.", detail={"status": r.status_code},
        )
    return r.json()


async def predict(payload: dict) -> dict:
    return await _post("/ai/forecast/predict", payload)


async def recommend(payload: dict) -> dict:
    return await _post("/ai/orders/recommend", payload)
