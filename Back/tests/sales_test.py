"""Phase 4 — CSVAdapter unit + /api/sales/upload integration."""
from __future__ import annotations

import io
from datetime import datetime

import pytest
from httpx import AsyncClient

from app.adapters.pos.csv_adapter import CSVAdapter, CommonSale, SkipReason
from tests.conftest import make_test_email


# ----------------------------------------------------------------------
# Unit — CSVAdapter
# ----------------------------------------------------------------------


def _adapter(with_ext: bool = False) -> CSVAdapter:
    return CSVAdapter(
        date_column="날짜",
        menu_column="메뉴명",
        quantity_column="수량",
        price_column="금액",
        external_sale_id_column="영수증번호" if with_ext else None,
    )


def test_csv_adapter_normalize_happy_path() -> None:
    row = {
        "날짜": "2026-01-15 14:30:00",
        "메뉴명": "아메리카노",
        "수량": "3",
        "금액": "13500",
        "영수증번호": "rcpt-001",
    }
    out = _adapter(with_ext=True).normalize(row, 1)
    assert isinstance(out, CommonSale)
    assert out.menu_name == "아메리카노"
    assert out.quantity == 3
    assert out.total_price == 13500
    assert out.unit_price == 4500  # 13500 / 3
    assert out.external_sale_id == "rcpt-001"
    assert out.sold_at == datetime(2026, 1, 15, 14, 30)


def test_csv_adapter_skip_missing_menu_name() -> None:
    row = {"날짜": "2026-01-15", "메뉴명": "", "수량": "1", "금액": "100"}
    out = _adapter().normalize(row, 5)
    assert isinstance(out, SkipReason)
    assert out.row_index == 5
    assert "메뉴명" in out.reason


def test_csv_adapter_skip_bad_price() -> None:
    row = {"날짜": "2026-01-15", "메뉴명": "라떼", "수량": "1", "금액": "abc"}
    out = _adapter().normalize(row, 7)
    assert isinstance(out, SkipReason)
    assert "금액" in out.reason


def test_csv_adapter_skip_bad_date() -> None:
    row = {"날짜": "not-a-date", "메뉴명": "라떼", "수량": "1", "금액": "100"}
    out = _adapter().normalize(row, 9)
    assert isinstance(out, SkipReason)
    assert "날짜" in out.reason


def test_csv_adapter_external_id_optional_and_null() -> None:
    row = {"날짜": "2026-01-15", "메뉴명": "라떼", "수량": "1", "금액": "100"}
    out = _adapter(with_ext=False).normalize(row, 1)
    assert isinstance(out, CommonSale)
    assert out.external_sale_id is None


def test_csv_adapter_price_with_comma() -> None:
    row = {"날짜": "2026-01-15", "메뉴명": "라떼", "수량": "2", "금액": "10,000"}
    out = _adapter().normalize(row, 1)
    assert isinstance(out, CommonSale)
    assert out.total_price == 10000
    assert out.unit_price == 5000


def test_csv_adapter_skip_menu_name_over_100_chars() -> None:
    long_name = "메" * 101
    row = {"날짜": "2026-01-15", "메뉴명": long_name, "수량": "1", "금액": "1000"}
    out = _adapter().normalize(row, 12)
    assert isinstance(out, SkipReason)
    assert out.row_index == 12
    assert "메뉴명" in out.reason and "100" in out.reason


# ----------------------------------------------------------------------
# Integration — POST /api/sales/upload
# ----------------------------------------------------------------------


async def _register_verified_user(client: AsyncClient) -> tuple[str, dict]:
    """register → master-code 통과(검증) → onboarding 완료 후 토큰 반환."""
    from app.config import get_settings

    master = get_settings().NTS_MASTER_BYPASS_CODE
    if not master:
        pytest.skip("NTS_MASTER_BYPASS_CODE 미설정")

    email = make_test_email()
    r = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "Passw0rd!", "name": "테스터"},
    )
    assert r.status_code == 201, r.text
    r = await client.post(
        "/api/auth/login", json={"email": email, "password": "Passw0rd!"}
    )
    assert r.status_code == 200, r.text
    tokens = r.json()
    auth = {"Authorization": f"Bearer {tokens['access_token']}"}

    r = await client.post(
        "/api/store/business/verify", data={"business_no": master}, headers=auth
    )
    assert r.status_code == 200, r.text

    # 매장 정보 입력 + 온보딩 완료
    r = await client.patch(
        "/api/store",
        json={
            "name": f"테스트매장-{email[:8]}",
            "operation_type": "HALL",
            "phone": "010-1234-5678",
            "address": "서울특별시 강남구",
            "size": "SMALL",
        },
        headers=auth,
    )
    assert r.status_code == 200, r.text
    return email, auth


