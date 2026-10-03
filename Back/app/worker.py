"""ARQ worker — 09_service_design.md §1, docs/plan/01_be.md M2.B1 (`arq-worker` 컨테이너).

BE 도메인 정기 작업을 cron_jobs로 돌린다. 시각은 KST 기준 (`timezone`).
"""

from __future__ import annotations

from datetime import timedelta, timezone

from arq import cron
from arq.connections import RedisSettings

import app.db as app_db
from app.config import get_settings
from app.services.account_purge_service import AccountPurgeService

KST = timezone(timedelta(hours=9))


def _redis_settings() -> RedisSettings:
    s = get_settings()
    return RedisSettings(host=s.REDIS_HOST, port=s.REDIS_PORT, database=s.REDIS_DB)


async def purge_withdrawn_accounts(ctx: dict) -> int:
    """탈퇴 유예 30일이 지난 계정 파기 — 매일 03:00 (12_security.md §3.1)."""
    async with app_db.SessionLocal() as session:
        return await AccountPurgeService(session).purge_expired()


class WorkerSettings:
    redis_settings = _redis_settings()
    timezone = KST
    functions: list = [purge_withdrawn_accounts]
    cron_jobs: list = [cron(purge_withdrawn_accounts, hour=3, minute=0)]
