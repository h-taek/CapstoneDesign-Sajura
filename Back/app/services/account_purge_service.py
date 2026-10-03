"""AccountPurgeService — 탈퇴 유예 30일이 지난 계정 파기 (12_security.md §3.1·§4.2).

stores를 참조하는 테이블 상당수가 ON DELETE CASCADE가 아니라(08_schema.md §3) 하위 행을
참조 순서대로 먼저 지운다. ORM이 없는 테이블이 섞여 있어 SQL로 직접 지운다.
파기 완료 증빙 이메일은 알림 채널 구현 후 붙인다.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import structlog
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.store import Store
from app.models.user import User

GRACE_PERIOD = timedelta(days=30)

log = structlog.get_logger(__name__)

# 매장 소유 행 삭제 순서. menus는 recipes·recipe_ingredients를, inventory_items는 lots·item_sites를
# CASCADE로 함께 지운다. stores 자체는 users 삭제의 CASCADE로 지워진다.
_STORE_SCOPED = (
    "orders",  # order_items·order_approval_logs CASCADE
    "order_recommendations",  # order_recommendation_items CASCADE
    "sale_records",
    "forecast_results",
    "pipeline_jobs",
    "inventory_adjustment_logs",
    "disposal_logs",
    "menus",
    "inventory_items",
)


class AccountPurgeService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def purge_expired(self, *, now: datetime | None = None) -> int:
        cutoff = (now or datetime.now(UTC)).replace(tzinfo=None) - GRACE_PERIOD
        user_ids = (
            await self.session.scalars(
                select(User.user_id).where(
                    User.withdrawn_at.is_not(None), User.withdrawn_at <= cutoff
                )
            )
        ).all()
        for user_id in user_ids:
            await self._purge(user_id)
        return len(user_ids)

    async def _purge(self, user_id: str) -> None:
        store = await self.session.scalar(select(Store).where(Store.user_id == user_id))
        cert_path = store.business_cert_path if store else None
        if store is not None:
            for table in _STORE_SCOPED:
                await self.session.execute(
                    text(f"DELETE FROM {table} WHERE store_id = :store_id"),
                    {"store_id": store.store_id},
                )
        await self.session.execute(
            text("DELETE FROM users WHERE user_id = :user_id"), {"user_id": user_id}
        )
        await self.session.commit()
        if cert_path:
            Path(get_settings().UPLOAD_DIR, cert_path).unlink(missing_ok=True)
        log.info("account_purged", user_id=user_id)
