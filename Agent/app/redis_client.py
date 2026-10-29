"""Redis 연결 — 수명주기에서 한 번 만든다. 대화 기록과 호출 횟수를 둔다 (03_be.md §2.4)."""

from __future__ import annotations

from redis.asyncio import Redis

_client: Redis | None = None


def set_redis(client: Redis) -> None:
    global _client
    _client = client


def get_redis() -> Redis:
    if _client is None:
        raise RuntimeError("Redis가 초기화되지 않았다")
    return _client
