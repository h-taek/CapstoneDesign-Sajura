"""담기 걸음·예상 단가 후보 거르기 — 03_be.md §2.4.

한 걸음은 대화 기록 → 요청 크기 → 호출 횟수 → 보안 분류기 → 에이전트 LLM → 답 형식 검사 순서다.
규칙·분류기에서 거부된 걸음은 LLM까지 가지 않는다.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta, timezone
from typing import Any, TypeVar

from pydantic import ValidationError
from redis.asyncio import Redis

from app import errors, llm
from app.llm import LLMClient, LLMError, ToolCall
from app.prompts import (
    AGENT_SYSTEM,
    FILTER_SYSTEM,
    PREVIOUS_SCREEN,
    render_action,
    render_candidates,
    render_elements,
)
from app.redis_client import get_redis
from app.schemas import ElementsResult, FilterRequest, StepRequest
from app.tools import DONE_TOOLS, KEEP_CANDIDATES, Tool, tools_for

log = logging.getLogger("agent")
T = TypeVar("T")

KST = timezone(timedelta(hours=9))
CONV_TTL_SECONDS = 3600
DAY_TTL_SECONDS = 2 * 24 * 3600
RESULT_MAX_CHARS = 150_000
CONV_LIMIT = 40
STORE_DAY_LIMIT = 300
TOTAL_DAY_LIMIT = 3000
ATTEMPTS = 4  # 처음 1회 + 다시 보내기 3회. 다시 보낸 호출은 호출 횟수에 세지 않는다


def _conv_key(conversation_id: str) -> str:
    return f"agent:conv:{conversation_id}"


async def _within(redis: Redis, key: str, limit: int, ttl: int) -> bool:
    n = await redis.incr(key)
    if n == 1:
        await redis.expire(key, ttl)
    return n <= limit


async def _count_call(redis: Redis, *, store_id: str, conversation_id: str | None) -> None:
    """에이전트 LLM 호출 1회를 센다 — 대화 40·매장 하루 300·전체 하루 3,000 (§2.4.2)."""
    day = datetime.now(KST).strftime("%Y%m%d")
    if conversation_id is not None and not await _within(
        redis, f"agent:calls:conv:{conversation_id}", CONV_LIMIT, CONV_TTL_SECONDS
    ):
        raise errors.quota_exceeded()
    if not await _within(
        redis, f"agent:calls:store:{store_id}:{day}", STORE_DAY_LIMIT, DAY_TTL_SECONDS
    ):
        raise errors.quota_exceeded()
    if not await _within(redis, f"agent:calls:all:{day}", TOTAL_DAY_LIMIT, DAY_TTL_SECONDS):
        raise errors.quota_exceeded()


async def _retry(call: Callable[[], Awaitable[T]], *, what: str) -> T:
    for attempt in range(1, ATTEMPTS + 1):
        try:
            return await call()
        except LLMError as exc:
            log.warning("%s 실패 (%d/%d): %s", what, attempt, ATTEMPTS, exc)
    raise errors.unavailable()


async def _guard(text: str, *, store_id: str, order_id: str | None) -> None:
    """보안 분류기 — 켜졌을 때만. 거부면 422 (§2.4.3)."""
    guard = llm.get_guard_client()
    if guard is None:
        return
    verdict = await _retry(lambda: guard.judge(text), what="분류기")
    log.info(
        "guard_verdict store_id=%s order_id=%s decision=%s reason=%s",
        store_id, order_id, "APPROVE" if verdict.approved else "REJECT", verdict.reason,
    )
    if not verdict.approved:
        raise errors.guard_rejected(verdict.reason)


async def _ask(
    client: LLMClient, messages: list[dict[str, Any]], tools: dict[str, Tool]
) -> tuple[ToolCall, dict[str, Any]]:
    """LLM 호출 하나와 답 형식 검사. 없는 도구·스키마에 맞지 않는 인자는 형식 오류다."""
    call = await client.call(messages, [t.spec() for t in tools.values()])
    tool = tools.get(call.name)
    if tool is None:
        raise LLMError(f"쓸 수 없는 도구: {call.name}")
    try:
        args = tool.args.model_validate(call.args).model_dump()
    except ValidationError as exc:
        raise LLMError(f"{call.name} 인자 오류: {exc}") from exc
    return call, args


async def step(req: StepRequest) -> dict[str, Any]:
    redis = get_redis()
    key = _conv_key(req.conversation_id)

    if req.instruction is not None:
        if req.result is not None:
            raise errors.validation_error("새 대화에는 실행 결과를 보내지 않습니다.")
        conv: dict[str, Any] = {
            "kind": req.kind,
            "messages": [{"role": "user", "content": req.instruction}],
            "screen": None,  # 가장 최근 요소 목록 메시지의 위치
            "pending": None,  # 실행 결과를 기다리는 도구 호출 ID
        }
        new_input = req.instruction
    else:
        raw = await redis.get(key)
        if raw is None:
            raise errors.validation_error("진행 중인 대화가 없습니다.")
        conv = json.loads(raw)
        if req.result is None:
            raise errors.validation_error("직전 실행 결과가 필요합니다.")
        size = len(json.dumps(req.result.model_dump(mode="json"), ensure_ascii=False))
        if size > RESULT_MAX_CHARS:
            raise errors.validation_error("실행 결과가 너무 큽니다.")
        if isinstance(req.result, ElementsResult):
            new_input = render_elements(req.result)
            if conv["screen"] is not None:
                conv["messages"][conv["screen"]]["content"] = PREVIOUS_SCREEN
            conv["screen"] = len(conv["messages"])
        else:
            new_input = render_action(req.result)
        conv["messages"].append(
            {"role": "tool", "tool_call_id": conv["pending"], "content": new_input}
        )

    await _count_call(redis, store_id=req.store_id, conversation_id=req.conversation_id)
    await _guard(new_input, store_id=req.store_id, order_id=req.order_id)

    client = llm.get_llm_client()
    messages = [{"role": "system", "content": AGENT_SYSTEM}, *conv["messages"]]
    tools = tools_for(conv["kind"])
    call, args = await _retry(lambda: _ask(client, messages, tools), what="에이전트 LLM")

    if call.name in DONE_TOOLS:
        await redis.delete(key)
        return {"done": {"tool": call.name, "args": args}}
    conv["messages"].append(
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": call.id,
                    "type": "function",
                    "function": {
                        "name": call.name,
                        "arguments": json.dumps(args, ensure_ascii=False),
                    },
                }
            ],
        }
    )
    conv["pending"] = call.id
    await redis.set(key, json.dumps(conv, ensure_ascii=False), ex=CONV_TTL_SECONDS)
    return {"action": {"tool": call.name, "args": args}}


async def filter_candidates(req: FilterRequest) -> dict[str, Any]:
    """같은 식자재로 남길 후보 ref (§2.4.6). 받지 않은 ref는 버린다."""
    redis = get_redis()
    text = render_candidates(req.ingredient, req.candidates)
    await _count_call(redis, store_id=req.store_id, conversation_id=None)
    await _guard(text, store_id=req.store_id, order_id=None)

    client = llm.get_llm_client()
    messages = [
        {"role": "system", "content": FILTER_SYSTEM},
        {"role": "user", "content": text},
    ]
    tools = {KEEP_CANDIDATES.name: KEEP_CANDIDATES}
    _, args = await _retry(lambda: _ask(client, messages, tools), what="후보 거르기 LLM")
    received = {c.ref for c in req.candidates}
    return {"keep": list(dict.fromkeys(r for r in args["refs"] if r in received))}
