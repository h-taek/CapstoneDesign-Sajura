"""앱 공용 Redis 연결 — 수명주기에서 한 번 만들고 Service가 §12 키로 직접 쓴다 (03_be.md §1·§12)."""
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
