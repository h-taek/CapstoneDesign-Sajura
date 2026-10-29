"""POST /agent/filter — 03_be.md §2.4.6."""

from __future__ import annotations

from datetime import datetime
from typing import Any

import pytest
from fakeredis import FakeAsyncRedis
from httpx import AsyncClient

from app.llm import Verdict
from app.service import KST
from tests.conftest import FakeGuard, FakeLLM, tool

STORE = "store-1"


def candidates(n: int) -> list[dict[str, Any]]:
    return [
        {"ref": str(i), "product_name": f"국내산 양파 {i}", "option_name": "3kg, 1개"}
        for i in range(1, n + 1)
    ]


async def post(client: AsyncClient, cands: list[dict[str, Any]]) -> Any:
    return await client.post(
        "/agent/filter",
        json={"store_id": STORE, "ingredient": {"name": "양파", "unit": "g"}, "candidates": cands},
    )


async def test_51_candidates_is_400(client: AsyncClient, fake_llm: FakeLLM) -> None:
    r = await post(client, candidates(51))
    assert r.status_code == 400
    assert fake_llm.calls == []


async def test_keep_drops_unknown_refs(client: AsyncClient, fake_llm: FakeLLM) -> None:
    fake_llm.answers = [tool("keep_candidates", refs=["2", "99", "1", "2"])]
    r = await post(client, candidates(3))
    assert r.status_code == 200
    assert r.json() == {"keep": ["2", "1"]}
    sent = fake_llm.calls[0]
    assert sent["tools"] == ["keep_candidates"]
    assert "<coupang_products>" in sent["messages"][1]["content"]
    assert "[1] 국내산 양파 1 | 옵션: 3kg, 1개" in sent["messages"][1]["content"]


@pytest.mark.usefixtures("guard_on")
async def test_guard_reject_is_422(
    client: AsyncClient, fake_llm: FakeLLM, fake_guard: FakeGuard
) -> None:
    fake_guard.verdicts = [Verdict(approved=False, reason="상품명에 지시가 있습니다.")]
    r = await post(client, candidates(2))
    assert r.status_code == 422
    assert r.json()["detail"] == {"reason": "상품명에 지시가 있습니다."}
    assert fake_llm.calls == []


async def test_counts_in_store_daily_calls(
    client: AsyncClient, fake_llm: FakeLLM, redis: FakeAsyncRedis
) -> None:
    fake_llm.answers = [tool("keep_candidates", refs=["1"])]
    await post(client, candidates(1))
    day = datetime.now(KST).strftime("%Y%m%d")
    assert await redis.get(f"agent:calls:store:{STORE}:{day}") == b"1"
    assert await redis.get(f"agent:calls:all:{day}") == b"1"
    await redis.set(f"agent:calls:store:{STORE}:{day}", 300)
    r = await post(client, candidates(1))
    assert r.status_code == 429