async def _create_menu(client: AsyncClient, auth: dict, name: str, price: int = 4500) -> str:
    r = await client.post(
        "/api/menus",
        json={"name": name, "category": "음료", "price": price, "is_active": True,
              "use_inventory_deduction": False},
        headers=auth,
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["menu_id"]


def _csv_bytes(rows: list[str], header: str = "날짜,메뉴명,수량,금액,영수증번호") -> bytes:
    return ("\n".join([header, *rows]) + "\n").encode("utf-8")


@pytest.mark.asyncio
async def test_sales_upload_happy_path(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    await _create_menu(client, auth, "아메리카노")

    csv = _csv_bytes([
        "2026-01-15 14:30:00,아메리카노,3,13500,rcpt-001",
        "2026-01-16 10:00:00,아메리카노,1,4500,rcpt-002",
    ])
    r = await client.post(
        "/api/sales/upload",
        files={"file": ("sales.csv", io.BytesIO(csv), "text/csv")},
        data={
            "date_column": "날짜", "menu_column": "메뉴명",
            "quantity_column": "수량", "price_column": "금액",
            "external_sale_id_column": "영수증번호",
        },
        headers=auth,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["imported"] == 2
    assert body["skipped"] == 0


@pytest.mark.asyncio
async def test_sales_upload_skips_unmapped_menu_grouped(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    await _create_menu(client, auth, "아메리카노")

    csv = _csv_bytes([
        "2026-01-15,아메리카노,1,4500,r1",
        "2026-01-15,없는메뉴,1,5000,r2",
        "2026-01-16,없는메뉴,2,10000,r3",
    ])
    r = await client.post(
        "/api/sales/upload",
        files={"file": ("sales.csv", io.BytesIO(csv), "text/csv")},
        data={
            "date_column": "날짜", "menu_column": "메뉴명",
            "quantity_column": "수량", "price_column": "금액",
            "external_sale_id_column": "영수증번호",
        },
        headers=auth,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["imported"] == 1
    assert body["skipped"] == 2
    # 그룹화 — 같은 메뉴는 한 줄로, 카운트 포함.
    grouped = next((s for s in body["skipped_reasons"] if "매장 메뉴와 매핑 실패" in s), None)
    assert grouped is not None
    assert "없는메뉴" in grouped and "2행" in grouped


@pytest.mark.asyncio
async def test_sales_upload_auto_creates_menus(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    # 메뉴 미등록 상태에서 업로드 (auto_create_menus=True).
    csv = _csv_bytes([
        "2026-01-15,페페로니피자,1,18000,r1",
        "2026-01-16,로제파스타,2,22000,r2",
        "2026-01-17,페페로니피자,3,54000,r3",  # 첫 행 단가로 등록됐으므로 OK
    ])
    r = await client.post(
        "/api/sales/upload",
        files={"file": ("sales.csv", io.BytesIO(csv), "text/csv")},
        data={
            "date_column": "날짜", "menu_column": "메뉴명",
            "quantity_column": "수량", "price_column": "금액",
            "external_sale_id_column": "영수증번호",
            "auto_create_menus": "true",
        },
        headers=auth,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["imported"] == 3
    assert body["skipped"] == 0
    assert body["auto_created_menus"] == 2  # 페페로니피자 / 로제파스타

    # 진짜로 매장 메뉴에 등록됐는지 확인.
    r2 = await client.get("/api/menus", headers=auth)
    assert r2.status_code == 200
    names = {m["name"] for m in r2.json()["items"]}
    assert {"페페로니피자", "로제파스타"}.issubset(names)


@pytest.mark.asyncio
async def test_sales_upload_auto_create_off_keeps_skipping(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    # auto_create_menus 미지정(기본 false) → 미등록 메뉴는 skip.
    csv = _csv_bytes(["2026-01-15,없는메뉴,1,5000,r1"])
    r = await client.post(
        "/api/sales/upload",
        files={"file": ("sales.csv", io.BytesIO(csv), "text/csv")},
        data={
            "date_column": "날짜", "menu_column": "메뉴명",
            "quantity_column": "수량", "price_column": "금액",
            "external_sale_id_column": "영수증번호",
        },
        headers=auth,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["imported"] == 0
    assert body["skipped"] == 1
    assert body["auto_created_menus"] == 0


@pytest.mark.asyncio
async def test_sales_upload_auto_create_respects_per_upload_limit(
    client: AsyncClient,
) -> None:
    """업로드당 자동 등록 200개 상한을 넘는 행은 매핑 실패로 skip 되어야 한다."""
    from app.services.sale_service import AUTO_CREATE_PER_UPLOAD_LIMIT

    _, auth = await _register_verified_user(client)
    # 201개 unique 메뉴 → 200개만 등록되고 1개는 skip 되어야 함.
    n = AUTO_CREATE_PER_UPLOAD_LIMIT + 1
    lines = [
        f"2026-01-15,메뉴{i:04d},1,1000,r{i:04d}" for i in range(n)
    ]
    csv = _csv_bytes(lines)
    r = await client.post(
        "/api/sales/upload",
        files={"file": ("sales.csv", io.BytesIO(csv), "text/csv")},
        data={
            "date_column": "날짜", "menu_column": "메뉴명",
            "quantity_column": "수량", "price_column": "금액",
            "external_sale_id_column": "영수증번호",
            "auto_create_menus": "true",
        },
        headers=auth,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["auto_created_menus"] == AUTO_CREATE_PER_UPLOAD_LIMIT
    assert body["imported"] == AUTO_CREATE_PER_UPLOAD_LIMIT
    assert body["skipped"] == 1
    assert any("자동 등록 상한" in s for s in body["skipped_reasons"])


@pytest.mark.asyncio
async def test_sales_upload_idempotent_on_external_id(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    await _create_menu(client, auth, "아메리카노")

    csv = _csv_bytes([
        "2026-01-15,아메리카노,1,4500,dup-id",
    ])
    # 1차 업로드 — imported 1
    r1 = await client.post(
        "/api/sales/upload",
        files={"file": ("a.csv", io.BytesIO(csv), "text/csv")},
        data={
            "date_column": "날짜", "menu_column": "메뉴명",
            "quantity_column": "수량", "price_column": "금액",
            "external_sale_id_column": "영수증번호",
        },
        headers=auth,
    )
    assert r1.status_code == 201, r1.text
    assert r1.json()["imported"] == 1

    # 2차 — 같은 external_sale_id → UNIQUE 위반 자동 skip
    r2 = await client.post(
        "/api/sales/upload",
        files={"file": ("b.csv", io.BytesIO(csv), "text/csv")},
        data={
            "date_column": "날짜", "menu_column": "메뉴명",
            "quantity_column": "수량", "price_column": "금액",
            "external_sale_id_column": "영수증번호",
        },
        headers=auth,
    )
    assert r2.status_code == 201, r2.text
    body = r2.json()
    assert body["imported"] == 0
    assert body["skipped"] >= 1


@pytest.mark.asyncio
async def test_sales_upload_idempotent_without_external_id_column(client: AsyncClient) -> None:
    """영수증번호 컬럼 없이(external_sale_id NULL) 같은 파일을 재업로드해도
    (메뉴, 판매일시) 기준으로 중복 적재되면 안 된다.

    회귀 테스트 — 2026-08-17 발견: MySQL UNIQUE(store_id, source, external_sale_id)는
    NULL끼리 서로 다르게 취급되어, 영수증번호 컬럼을 비워두면(FE 기본값) 재업로드 시
    DB 레벨 중복 방지가 전혀 동작하지 않고 매번 전량 재적재되던 버그.
    """
    _, auth = await _register_verified_user(client)
    await _create_menu(client, auth, "소주")

    csv = ("날짜,메뉴명,수량,금액\n2026-01-15,소주,10,20000\n2026-01-16,소주,5,10000\n").encode(
        "utf-8"
    )
    common_data = {
        "date_column": "날짜", "menu_column": "메뉴명",
        "quantity_column": "수량", "price_column": "금액",
    }

    r1 = await client.post(
        "/api/sales/upload",
        files={"file": ("a.csv", io.BytesIO(csv), "text/csv")},
        data=common_data,
        headers=auth,
    )
    assert r1.status_code == 201, r1.text
    assert r1.json()["imported"] == 2

    # 재업로드 — 영수증번호가 없어도 (메뉴, 판매일시) 기준으로 전부 skip 되어야 함.
    r2 = await client.post(
        "/api/sales/upload",
        files={"file": ("b.csv", io.BytesIO(csv), "text/csv")},
        data=common_data,
        headers=auth,
    )
    assert r2.status_code == 201, r2.text
    body2 = r2.json()
    assert body2["imported"] == 0
    assert body2["skipped"] == 2

    r3 = await client.get("/api/sales/top-menus", headers=auth)
    assert r3.status_code == 200
    soju = next(m for m in r3.json() if m["menu_name"] == "소주")
    assert soju["quantity"] == 15  # 10 + 5, 재업로드분 미포함


@pytest.mark.asyncio
async def test_sales_upload_dedupes_within_same_file_without_external_id(
    client: AsyncClient,
) -> None:
    """영수증번호 없이 같은 파일 안에 (메뉴, 판매일시) 중복 행이 있으면 1건만 적재."""
    _, auth = await _register_verified_user(client)
    await _create_menu(client, auth, "소주")

    csv = (
        "날짜,메뉴명,수량,금액\n"
        "2026-01-15,소주,1,2000\n"
        "2026-01-15,소주,1,2000\n"
    ).encode("utf-8")
    r = await client.post(
        "/api/sales/upload",
        files={"file": ("a.csv", io.BytesIO(csv), "text/csv")},
        data={
            "date_column": "날짜", "menu_column": "메뉴명",
            "quantity_column": "수량", "price_column": "금액",
        },
        headers=auth,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["imported"] == 1
    assert body["skipped"] == 1


@pytest.mark.asyncio
async def test_sales_upload_missing_required_column_returns_422(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    # 헤더에 "금액" 컬럼 누락
    csv = ("날짜,메뉴명,수량\n2026-01-15,아메리카노,1\n").encode("utf-8")
    r = await client.post(
        "/api/sales/upload",
        files={"file": ("bad.csv", io.BytesIO(csv), "text/csv")},
        data={
            "date_column": "날짜", "menu_column": "메뉴명",
            "quantity_column": "수량", "price_column": "금액",
        },
        headers=auth,
    )
    assert r.status_code == 422, r.text
    assert r.json()["error"] == "CSV_MISSING_COLUMNS"


@pytest.mark.asyncio
async def test_sales_upload_empty_file_returns_422(client: AsyncClient) -> None:
    _, auth = await _register_verified_user(client)
    r = await client.post(
        "/api/sales/upload",
        files={"file": ("empty.csv", io.BytesIO(b""), "text/csv")},
        data={
            "date_column": "날짜", "menu_column": "메뉴명",
            "quantity_column": "수량", "price_column": "금액",
        },
        headers=auth,
    )
    assert r.status_code == 422, r.text


@pytest.mark.asyncio
async def test_sales_upload_unauthenticated_returns_401(client: AsyncClient) -> None:
    csv = _csv_bytes(["2026-01-15,a,1,1,r"])
    r = await client.post(
        "/api/sales/upload",
        files={"file": ("a.csv", io.BytesIO(csv), "text/csv")},
        data={
            "date_column": "날짜", "menu_column": "메뉴명",
            "quantity_column": "수량", "price_column": "금액",
        },
    )
    assert r.status_code == 401, r.text
