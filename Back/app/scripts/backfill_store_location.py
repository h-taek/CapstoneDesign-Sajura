"""주소는 있는데 위치가 빈 매장의 위치 5칸을 채운다 (docs/plan/09_weather.md §2).

사용: docker compose exec be python -m app.scripts.backfill_store_location
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select

import app.db as app_db
from app.models.store import Store
from app.services.store_service import set_location


async def main() -> None:
    async with app_db.SessionLocal() as session:
        stores = (
            await session.scalars(
                select(Store).where(Store.address.is_not(None), Store.address != "",
                                    Store.latitude.is_(None))
            )
        ).all()
        for store in stores:
            await set_location(store)
        await session.commit()
        located = sum(1 for s in stores if s.latitude is not None)
        print(f"대상 {len(stores)}곳 — 위치 채움 {located}곳, 변환 실패 {len(stores) - located}곳")
    await app_db.engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
