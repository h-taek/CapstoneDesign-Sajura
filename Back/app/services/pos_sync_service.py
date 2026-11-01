"""PosSyncService — POS API 연동 매장의 판매 동기화 (01_basic_design.md §3.4.3).

- 수동: POST /api/store/pos/sync, 자동: arq-worker 매일 01:00 (02:00 예측 배치 전),
  연동 등록·변경 직후: arq 작업 sync_pos_store (enqueue_sync).
- 첫 동기화(last_synced_at 없음)는 BACKFILL_START 부터 전체 이력, 이후는 마지막 동기화
  2일 전부터 겹쳐 받는다 — 늦게 취소된 주문·경계 누락을 다시 받아도
  external_sale_id UNIQUE 로 중복 저장되지 않는다.
- 실패하면 pos_connections.status=ERROR·error_message 기록, 성공하면 CONNECTED 로 되돌린다.
- 현재 TOSSPLACE 만 구현. 다른 POS 는 NOT_SUPPORTED 로 응답한다(키움페이·OKPOS 후속).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import structlog
from arq.connections import ArqRedis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.pos.tossplace_adapter import (
    KST,
    TossPlaceAdapter,
    TossPlaceClient,
    TossPlaceError,
    order_prefix,
)
from app.config import get_settings
from app.core import errors
from app.core.redis import get_redis
from app.models.pos_connection import PosConnection, PosStatus
from app.services.sale_service import SaleService

log = structlog.get_logger(__name__)

BACKFILL_START = datetime(2024, 1, 1, tzinfo=KST)
OVERLAP = timedelta(days=2)


@dataclass
class SyncResult:
    synced_at: datetime
    records_synced: int
    orders_seen: int = 0
    cancelled_orders: int = 0
    auto_created_menus: int = 0


class PosSyncService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def sync(self, pos: PosConnection) -> SyncResult:
        if pos.pos_type != "TOSSPLACE":
            raise errors.DomainError(
                status_code=400, error_code="POS_NOT_SUPPORTED",
                message=(
                    "이 POS는 아직 자동 동기화를 지원하지 않습니다. "
                    "판매 데이터는 CSV로 올려 주세요."
                ),
            )
        now_kst = datetime.now(KST)
        start = (
            BACKFILL_START if pos.last_synced_at is None
            else pos.last_synced_at.replace(tzinfo=UTC).astimezone(KST) - OVERLAP
        )
        s = get_settings()
        try:
            async with TossPlaceClient(access_key=s.TOSSPLACE_ACCESS_KEY,
                                       access_secret=s.TOSSPLACE_ACCESS_SECRET,
                                       base_url=s.TOSSPLACE_BASE_URL) as client:
                orders = await client.list_orders(pos.store_code, start=start, end=now_kst)
        except TossPlaceError as exc:
            pos.status = PosStatus.ERROR
            pos.error_message = str(exc)[:500]
            await self.session.commit()
            log.warning("pos_sync_failed", store_id=pos.store_id, error=str(exc))
            raise errors.DomainError(
                status_code=503, error_code="POS_SYNC_FAILED", message=str(exc)
            ) from exc

        norm = TossPlaceAdapter().normalize_orders(orders)
        result = await SaleService(self.session).ingest_pos_sales(
            store_id=pos.store_id, sales=norm.sales,
            cancelled_prefixes=[order_prefix(o) for o in norm.cancelled_order_ids],
        )
        pos.status = PosStatus.CONNECTED
        pos.error_message = None
        pos.last_synced_at = datetime.now(UTC).replace(tzinfo=None)
        await self.session.commit()
        cancelled = len(norm.cancelled_order_ids)
        log.info("pos_synced", store_id=pos.store_id, orders=norm.orders_seen,
                 imported=result.imported, cancelled=cancelled, skipped=result.skipped)
        return SyncResult(
            synced_at=pos.last_synced_at, records_synced=result.imported,
            orders_seen=norm.orders_seen, cancelled_orders=cancelled,
            auto_created_menus=result.auto_created_menus,
        )

    async def sync_all(self) -> int:
        """worker 용 — 연동된 TOSSPLACE 매장 전부. 한 매장 실패가 다른 매장을 막지 않는다."""
        store_ids = (
            await self.session.scalars(
                select(PosConnection.store_id).where(
                    PosConnection.pos_type == "TOSSPLACE",
                    PosConnection.status.in_([PosStatus.CONNECTED, PosStatus.ERROR]),
                )
            )
        ).all()
        done = 0
        for store_id in store_ids:
            done += await self.sync_store(store_id)
        return done

    async def sync_store(self, store_id: str) -> int:
        """worker 용 — 매장 하나. 성공 1·실패 0, 실패는 연동 상태(ERROR)에 남긴다.

        매장마다 다시 읽는다 — 앞 매장에서 롤백하면 세션의 객체가 모두 만료된다.
        """
        pos = await self.session.scalar(
            select(PosConnection).where(PosConnection.store_id == store_id)
        )
        if pos is None or pos.pos_type != "TOSSPLACE":
            return 0
        try:
            await self.sync(pos)
            return 1
        except errors.DomainError:
            return 0
        except Exception:
            log.exception("pos_sync_crashed", store_id=store_id)
            await self.session.rollback()
            await self.session.refresh(pos)
            pos.status = PosStatus.ERROR
            pos.error_message = "판매 데이터를 저장하지 못했습니다."
            await self.session.commit()
            return 0


async def enqueue_sync(store_id: str) -> None:
    """연동 등록·변경 직후 동기화를 arq-worker에 넣는다 (worker.sync_pos_store).

    넣지 못해도 연동은 유지한다 — last_synced_at이 비어 있어 매일 01:00 동기화가 전체 이력을 받는다.
    """
    try:
        await ArqRedis(connection_pool=get_redis().connection_pool).enqueue_job(
            "sync_pos_store", store_id
        )
    except Exception:
        log.warning("pos_sync_enqueue_failed", store_id=store_id, exc_info=True)
