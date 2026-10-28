"""LLM 클라이언트 — 03_be.md §2.4.

Service는 `LLMClient.complete` 하나만 부른다. 입력은 프롬프트와 응답 스키마(Pydantic), 출력은
그 스키마로 검증한 객체다. 제공자는 환경변수로 고르고, 호출 실패·검증 실패는 재시도하지 않고
`LLMError`로 올린다.
"""

from __future__ import annotations

import json
from typing import Any, Protocol, TypeVar

from pydantic import BaseModel, ValidationError

from app.config import get_settings

T = TypeVar("T", bound=BaseModel)

SELECT_TIMEOUT_SECONDS = 120.0
GUARD_TIMEOUT_SECONDS = 60.0
MAX_OUTPUT_TOKENS = 8192


class LLMError(Exception):
    """호출 실패 또는 응답이 스키마에 맞지 않음."""


class LLMClient(Protocol):
    async def complete(self, *, system: str, user: str, schema: type[T]) -> T: ...


def parse_json(text: str | None, schema: type[T]) -> T:
    """답 글에서 JSON 객체를 꺼내 스키마로 검증한다. 코드 울타리(```json)나 앞뒤 글은 무시한다."""
    if not text:
        raise LLMError("빈 응답")
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise LLMError("JSON 없음")
    try:
        return schema.model_validate(json.loads(text[start : end + 1]))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise LLMError(f"스키마 불일치: {exc}") from exc


class OpenAICompatibleClient:
    """OpenAI API·대회 게이트웨이·OpenAI 호환 로컬 서버(Ollama 등). base_url만 다르다."""

    def __init__(
        self,
        *,
        model: str,
        api_key: str,
        base_url: str,
        reasoning_effort: str = "",
        timeout: float = SELECT_TIMEOUT_SECONDS,
    ) -> None:
        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.reasoning_effort = reasoning_effort
        self.timeout = timeout

    async def complete(self, *, system: str, user: str, schema: type[T]) -> T:
        from openai import AsyncOpenAI, OpenAIError

        # 키가 필요 없는 로컬 서버도 SDK는 빈 키를 거절한다
        client = AsyncOpenAI(
            api_key=self.api_key or "unused",
            base_url=self.base_url or None,
            timeout=self.timeout,
            max_retries=0,
        )
        kwargs: dict[str, Any] = {}
        if self.reasoning_effort:
            kwargs["reasoning_effort"] = self.reasoning_effort
        try:
            resp = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                **kwargs,
            )
        except OpenAIError as exc:
            raise LLMError(f"호출 실패: {exc}") from exc
        finally:
            await client.close()
        if not resp.choices:
            raise LLMError("빈 응답")
        return parse_json(resp.choices[0].message.content, schema)


class AnthropicClient:
    """Anthropic Claude API."""

    def __init__(self, *, model: str, api_key: str, reasoning_effort: str = "") -> None:
        self.model = model
        self.api_key = api_key
        self.reasoning_effort = reasoning_effort

    async def complete(self, *, system: str, user: str, schema: type[T]) -> T:
        from anthropic import AnthropicError, AsyncAnthropic

        client = AsyncAnthropic(
            api_key=self.api_key, timeout=SELECT_TIMEOUT_SECONDS, max_retries=0
        )
        kwargs: dict[str, Any] = {}
        if self.reasoning_effort:
            kwargs["output_config"] = {"effort": self.reasoning_effort}
        try:
            resp = await client.messages.create(
                model=self.model,
                max_tokens=MAX_OUTPUT_TOKENS,
                system=system,
                messages=[{"role": "user", "content": user}],
                **kwargs,
            )
        except AnthropicError as exc:
            raise LLMError(f"호출 실패: {exc}") from exc
        finally:
            await client.close()
        text = "".join(b.text for b in resp.content if b.type == "text")
        return parse_json(text, schema)


def get_llm_client() -> LLMClient:
    """상품 선택 LLM (03_be.md §2.4). 제공자 간 자동 전환은 하지 않는다."""
    s = get_settings()
    if s.LLM_PROVIDER == "anthropic":
        return AnthropicClient(
            model=s.LLM_MODEL, api_key=s.LLM_API_KEY, reasoning_effort=s.LLM_REASONING_EFFORT
        )
    return OpenAICompatibleClient(
        model=s.LLM_MODEL,
        api_key=s.LLM_API_KEY,
        base_url=s.LLM_BASE_URL,
        reasoning_effort=s.LLM_REASONING_EFFORT,
    )


def get_guard_client() -> LLMClient | None:
    """보안 분류기 (03_be.md §2.4.3). 꺼져 있으면 None — 부르지 않는다. 생각 모드는 끈다."""
    s = get_settings()
    if not s.LLM_GUARD_ENABLED:
        return None
    return OpenAICompatibleClient(
        model=s.LLM_GUARD_MODEL,
        api_key="",
        base_url=s.LLM_GUARD_BASE_URL,
        reasoning_effort="none",  # Ollama는 이 값으로 생각 모드를 끈다
        timeout=GUARD_TIMEOUT_SECONDS,
    )
