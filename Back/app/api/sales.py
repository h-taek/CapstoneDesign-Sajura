"""/api/sales — 02_implementation_design.md §3.6 (M4.B2)."""
from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status

from app.adapters.pos.csv_adapter import CSVAdapter
from app.api.deps import CurrentUserDep, SessionDep, require_business_access
from app.core import errors
from app.schemas.sales import (
    CSVUploadResponse,
    InventoryDeduction,
    NeedsCheckItem,
    SalesListResponse,
    SalesSummaryResponse,
    SalesTrendsResponse,
    SortOrder,
    TopMenuItem,
    TrendGroupBy,
)
from app.services.sale_service import SaleService
from app.services.store_service import StoreService

router = APIRouter(
    prefix="/api/sales", tags=["sales"], dependencies=[Depends(require_business_access)]
)

# 업로드 크기 상한 — 10만 행 CSV가 평균 5~10 MB 수준. 안전 마진으로 50 MB.
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


@router.get("", response_model=SalesListResponse)
async def list_sales(
    session: SessionDep,
    current: CurrentUserDep,
    start_date: date,
    end_date: date,
    menu_id: str | None = None,
    order: SortOrder = "desc",
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> SalesListResponse:
    """판매 조회 화면 — 기간 판매 목록 + 기간 합계."""
    store_id = (await StoreService(session).get_store(current.user_id)).store_id
    return await SaleService(session).list_sales(
        store_id=store_id,
        start_date=start_date,
        end_date=end_date,
        menu_id=menu_id,
        order=order,
        page=page,
        size=size,
    )


@router.get("/summary", response_model=SalesSummaryResponse)
async def get_sales_summary(
    session: SessionDep,
    current: CurrentUserDep,
) -> SalesSummaryResponse:
    """홈 화면 매출 요약 카드 — 전체/이번 달 매출 집계 + 최근 판매일."""
    store_id = (await StoreService(session).get_store(current.user_id)).store_id
    return await SaleService(session).get_summary(store_id=store_id)


@router.get("/trends", response_model=SalesTrendsResponse)
async def get_sales_trends(
    session: SessionDep,
    current: CurrentUserDep,
    start_date: date,
    end_date: date,
    group_by: TrendGroupBy = "day",
    menu_id: str | None = None,
) -> SalesTrendsResponse:
    """홈·매출예측 화면 매출 그래프 — 기간·단위별 판매 추세."""
    store_id = (await StoreService(session).get_store(current.user_id)).store_id
    return await SaleService(session).get_trends(
        store_id=store_id,
        start_date=start_date,
        end_date=end_date,
        group_by=group_by,
        menu_id=menu_id,
    )


@router.get("/top-menus", response_model=list[TopMenuItem])
async def get_top_menus(
    session: SessionDep,
    current: CurrentUserDep,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 5,
) -> list[TopMenuItem]:
    """홈 화면 인기 메뉴 랭킹 — 판매량 기준."""
    store_id = (await StoreService(session).get_store(current.user_id)).store_id
    return await SaleService(session).get_top_menus(
        store_id=store_id, start_date=start_date, end_date=end_date, limit=limit
    )


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
    """CSV 업로드 — POST /api/sales/upload.

    01_basic_design.md §3.4.4, 02_implementation_design.md §3.6.
    """
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
        inventory_deduction=InventoryDeduction(
            deducted_sales=result.deducted_sales,
            needs_check_items=[
                NeedsCheckItem(item_id=item_id, name=name)
                for item_id, name in result.needs_check_items
            ],
        ),
    )
