"""n8n 예측 워크플로우 웹훅 — 수동 예측 실행 (01_basic_design.md §3.6.2·§3.11.1).

웹훅은 워크플로우가 끝난 뒤 {status, insufficient_history, error}로 응답한다.
AI 학습·예측이 매장당 수 초 걸려 응답을 기다린다.
"""

from __future__ import annotations

import httpx

from app.config import get_settings

WEBHOOK_PATH = "/webhook/forecast"
TIMEOUT_SECONDS = 120


async def run_forecast(store_id: str) -> dict:
    s = get_settings()
    async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
        r = await client.post(
            f"{s.N8N_BASE_URL}{WEBHOOK_PATH}",
            json={"store_id": store_id},
            headers={"X-Internal-Token": s.INTERNAL_API_TOKEN},
        )
        r.raise_for_status()
        return r.json()
