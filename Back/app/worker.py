"""ARQ worker — 03_be.md §1, docs/plan/01_be.md M2.B1 (`arq-worker` 컨테이너).

BE 도메인 정기 작업을 cron_jobs로 돌린다. 시각은 KST 기준 (`timezone`).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from arq import cron
from arq.connections import RedisSettings

import app.db as app_db
from app.config import get_settings
from app.services.account_purge_service import AccountPurgeService
from app.services.automation_service import AutomationService
from app.services.inventory_service import InventoryService
from app.services.pos_sync_service import PosSyncService

KST = timezone(timedelta(hours=9))


def _redis_settings() -> RedisSettings:
    s = get_settings()
    return RedisSettings(host=s.REDIS_HOST, port=s.REDIS_PORT, database=s.REDIS_DB)


async def check_expiry(ctx: dict) -> int:
    """소비기한 D-3·D-1·초과 알림 — 매일 01:30 (01_basic_design.md §3.3.6)."""
    async with app_db.SessionLocal() as session:
        return await InventoryService(session).check_expiry_batch(today=datetime.now(KST).date())


async def purge_withdrawn_accounts(ctx: dict) -> int:
    """탈퇴 유예 30일이 지난 계정 파기 — 매일 03:00 (01_basic_design.md §5.2.1)."""
    async with app_db.SessionLocal() as session:
        return await AccountPurgeService(session).purge_expired()


async def clear_coupang_store_prices(ctx: dict) -> int:
    """쿠팡 매장 가격 삭제 — 이틀마다 00:00 (01_basic_design.md §3.3.1). 날짜 순번이 짝수인 날만."""
    async with app_db.SessionLocal() as session:
        return await AutomationService(session).clear_store_prices(today=datetime.now(KST).date())


async def sync_pos_sales(ctx: dict) -> int:
    """POS 연동 매장 판매 동기화 — 매일 01:00, 02:00 예측 전 (01_basic_design.md §3.4.3)."""
    async with app_db.SessionLocal() as session:
        return await PosSyncService(session).sync_all()


async def sync_pos_store(ctx: dict, store_id: str) -> int:
    """POS 연동 등록·변경 직후 동기화 — 전체 이력 (01_basic_design.md §3.4.3). BE가 넣는다."""
    async with app_db.SessionLocal() as session:
        return await PosSyncService(session).sync_store(store_id)


class WorkerSettings:
    redis_settings = _redis_settings()
    timezone = KST
    functions: list = [
        check_expiry, purge_withdrawn_accounts, clear_coupang_store_prices, sync_pos_sales,
        sync_pos_store,
    ]
    cron_jobs: list = [
        cron(clear_coupang_store_prices, hour=0, minute=0),
        cron(sync_pos_sales, hour=1, minute=0),
        cron(check_expiry, hour=1, minute=30),
        cron(purge_withdrawn_accounts, hour=3, minute=0),
    ]
