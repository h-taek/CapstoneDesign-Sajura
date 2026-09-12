"""ARQ worker stub — 09_service_design.md §1, plan phase_02 §M2.B1 (`arq-worker` 컨테이너).

실제 잡/cron 함수는 후속 phase에서 채워 넣는다. 본 stub은 Compose
`arq-worker` 서비스가 빈 워커로 기동되도록 최소 WorkerSettings만 둔다.
"""
from __future__ import annotations

from arq.connections import RedisSettings

from app.config import get_settings


def _redis_settings() -> RedisSettings:
    s = get_settings()
    return RedisSettings(host=s.REDIS_HOST, port=s.REDIS_PORT, database=s.REDIS_DB)


async def _noop(ctx: dict) -> str:
    """Phase 2 placeholder — ARQ는 함수 0개로는 기동 거부."""
    return "ok"


class WorkerSettings:
    redis_settings = _redis_settings()
    functions: list = [_noop]
    cron_jobs: list = []
