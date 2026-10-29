"""LLM·분류기는 가짜, Redis는 fakeredis. ASGITransport는 수명주기를 돌리지 않는다."""

from __future__ import annotations

import copy
from collections.abc import AsyncIterator
from typing import Any

import pytest
import pytest_asyncio
from fakeredis import FakeAsyncRedis
from httpx import ASGITransport, AsyncClient

from app import llm
from app.config import get_settings
from app.llm import LLMError, ToolCall, Verdict
from app.main import app
from app.redis_client import set_redis


class FakeLLM:
    """answers를 차례로 돌려준다(비면 read_elements). 예외면 던진다."""

    def __init__(self) -> None:
        self.answers: list[ToolCall | Exception] = []
        self.calls: list[dict[str, Any]] = []
        self._n = 0

    async def call(self, messages: list[dict[str, Any]], tools: list[dict[str, Any]]) -> ToolCall:
        self.calls.append(
            {"messages": copy.deepcopy(messages), "tools": [t["function"]["name"] for t in tools]}
        )
        self._n += 1
        answer = self.answers.pop(0) if self.answers else tool("read_elements")
        if isinstance(answer, Exception):
            raise answer
        return ToolCall(id=f"call_{self._n}", name=answer.name, args=answer.args)


class FakeGuard:
    """verdicts를 차례로 돌려준다(비면 승인)."""

    def __init__(self) -> None:
        self.verdicts: list[Verdict | Exception] = []
        self.texts: list[str] = []

    async def judge(self, text: str) -> Verdict:
        self.texts.append(text)
        verdict = self.verdicts.pop(0) if self.verdicts else Verdict(approved=True, reason="")
        if isinstance(verdict, Exception):
            raise verdict
        return verdict


def tool(name: str, **args: Any) -> ToolCall:
    return ToolCall(id="", name=name, args=args)


def format_error() -> LLMError:
    return LLMError("도구 호출이 아닌 답")


@pytest.fixture(autouse=True)
def redis() -> FakeAsyncRedis:
    fake = FakeAsyncRedis(decode_responses=False)
    set_redis(fake)
    return fake


@pytest.fixture(autouse=True)
def fake_llm(monkeypatch: pytest.MonkeyPatch) -> FakeLLM:
    fake = FakeLLM()
    monkeypatch.setattr(llm, "get_llm_client", lambda: fake)
    return fake


@pytest.fixture(autouse=True)
def fake_guard(monkeypatch: pytest.MonkeyPatch) -> FakeGuard:
    # 판정만 가짜로 바꾼다. 켜고 끄기는 실제 설정(get_guard_client)을 탄다 — 테스트 기본은 꺼짐
    fake = FakeGuard()
    monkeypatch.setattr(llm.OpenAIChatGuard, "judge", lambda self, text: fake.judge(text))
    monkeypatch.setattr(get_settings(), "LLM_GUARD_ENABLED", False)
    return fake


@pytest.fixture
def guard_on(monkeypatch: pytest.MonkeyPatch) -> None:
    s = get_settings()
    monkeypatch.setattr(s, "LLM_GUARD_ENABLED", True)
    monkeypatch.setattr(s, "LLM_GUARD_BASE_URL", "http://guard.test/v1")
    monkeypatch.setattr(s, "LLM_GUARD_MODEL", "guard-model")


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://agent") as c:
        yield c
