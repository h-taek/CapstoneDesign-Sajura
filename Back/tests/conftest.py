"""pytest fixtures — auth_test 통합 테스트.

ASGITransport로 in-process FastAPI 호출. DB는 compose 내 실 MySQL 사용,
테스트 이메일은 `@auth-test.local` 도메인으로 고정해 세션 종료 시 일괄 정리.
"""
from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from fakeredis import FakeAsyncRedis
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

import app.db as app_db
from app.config import get_settings
from app.core.rate_limit import init_rate_limit
from app.core.redis import set_redis
from app.integrations import agent, geocoding
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
TEST_COUPANG_PREFIX = "999"  # 테스트가 만드는 쿠팡 itemId·productId 앞자리
CLICK = {"action": {"tool": "click", "args": {"ref": "1"}}}


def make_test_email(tag: str = "u") -> str:
    return f"{TEST_EMAIL_PREFIX}{tag}-{uuid.uuid4().hex[:10]}@{TEST_EMAIL_DOMAIN}"


TEST_PASSWORD = "Passw0rd!"


def make_biz_no() -> str:
    """국세청 stub 모드에서 통과하는 형식의 사업자번호 — 테스트마다 달라 중복 충돌이 없다."""
    n = uuid.uuid4().int
    return f"{n % 1000:03d}-{(n // 1000) % 100:02d}-{(n // 100000) % 100000:05d}"


def cert_file() -> dict:
    """multipart 업로드용 더미 사업자등록증(PNG 헤더)."""
    return {"cert": ("cert.png", b"\x89PNG\r\n\x1a\n_dummy_cert_", "image/png")}


async def register_user(
    client: AsyncClient, email: str, *, password: str = TEST_PASSWORD, name: str = "테스터",
    business_no: str | None = None,
) -> dict:
    """사업자 인증까지 마친 이메일 회원가입 — 가입 즉시 로그인 응답을 돌려준다 (02 §3.2).

    business_no를 주면 등록증과 함께 내 PENDING, 주지 않으면 마스터 코드로 VERIFIED.
    """
    files = cert_file() if business_no else None
    if business_no is None:
        business_no = get_settings().NTS_MASTER_BYPASS_CODE
        if not business_no:
            pytest.skip("NTS_MASTER_BYPASS_CODE 미설정")
    r = await client.post(
        "/api/auth/register",
        data={"email": email, "password": password, "name": name, "business_no": business_no},
        files=files,
    )
    assert r.status_code == 201, r.text
    return r.json()


@pytest_asyncio.fixture(autouse=True, loop_scope="function")
async def _rate_limit_store() -> None:
    # ASGITransport는 lifespan을 돌리지 않는다. 테스트마다 빈 저장소로 시작해 횟수를 나눈다
    fake = FakeAsyncRedis()
    set_redis(fake)
    await init_rate_limit(fake)


@pytest.fixture(autouse=True)
def _no_real_geocoding(monkeypatch: pytest.MonkeyPatch) -> None:
    # 매장 주소 저장마다 Google을 부르지 않게 한다 — 위치가 필요한 테스트는 다시 바꿔 끼운다
    async def _none(address: str) -> None:
        return None

    monkeypatch.setattr(geocoding, "geocode", _none)


class FakeAgent:
    """담기 에이전트 서버 대역. answers를 차례로 돌려주고(비면 클릭), 예외면 던진다.

    filter_answer가 None이면 받은 후보를 모두 남긴다.
    """

    def __init__(self) -> None:
        self.answers: list[dict | Exception] = []
        self.steps: list[dict] = []
        self.filter_answer: list[str] | Exception | None = None
        self.filters: list[dict] = []

    async def step(self, **kwargs) -> dict:
        self.steps.append(kwargs)
        answer = self.answers.pop(0) if self.answers else CLICK
        if isinstance(answer, Exception):
            raise answer
        return answer

    async def filter_candidates(self, **kwargs) -> list[str]:
        self.filters.append(kwargs)
        if isinstance(self.filter_answer, Exception):
            raise self.filter_answer
        if self.filter_answer is None:
            return [c["ref"] for c in kwargs["candidates"]]
        return self.filter_answer


@pytest.fixture(autouse=True)
def fake_agent(monkeypatch: pytest.MonkeyPatch) -> FakeAgent:
    # 담기 에이전트 서버를 실제로 부르지 않게 한다
    fake = FakeAgent()
    monkeypatch.setattr(agent, "step", fake.step)
    monkeypatch.setattr(agent, "filter_candidates", fake.filter_candidates)
    return fake


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

        from app.models.forecast import ForecastResult, PipelineJob
        from app.models.inventory_item import DisposalLog, InventoryAdjustmentLog
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
            # 조정·폐기 이력은 stores·users FK가 CASCADE가 아니다
            await session.execute(
                delete(InventoryAdjustmentLog).where(InventoryAdjustmentLog.store_id.in_(store_ids))
            )
            await session.execute(delete(DisposalLog).where(DisposalLog.store_id.in_(store_ids)))
            # 예측(메뉴 수량은 CASCADE)·실행 이력도 stores FK가 CASCADE가 아니다.
            # 예측 메뉴 수량이 메뉴를 참조하니 메뉴보다 먼저 지운다
            await session.execute(
                delete(ForecastResult).where(ForecastResult.store_id.in_(store_ids))
            )
            await session.execute(delete(PipelineJob).where(PipelineJob.store_id.in_(store_ids)))
            await session.execute(delete(Menu).where(Menu.store_id.in_(store_ids)))
        await session.execute(
            delete(User).where(User.email.like(f"{TEST_EMAIL_PREFIX}%@{TEST_EMAIL_DOMAIN}"))
        )
        # 공용 쿠팡 상품은 매장에 속하지 않는다 — 재료(매장과 함께 삭제)가 지워진 뒤 정리
        from app.models.coupang import CoupangProduct

        await session.execute(
            delete(CoupangProduct).where(CoupangProduct.item_id.like(f"{TEST_COUPANG_PREFIX}%"))
        )
        await session.commit()
