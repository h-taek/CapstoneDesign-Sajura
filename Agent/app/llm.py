"""LLM·보안 분류기 클라이언트 — 03_be.md §2.4·§2.4.3.

호출 실패와 응답 형식 오류는 `LLMError`로 올린다. 다시 보내기는 Service가 한다.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Literal, Protocol

from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.prompts import GUARD_SYSTEM

LLM_TIMEOUT_SECONDS = 120.0
GUARD_TIMEOUT_SECONDS = 60.0
REASON_MAX = 200


class LLMError(Exception):
    """호출 실패 또는 응답 형식 오류 — 같은 요청을 다시 보낼 대상."""


@dataclass(frozen=True)
class ToolCall:
    id: str
    name: str
    args: dict[str, Any]


@dataclass(frozen=True)
class Verdict:
    approved: bool
    reason: str


class LLMClient(Protocol):
    async def call(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> ToolCall:
        """메시지 목록 + 도구 목록 → 도구 호출 하나."""
        ...


class GuardClient(Protocol):
    async def judge(self, text: str) -> Verdict:
        """입력 글 → 승인·거부와 사유."""
        ...


def _client(*, api_key: str, base_url: str, timeout: float) -> Any:
    from openai import AsyncOpenAI

    # 키가 필요 없는 로컬 서버도 SDK는 빈 키를 거절한다
    return AsyncOpenAI(
        api_key=api_key or "unused", base_url=base_url or None, timeout=timeout, max_retries=0
    )


class OpenAICompatibleClient:
    """OpenAI API·대회 게이트웨이·OpenAI 호환 로컬 서버. base_url만 다르다."""

    def __init__(self, *, model: str, api_key: str, base_url: str, reasoning_effort: str) -> None:
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.reasoning_effort = reasoning_effort

    async def call(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> ToolCall:
        from openai import OpenAIError

        client = _client(api_key=self.api_key, base_url=self.base_url, timeout=LLM_TIMEOUT_SECONDS)
        kwargs: dict[str, Any] = {}
        if self.reasoning_effort:
            kwargs["reasoning_effort"] = self.reasoning_effort
        try:
            resp = await client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tools,
                tool_choice="required",
                **kwargs,
            )
        except OpenAIError as exc:
            raise LLMError(f"호출 실패: {exc}") from exc
        finally:
            await client.close()
        calls = resp.choices[0].message.tool_calls if resp.choices else None
        if not calls:
            raise LLMError("도구 호출이 아닌 답")
        # 여러 개가 오면 첫 호출만 쓴다 — 한 걸음에 동작 하나
        call = calls[0]
        try:
            args = json.loads(call.function.arguments or "{}")
        except json.JSONDecodeError as exc:
            raise LLMError("도구 인자가 JSON이 아님") from exc
        if not isinstance(args, dict):
            raise LLMError("도구 인자가 객체가 아님")
        return ToolCall(id=call.id, name=call.function.name, args=args)


class _GuardAnswer(BaseModel):
    decision: Literal["APPROVE", "REJECT"]
    reason: str = ""


def parse_verdict(text: str | None) -> Verdict:
    """답 글에서 JSON 객체를 꺼낸다. 코드 울타리(```json)나 앞뒤 글은 무시한다."""
    if not text:
        raise LLMError("빈 응답")
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise LLMError("JSON 없음")
    try:
        answer = _GuardAnswer.model_validate(json.loads(text[start : end + 1]))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise LLMError(f"판정 형식 오류: {exc}") from exc
    return Verdict(approved=answer.decision == "APPROVE", reason=answer.reason[:REASON_MAX])


class OpenAIChatGuard:
    """어댑터 `openai_chat` — OpenAI 호환 채팅 모델에 판정 지시. 생각 모드는 끈다."""

    def __init__(self, *, model: str, base_url: str) -> None:
        self.model = model
        self.base_url = base_url

    async def judge(self, text: str) -> Verdict:
        from openai import OpenAIError

        client = _client(api_key="", base_url=self.base_url, timeout=GUARD_TIMEOUT_SECONDS)
        try:
            resp = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": GUARD_SYSTEM},
                    {"role": "user", "content": text},
                ],
                reasoning_effort="none",  # Ollama는 이 값으로 생각 모드를 끈다
            )
        except OpenAIError as exc:
            raise LLMError(f"분류기 호출 실패: {exc}") from exc
        finally:
            await client.close()
        if not resp.choices:
            raise LLMError("빈 응답")
        return parse_verdict(resp.choices[0].message.content)


def get_llm_client() -> LLMClient:
    s = get_settings()
    return OpenAICompatibleClient(
        model=s.LLM_MODEL,
        api_key=s.LLM_API_KEY,
        base_url=s.LLM_BASE_URL,
        reasoning_effort=s.LLM_REASONING_EFFORT,
    )


def get_guard_client() -> GuardClient | None:
    """꺼져 있으면 None — 부르지 않는다."""
    s = get_settings()
    if not s.LLM_GUARD_ENABLED:
        return None
    return OpenAIChatGuard(model=s.LLM_GUARD_MODEL, base_url=s.LLM_GUARD_BASE_URL)
