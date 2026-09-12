"""/api/sales — api_spec §6 (M4.B2)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile, status

from app.adapters.pos.csv_adapter import CSVAdapter
from app.api.deps import CurrentUserDep, SessionDep
from app.core import errors
from app.schemas.sales import (
    CSVUploadResponse,
    DailyRevenuePoint,
    MonthlyRevenuePoint,
    SalesSummaryResponse,
    TopMenuItem,
    WeeklyRevenuePoint,
)
from app.services.sale_service import SaleService
from app.services.store_service import StoreService

router = APIRouter(prefix="/api/sales", tags=["sales"])

# 업로드 크기 상한 — 10만 행 CSV가 평균 5~10 MB 수준. 안전 마진으로 50 MB.
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


@router.get("/summary", response_model=SalesSummaryResponse)
async def get_sales_summary(
    session: SessionDep,
    current: CurrentUserDep,
) -> SalesSummaryResponse:
    """홈 화면 매출 요약 카드 — 전체/이번 달 매출 집계 + 최근 판매일."""
    store_id = (await StoreService(session).get_store(current.user_id)).store_id
    return await SaleService(session).get_summary(store_id=store_id)


@router.get("/monthly", response_model=list[MonthlyRevenuePoint])
async def get_monthly_revenue(
    session: SessionDep,
    current: CurrentUserDep,
    months: int = 6,
) -> list[MonthlyRevenuePoint]:
    """홈/매출예측 화면 그래프용 — 데이터가 있는 월 기준 최근 N개월 매출."""
    store_id = (await StoreService(session).get_store(current.user_id)).store_id
    return await SaleService(session).get_monthly_revenue(store_id=store_id, months=months)


@router.get("/daily", response_model=list[DailyRevenuePoint])
async def get_daily_revenue(
    session: SessionDep,
    current: CurrentUserDep,
    days: int = 7,
) -> list[DailyRevenuePoint]:
    """홈 화면 "일간매출 추이" — 최근 N일, 데이터 없는 날은 0으로 채움."""
    store_id = (await StoreService(session).get_store(current.user_id)).store_id
    return await SaleService(session).get_daily_revenue(store_id=store_id, days=days)


@router.get("/daily-by-month", response_model=list[DailyRevenuePoint])
async def get_daily_revenue_for_month(
    session: SessionDep,
    current: CurrentUserDep,
    year_month: str,
) -> list[DailyRevenuePoint]:
    """매출예측 화면 "이번 달/지난 달 매출 그래프" — 특정 월 1일~말일 일별 매출."""
    store_id = (await StoreService(session).get_store(current.user_id)).store_id
    return await SaleService(session).get_daily_revenue_for_month(
        store_id=store_id, year_month=year_month
    )


@router.get("/weekly-this-month", response_model=list[WeeklyRevenuePoint])
async def get_weekly_revenue_this_month(
    session: SessionDep,
    current: CurrentUserDep,
) -> list[WeeklyRevenuePoint]:
    """홈 화면 "이번 달 매출 그래프"(주차별) — 월초 기준 7일 단위 등분."""
    store_id = (await StoreService(session).get_store(current.user_id)).store_id
    return await SaleService(session).get_weekly_revenue_this_month(store_id=store_id)


@router.get("/top-menus", response_model=list[TopMenuItem])
async def get_top_menus(
    session: SessionDep,
    current: CurrentUserDep,
    limit: int = 5,
) -> list[TopMenuItem]:
    """홈 화면 인기 메뉴 랭킹 — 판매량 기준."""
    store_id = (await StoreService(session).get_store(current.user_id)).store_id
    return await SaleService(session).get_top_menus(store_id=store_id, limit=limit)


@router.post("/upload", response_model=CSVUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_sales_csv(
    session: SessionDep,
    current: CurrentUserDep,
    file: Annotated[UploadFile, File(...)],
    date_column: Annotated[str, Form(...)],
    menu_column: Annotated[str, Form(...)],
    quantity_column: Annotated[str, Form(...)],
    price_column: Annotated[str, Form(...)],
    external_sale_id_column: Annotated[str | None, Form()] = None,
    auto_create_menus: Annotated[bool, Form()] = False,
) -> CSVUploadResponse:
    """CSV 업로드 — feature_spec §4.4 + api_spec §6 POST /api/sales/upload."""
    store_id = (await StoreService(session).get_store(current.user_id)).store_id

    file_bytes = await file.read()
    if not file_bytes:
        raise errors.DomainError(
            status_code=422, error_code="EMPTY_FILE", message="빈 파일입니다."
        )
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise errors.DomainError(
            status_code=413,
            error_code="FILE_TOO_LARGE",
            message=f"파일이 너무 큽니다 (최대 {MAX_UPLOAD_BYTES // 1024 // 1024} MB).",
        )

    adapter = CSVAdapter(
        date_column=date_column,
        menu_column=menu_column,
        quantity_column=quantity_column,
        price_column=price_column,
        external_sale_id_column=external_sale_id_column or None,
    )

    result = await SaleService(session).upload_csv(
        store_id=store_id,
        file_bytes=file_bytes,
        adapter=adapter,
        auto_create_menus=auto_create_menus,
    )
    return CSVUploadResponse(
        imported=result.imported,
        skipped=result.skipped,
        skipped_reasons=result.skipped_reasons,
        anomaly_count=result.anomaly_count,
        auto_created_menus=result.auto_created_menus,
    )
