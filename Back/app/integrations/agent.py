"""담기 에이전트 서버 내부 API — 03_be.md §2.4.5·§2.4.6.

LLM 대화·오남용 방지 규칙·보안 분류기는 에이전트 서버가 맡는다. 에이전트 서버의 오류 응답은
그 상태 코드와 본문 그대로 `AgentError`로 올리고, 연결하지 못하거나 시간 제한을 넘기면
503 `ORDER_LLM_UNAVAILABLE`로 올린다.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.config import get_settings

TIMEOUT_SECONDS = 130.0
UNAVAILABLE = {
    "error": "ORDER_LLM_UNAVAILABLE",
    "message": "담기 에이전트를 지금 쓸 수 없습니다. 쿠팡에서 직접 담아 주세요.",
    "detail": None,
}


class AgentError(Exception):
    def __init__(self, status_code: int, body: dict[str, Any]) -> None:
        super().__init__(f"{status_code} {body.get('error')}")
        self.status_code = status_code
        self.body = body


async def _post(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            r = await client.post(f"{get_settings().AGENT_BASE_URL}{path}", json=payload)
    except httpx.HTTPError as exc:
        raise AgentError(503, UNAVAILABLE) from exc
    try:
        body = r.json()
    except ValueError:
        body = None
    if not isinstance(body, dict):
        raise AgentError(503, UNAVAILABLE)
    if r.status_code != 200:
        if not isinstance(body.get("error"), str) or not isinstance(body.get("message"), str):
            raise AgentError(503, UNAVAILABLE)
        raise AgentError(r.status_code, body)
    return body


async def step(
    *,
    conversation_id: str,
    kind: str,
    store_id: str,
    order_id: str,
    instruction: str | None,
    result: dict[str, Any] | None,
) -> dict[str, Any]:
    """한 걸음 — {"action": …} 또는 {"done": …}. kind는 대화 종류(item | cart_check)."""
    return await _post(
        "/agent/step",
        {
            "conversation_id": conversation_id,
            "kind": kind,
            "store_id": store_id,
            "order_id": order_id,
            "instruction": instruction,
            "result": result,
        },
    )


async def filter_candidates(
    *, store_id: str, name: str, unit: str, candidates: list[dict[str, Any]]
) -> list[str]:
    """예상 단가 후보 거르기 — 같은 식자재로 남길 후보 ref."""
    body = await _post(
        "/agent/filter",
        {
            "store_id": store_id,
            "ingredient": {"name": name, "unit": unit},
            "candidates": candidates,
        },
    )
    keep = body.get("keep")
    if not isinstance(keep, list):
        raise AgentError(503, UNAVAILABLE)
    return [str(ref) for ref in keep]
