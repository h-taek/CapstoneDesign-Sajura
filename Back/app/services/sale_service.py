"""SaleService — CSV 업로드 처리 (M4.B2).

핵심 정책:
- 청크 크기 = 1만 행 (메모리 부담 회피)
- 트랜잭션 단위 = 청크 1개 (부분 실패 시 청크 단위 롤백 → 그 이전 청크는 보존)
- UNIQUE(store_id, source, external_sale_id) 위반 행은 자동 skip. 영수증번호
  컬럼이 없는 CSV는 external_sale_id가 NULL이 되는데, MySQL UNIQUE 인덱스는
  NULL끼리 서로 다르게 취급해 이 경로만으로는 중복 방지가 되지 않는다 — 그래서
  external_sale_id가 없으면 (menu_id, sold_at) 기반 합성 식별자를 만들어 같은
  UNIQUE 제약을 타게 한다(2026-08-17, 소주 8,984→98,824 11배 중복 적재 픽스).
- menu_name → menu_id 매핑은 매장 메뉴 캐시 1회 조회 후 in-memory dict 매핑
- auto_create_menus=True 시 미등록 메뉴를 카테고리='자동등록', use_inventory_deduction=False
  로 즉시 생성하여 menu_map 갱신 (feature_spec §2.2 + §4.4 옵션).
- pandas의 sync I/O는 asyncio.to_thread로 워커 스레드에 위임해 이벤트 루프
  블록을 막는다(10만 행 ~12초 동안 다른 요청이 막히지 않게 함).
- auto_create_menus 상한: 업로드당 200개 + 매장 전체 1,000개. 초과 시 그 행은
  매핑 실패로 처리되며 결과에 사유 표시.
- skipped_reasons: 같은 사유(메뉴 매핑 실패/청크내 중복 영수증/DB 중복)는 메뉴명·
  카운트로 그룹 단위로 반환하여 결과 화면 가독성 확보.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from io import BytesIO
from typing import Iterator

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.pos.csv_adapter import CSVAdapter, CommonSale, SkipReason
from app.core import errors
from app.models.menu import Menu
from app.models.sale_record import SaleRecord, SaleSource
from app.schemas.sales import (
    DailyRevenuePoint,
    MonthlyRevenuePoint,
    SalesSummaryResponse,
    TopMenuItem,
    WeeklyRevenuePoint,
)
from app.services.anomaly_detector import AnomalyDetector

CHUNK_SIZE = 10_000
AUTO_CATEGORY = "자동등록"
AUTO_CREATE_PER_UPLOAD_LIMIT = 200
STORE_MENU_HARD_LIMIT = 1_000


@dataclass
class UploadResult:
    imported: int = 0
    skipped: int = 0
    auto_created_menus: int = 0
    anomaly_count: int = 0
    # 행 단위 사유(adapter 변환 실패 등): "3행: 메뉴명 없음" 형태 그대로.
    _row_reasons: list[str] = field(default_factory=list)
    # 그룹 단위 사유: 메뉴명별 카운트.
    _unmapped_counts: dict[str, int] = field(default_factory=dict)
    _dup_in_chunk_counts: dict[str, int] = field(default_factory=dict)
    _dup_in_db_total: int = 0
    _auto_create_limit_hit: bool = False  # 사용자에게 알릴 안내 한 줄 트리거

    @property
    def skipped_reasons(self) -> list[str]:
        out = list(self._row_reasons)
        if self._unmapped_counts:
            parts = [f"{name} ({cnt}행)" for name, cnt in sorted(self._unmapped_counts.items())]
            out.append(f"매장 메뉴와 매핑 실패: {', '.join(parts)}")
        if self._dup_in_chunk_counts:
            parts = [f"{name} ({cnt}회)" for name, cnt in sorted(self._dup_in_chunk_counts.items())]
            out.append(f"같은 파일 안에서 중복(영수증번호 또는 상품+판매일 기준): {', '.join(parts)}")
        if self._dup_in_db_total > 0:
            out.append(f"이미 저장된 판매 기록과 중복(영수증번호 또는 상품+판매일 기준): {self._dup_in_db_total}건")
        if self._auto_create_limit_hit:
            out.append(
                "메뉴 자동 등록 상한에 도달했습니다 — "
                f"업로드당 {AUTO_CREATE_PER_UPLOAD_LIMIT}개 또는 매장당 {STORE_MENU_HARD_LIMIT}개 한도. "
                "메뉴 화면에서 정리 후 다시 시도하세요."
            )
        return out


class SaleService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upload_csv(
        self,
        *,
        store_id: str,
        file_bytes: bytes,
        adapter: CSVAdapter,
        auto_create_menus: bool = False,
        anomaly_detector: AnomalyDetector | None = None,
    ) -> UploadResult:
        detector = anomaly_detector or AnomalyDetector()
        result = UploadResult()

        menu_map = await self._load_menu_map(store_id=store_id)
        current_menu_count = len(menu_map)

        # pandas read_csv는 sync I/O. async 핸들러에서 직접 호출하면 이벤트 루프가
        # 행 수 × 파싱시간 동안 막힌다. 워커 스레드에 위임.
        try:
            chunks_iter = await asyncio.to_thread(
                _open_csv_iter, file_bytes, CHUNK_SIZE
            )
        except Exception as exc:
            raise errors.DomainError(
                status_code=422,
                error_code="CSV_PARSE_FAILED",
                message=f"CSV 파싱 실패: {exc}",
            ) from exc

        global_row_index = 0  # CSV 데이터 첫 행이 1
        first_chunk = True

        while True:
            chunk = await asyncio.to_thread(_next_chunk, chunks_iter)
            if chunk is None:
                break

            if first_chunk:
                missing = [c for c in adapter.required_columns() if c not in chunk.columns]
                if missing:
                    raise errors.DomainError(
                        status_code=422,
                        error_code="CSV_MISSING_COLUMNS",
                        message=f"필수 컬럼 누락: {', '.join(missing)}",
                    )
                first_chunk = False

            sales, sale_row_indices, global_row_index = await asyncio.to_thread(
                _normalize_chunk, chunk, adapter, global_row_index, result
            )

            if auto_create_menus:
                created = await self._auto_create_missing_menus(
                    store_id=store_id,
                    sales=sales,
                    menu_map=menu_map,
                    current_menu_count=current_menu_count,
                    result=result,
                )
                result.auto_created_menus += created
                current_menu_count += created

            anomalies = detector.detect(sales)
            result.anomaly_count += len(anomalies)

            await self._insert_chunk(
                store_id=store_id,
                sales=sales,
                row_indices=sale_row_indices,
                menu_map=menu_map,
                result=result,
            )

        return result

    async def get_summary(self, *, store_id: str) -> SalesSummaryResponse:
        """홈 화면 매출 요약 — 전체 누계 + 이번 달 + 오늘 집계.

        "이번 달"·"오늘"은 실제 달력이 아니라 **이 매장의 마지막 판매일 기준**으로 계산한다.
        시연·테스트 데이터는 실제 오늘 날짜와 무관한 과거 구간을 업로드하는 경우가 많아서,
        실제 달력 기준이면 "이번 달 매출 0원"처럼 데이터가 있어도 빈 값으로 보이는 문제가
        있었다 — 마지막 판매일을 기준점으로 삼아 항상 실데이터가 채워지게 한다.
        """
        totals = (
            await self.session.execute(
                select(
                    func.coalesce(func.sum(SaleRecord.total_price), 0),
                    func.count(SaleRecord.sale_id),
                    func.max(SaleRecord.sold_at),
                ).where(SaleRecord.store_id == store_id)
            )
        ).one()
        total_revenue, total_sales_count, last_sale_at = totals

        now = last_sale_at if last_sale_at is not None else datetime.now(UTC).replace(tzinfo=None)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        this_month = (
            await self.session.execute(
                select(
                    func.coalesce(func.sum(SaleRecord.total_price), 0),
                    func.count(SaleRecord.sale_id),
                ).where(
                    SaleRecord.store_id == store_id,
                    SaleRecord.sold_at >= month_start,
                )
            )
        ).one()
        this_month_revenue, this_month_sales_count = this_month

        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today = (
            await self.session.execute(
                select(
                    func.coalesce(func.sum(SaleRecord.total_price), 0),
                    func.count(SaleRecord.sale_id),
                ).where(
                    SaleRecord.store_id == store_id,
                    SaleRecord.sold_at >= today_start,
                )
            )
        ).one()
        today_revenue, today_sales_count = today

        return SalesSummaryResponse(
            total_revenue=total_revenue,
            total_sales_count=total_sales_count,
            this_month_revenue=this_month_revenue,
            this_month_sales_count=this_month_sales_count,
            today_revenue=today_revenue,
            today_sales_count=today_sales_count,
            last_sale_at=last_sale_at,
        )

    async def _reference_date(self, *, store_id: str) -> date:
        """이 매장의 마지막 판매일(없으면 오늘) — "최근 N일"·"이번 달" 계산 기준점.
        실제 달력 대신 데이터 기준으로 잡아서, 과거 구간 시연 데이터도 항상 값이 채워지게 한다."""
        latest = await self.session.scalar(
            select(func.max(SaleRecord.sold_at)).where(SaleRecord.store_id == store_id)
        )
        return latest.date() if latest is not None else date.today()

    async def get_daily_revenue(self, *, store_id: str, days: int = 7) -> list[DailyRevenuePoint]:
        """최근 N일 매출 추이 — 데이터 없는 날짜는 0으로 채운 연속 시계열."""
        reference = await self._reference_date(store_id=store_id)
        start = reference - timedelta(days=days - 1)
        d = func.date(SaleRecord.sold_at)
        rows = (
            await self.session.execute(
                select(d, func.sum(SaleRecord.total_price), func.count(SaleRecord.sale_id))
                .where(SaleRecord.store_id == store_id, SaleRecord.sold_at >= start)
                .group_by(d)
            )
        ).all()
        by_day = {
            (row[0] if isinstance(row[0], date) else datetime.strptime(row[0], "%Y-%m-%d").date()): (
                int(row[1]),
                int(row[2]),
            )
            for row in rows
        }
        return [
            DailyRevenuePoint(
                date=(start + timedelta(days=i)).isoformat(),
                revenue=by_day.get(start + timedelta(days=i), (0, 0))[0],
                sales_count=by_day.get(start + timedelta(days=i), (0, 0))[1],
            )
            for i in range(days)
        ]

    async def get_daily_revenue_for_month(
        self, *, store_id: str, year_month: str
    ) -> list[DailyRevenuePoint]:
        """특정 월(YYYY-MM)의 1일~말일 매출 추이 — 데이터 없는 날짜는 0으로 채움."""
        year, month = (int(p) for p in year_month.split("-"))
        month_start = date(year, month, 1)
        next_month_start = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
        days_in_month = (next_month_start - month_start).days

        d = func.date(SaleRecord.sold_at)
        rows = (
            await self.session.execute(
                select(d, func.sum(SaleRecord.total_price), func.count(SaleRecord.sale_id))
                .where(
                    SaleRecord.store_id == store_id,
                    SaleRecord.sold_at >= datetime.combine(month_start, datetime.min.time()),
                    SaleRecord.sold_at < datetime.combine(next_month_start, datetime.min.time()),
                )
                .group_by(d)
            )
        ).all()
        by_day = {
            (row[0] if isinstance(row[0], date) else datetime.strptime(row[0], "%Y-%m-%d").date()): (
                int(row[1]),
                int(row[2]),
            )
            for row in rows
        }
        return [
            DailyRevenuePoint(
                date=(month_start + timedelta(days=i)).isoformat(),
                revenue=by_day.get(month_start + timedelta(days=i), (0, 0))[0],
                sales_count=by_day.get(month_start + timedelta(days=i), (0, 0))[1],
            )
            for i in range(days_in_month)
        ]

    async def get_weekly_revenue_this_month(self, *, store_id: str) -> list[WeeklyRevenuePoint]:
        """이번 달 주차별(1일 단위 7개씩 묶음) 매출 — 캘린더 주가 아닌 월초 기준 등분."""
        today = await self._reference_date(store_id=store_id)
        month_start = today.replace(day=1)
        rows = (
            await self.session.execute(
                select(SaleRecord.sold_at, SaleRecord.total_price).where(
                    SaleRecord.store_id == store_id,
                    SaleRecord.sold_at >= datetime.combine(month_start, datetime.min.time()),
                )
            )
        ).all()
        buckets: dict[int, list[int]] = {}
        for sold_at, total_price in rows:
            day_of_month = (sold_at.date() if isinstance(sold_at, datetime) else sold_at).day
            week_idx = (day_of_month - 1) // 7
            buckets.setdefault(week_idx, []).append(total_price)
        max_week = max(buckets.keys(), default=(today.day - 1) // 7)
        return [
            WeeklyRevenuePoint(
                week_label=f"{i + 1}주차",
                revenue=sum(buckets.get(i, [])),
                sales_count=len(buckets.get(i, [])),
            )
            for i in range(max_week + 1)
        ]

    async def get_monthly_revenue(
        self, *, store_id: str, months: int = 6
    ) -> list[MonthlyRevenuePoint]:
        """월별 매출 추이 — 데이터가 존재하는 월 기준 최근 N개월(캘린더 공백월은 건너뜀)."""
        ym = func.date_format(SaleRecord.sold_at, "%Y-%m")
        rows = (
            await self.session.execute(
                select(ym, func.sum(SaleRecord.total_price), func.count(SaleRecord.sale_id))
                .where(SaleRecord.store_id == store_id)
                .group_by(ym)
                .order_by(ym.desc())
                .limit(months)
            )
        ).all()
        return [
            MonthlyRevenuePoint(year_month=year_month, revenue=revenue, sales_count=count)
            for year_month, revenue, count in reversed(rows)
        ]

    async def get_top_menus(self, *, store_id: str, limit: int = 5) -> list[TopMenuItem]:
        """판매량 기준 인기 메뉴 — 재고·최저가 추천과 달리 실제 판매 데이터로 산출 가능."""
        rows = (
            await self.session.execute(
                select(
                    Menu.name,
                    func.sum(SaleRecord.quantity),
                    func.sum(SaleRecord.total_price),
                )
                .join(Menu, Menu.menu_id == SaleRecord.menu_id)
                .where(SaleRecord.store_id == store_id)
                .group_by(Menu.menu_id, Menu.name)
                .order_by(func.sum(SaleRecord.quantity).desc())
                .limit(limit)
            )
        ).all()
        return [
            TopMenuItem(menu_name=name, quantity=quantity, revenue=revenue)
            for name, quantity, revenue in rows
        ]

    async def _load_menu_map(self, *, store_id: str) -> dict[str, str]:
        rows = (
            await self.session.scalars(
                select(Menu).where(Menu.store_id == store_id, Menu.is_deleted.is_(False))
            )
        ).all()
        return {m.name: m.menu_id for m in rows}

    async def _auto_create_missing_menus(
        self,
        *,
        store_id: str,
        sales: list[CommonSale],
        menu_map: dict[str, str],
        current_menu_count: int,
        result: UploadResult,
    ) -> int:
        """청크 안에서 매장 메뉴에 없는 이름들을 한 번에 등록.

        상한:
        - 업로드당 누적 AUTO_CREATE_PER_UPLOAD_LIMIT(200) 개
        - 매장 메뉴 총 STORE_MENU_HARD_LIMIT(1,000) 개 — auto 생성 + 기존 합

        상한 초과로 등록 못 한 메뉴는 menu_map에 안 올리고 그대로 둠 → 그 행은
        `_insert_chunk`에서 자연스럽게 매핑 실패 skip 처리됨.
        """
        first_unit_price: dict[str, int] = {}
        for s in sales:
            if s.menu_name in menu_map:
                continue
            first_unit_price.setdefault(s.menu_name, s.unit_price)

        if not first_unit_price:
            return 0

        per_upload_remaining = AUTO_CREATE_PER_UPLOAD_LIMIT - result.auto_created_menus
        store_remaining = STORE_MENU_HARD_LIMIT - current_menu_count
        budget = max(0, min(per_upload_remaining, store_remaining))

        if budget == 0:
            result._auto_create_limit_hit = True
            return 0

        items = list(first_unit_price.items())
        if len(items) > budget:
            result._auto_create_limit_hit = True
            items = items[:budget]

        new_menus = [
            Menu(
                store_id=store_id,
                name=name,
                category=AUTO_CATEGORY,
                price=price,
                is_active=True,
                use_inventory_deduction=False,
            )
            for name, price in items
        ]
        self.session.add_all(new_menus)
        await self.session.flush()
        for m in new_menus:
            menu_map[m.name] = m.menu_id
        return len(new_menus)

    async def _insert_chunk(
        self,
        *,
        store_id: str,
        sales: list[CommonSale],
        row_indices: list[int],
        menu_map: dict[str, str],
        result: UploadResult,
    ) -> None:
        rows_to_insert: list[dict] = []
        seen_external: set[str] = set()  # 같은 청크 내 중복 external_sale_id 미리 차단

        for sale, _row_index in zip(sales, row_indices, strict=True):
            menu_id = menu_map.get(sale.menu_name)
            if menu_id is None:
                result.skipped += 1
                result._unmapped_counts[sale.menu_name] = (
                    result._unmapped_counts.get(sale.menu_name, 0) + 1
                )
                continue

            # 영수증번호(external_sale_id) 컬럼이 없는 CSV(기간별 상품 합계 리포트 등)는
            # 원본에 거래 단위 식별자가 없다. UNIQUE(store_id, source, external_sale_id)는
            # MySQL에서 NULL끼리 서로 다른 값으로 취급되어 DB 레벨 중복 방지가 전혀
            # 동작하지 않는다 — 같은 파일을 여러 번 업로드하면 매번 전량 재적재된다
            # (실사례: 소주 8,984개 → 98,824개로 11배 중복 적재, 2026-08-17 발견).
            # (매장, 메뉴, 판매일시) 조합으로 합성 식별자를 만들어 같은 UNIQUE 제약·
            # INSERT IGNORE 경로를 그대로 타게 한다.
            dedup_key = sale.external_sale_id
            dedup_label = sale.external_sale_id
            if dedup_key is None:
                dedup_key = f"AGG:{menu_id}:{sale.sold_at.isoformat()}"
                dedup_label = f"{sale.menu_name} {sale.sold_at.date().isoformat()}"

            if dedup_key in seen_external:
                result.skipped += 1
                result._dup_in_chunk_counts[dedup_label] = (
                    result._dup_in_chunk_counts.get(dedup_label, 0) + 1
                )
                continue
            seen_external.add(dedup_key)

            rows_to_insert.append({
                "store_id": store_id,
                "menu_id": menu_id,
                "external_sale_id": dedup_key,
                "quantity": sale.quantity,
                "unit_price": sale.unit_price,
                "total_price": sale.total_price,
                "sold_at": sale.sold_at,
                "source": SaleSource.CSV.value,
            })

        if not rows_to_insert:
            await self.session.commit()  # auto_create_menus 트랜잭션 마무리
            return

        # MySQL INSERT IGNORE — UNIQUE(store_id, source, external_sale_id)
        # 위반(과거 청크/과거 업로드와의 중복)은 자동 skip. 본 insert는
        # 청크 단위 트랜잭션이며, 청크 내 매핑 실패는 위에서 이미 제외.
        stmt = mysql_insert(SaleRecord).prefix_with("IGNORE").values(rows_to_insert)
        res = await self.session.execute(stmt)
        await self.session.commit()

        inserted = res.rowcount if res.rowcount is not None else len(rows_to_insert)
        ignored = len(rows_to_insert) - inserted
        result.imported += inserted
        if ignored > 0:
            result.skipped += ignored
            result._dup_in_db_total += ignored


# ----------------------------------------------------------------------
# 워커 스레드에서 실행되는 sync 헬퍼들 — 이벤트 루프 보호.
# ----------------------------------------------------------------------


def _open_csv_iter(file_bytes: bytes, chunk_size: int) -> Iterator[pd.DataFrame]:
    return pd.read_csv(
        BytesIO(file_bytes),
        chunksize=chunk_size,
        dtype=str,
        keep_default_na=False,
    )


def _next_chunk(it: Iterator[pd.DataFrame]) -> pd.DataFrame | None:
    try:
        return next(it)
    except StopIteration:
        return None


def _normalize_chunk(
    chunk: pd.DataFrame,
    adapter: CSVAdapter,
    start_row_index: int,
    result: UploadResult,
) -> tuple[list[CommonSale], list[int], int]:
    sales: list[CommonSale] = []
    sale_row_indices: list[int] = []
    idx = start_row_index
    for _, row in chunk.iterrows():
        idx += 1
        normalized = adapter.normalize(row.to_dict(), idx)
        if isinstance(normalized, SkipReason):
            result.skipped += 1
            result._row_reasons.append(normalized.format())
            continue
        sales.append(normalized)
        sale_row_indices.append(idx)
    return sales, sale_row_indices, idx
