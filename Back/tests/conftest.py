"""pytest fixtures — auth_test 통합 테스트.

ASGITransport로 in-process FastAPI 호출. DB는 compose 내 실 MySQL 사용,
테스트 이메일은 `@auth-test.local` 도메인으로 고정해 세션 종료 시 일괄 정리.
"""
from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.db as app_db
from app.config import get_settings
from app.main import app
from app.models.user import User

# 운영용 engine을 NullPool 기반 engine으로 교체 — pytest-asyncio가 함수별
# 이벤트 루프를 만들더라도 connection이 매번 새로 열려/닫혀 loop 바인딩
# 문제가 발생하지 않음. import 시점에 한 번만 실행.
_test_engine = create_async_engine(
    get_settings().database_url_async, poolclass=NullPool, future=True
)
_test_session_local = async_sessionmaker(
    _test_engine, expire_on_commit=False, autoflush=False
)
app_db.engine = _test_engine
app_db.SessionLocal = _test_session_local

TEST_EMAIL_PREFIX = "pytest-auth-"
TEST_EMAIL_DOMAIN = "example.com"


def make_test_email(tag: str = "u") -> str:
    return f"{TEST_EMAIL_PREFIX}{tag}-{uuid.uuid4().hex[:10]}@{TEST_EMAIL_DOMAIN}"


@pytest_asyncio.fixture(loop_scope="session")
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://localhost") as c:
        yield c


@pytest_asyncio.fixture(autouse=True, loop_scope="session")
async def _cleanup_test_users() -> AsyncIterator[None]:
    yield
    async with app_db.SessionLocal() as session:
        # sale_records / menus는 stores FK가 CASCADE가 아니라 user 삭제 시
        # stores 삭제가 막힐 수 있다. user에 매달린 store_id 단위로 선삭제.
        from sqlalchemy import select as _select

        from app.models.menu import Menu
        from app.models.order import Order, OrderRecommendation
        from app.models.sale_record import SaleRecord
        from app.models.store import Store

        store_ids = (
            await session.scalars(
                _select(Store.store_id).join(User, User.user_id == Store.user_id).where(
                    User.email.like(f"{TEST_EMAIL_PREFIX}%@{TEST_EMAIL_DOMAIN}")
                )
            )
        ).all()
        if store_ids:
            # orders·order_recommendations도 stores FK가 CASCADE가 아니다. 하위 행은 DB가 연쇄 삭제
            await session.execute(delete(Order).where(Order.store_id.in_(store_ids)))
            await session.execute(
                delete(OrderRecommendation).where(OrderRecommendation.store_id.in_(store_ids))
            )
            await session.execute(
                delete(SaleRecord).where(SaleRecord.store_id.in_(store_ids))
            )
            await session.execute(delete(Menu).where(Menu.store_id.in_(store_ids)))
        await session.execute(
            delete(User).where(User.email.like(f"{TEST_EMAIL_PREFIX}%@{TEST_EMAIL_DOMAIN}"))
        )
        await session.commit()
