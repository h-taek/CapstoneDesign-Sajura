"""CSVAdapter — CSV 행을 공통 판매 스키마로 변환.

04_feature_spec.md §4.2·§4.5 공통 스키마:
  {sold_at, external_sale_id, menu_name, quantity, unit_price, total_price}

07_api_spec.md §6 POST /api/sales/upload 의 컬럼명 매핑(date/menu/quantity/price/
external_sale_id_column)을 받아 한 행씩 normalize. unit_price는 total_price를
quantity로 정수 나눗셈하여 산출(CSV에는 단가 컬럼이 없음). 매핑 실패·형식
오류 행은 SkipReason 으로 반환하여 호출자가 응답의 skipped_reasons 에 누적.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

# 08_schema.md §3 menus.name = VARCHAR(100). 초과 시 INSERT가 청크 전체를 굴려뜨릴 수
# 있으므로 adapter 단에서 행 단위로 미리 거른다.
MENU_NAME_MAX_LENGTH = 100


class CommonSale(BaseModel):
    """공통 판매 스키마 — 04_feature_spec.md §4.2."""

    model_config = ConfigDict(frozen=True)

    sold_at: datetime
    external_sale_id: str | None
    menu_name: str
    quantity: int
    unit_price: int
    total_price: int


@dataclass(frozen=True)
class SkipReason:
    row_index: int  # 1-based, CSV 데이터 첫 행이 1
    reason: str

    def format(self) -> str:
        return f"{self.row_index}행: {self.reason}"


class CSVAdapter:
    """CSV 행 → 공통 판매 스키마. 외부 POS 어댑터(TossPlace 등)는 [2단계]."""

    def __init__(
        self,
        date_column: str,
        menu_column: str,
        quantity_column: str,
        price_column: str,
        external_sale_id_column: str | None = None,
    ) -> None:
        self.date_column = date_column
        self.menu_column = menu_column
        self.quantity_column = quantity_column
        self.price_column = price_column
        self.external_sale_id_column = external_sale_id_column

    def required_columns(self) -> list[str]:
        cols = [self.date_column, self.menu_column, self.quantity_column, self.price_column]
        if self.external_sale_id_column:
            cols.append(self.external_sale_id_column)
        return cols

    def normalize(self, row: dict[str, Any], row_index: int) -> CommonSale | SkipReason:
        menu_name = _clean_str(row.get(self.menu_column))
        if not menu_name:
            return SkipReason(row_index, "메뉴명 없음")
        if len(menu_name) > MENU_NAME_MAX_LENGTH:
            return SkipReason(
                row_index,
                f"메뉴명이 너무 깁니다 ({MENU_NAME_MAX_LENGTH}자 초과)",
            )

        sold_at = _parse_datetime(row.get(self.date_column))
        if sold_at is None:
            return SkipReason(row_index, "날짜 형식 오류")

        quantity = _parse_int(row.get(self.quantity_column))
        if quantity is None or quantity <= 0:
            return SkipReason(row_index, "수량 형식 오류")

        total_price = _parse_int(row.get(self.price_column))
        if total_price is None or total_price < 0:
            return SkipReason(row_index, "금액 형식 오류")

        # CSV에는 단가 컬럼이 없으므로 총액 / 수량으로 산출 (정수 나눗셈).
        # 나머지가 발생하더라도 총액은 그대로 보존하여 매출 합계는 정확.
        unit_price = total_price // quantity

        external = None
        if self.external_sale_id_column:
            ext_raw = _clean_str(row.get(self.external_sale_id_column))
            external = ext_raw or None

        return CommonSale(
            sold_at=sold_at,
            external_sale_id=external,
            menu_name=menu_name,
            quantity=quantity,
            unit_price=unit_price,
            total_price=total_price,
        )


def _clean_str(v: Any) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    # pandas는 결측을 'nan' 문자열로 반환하기도 함
    if s.lower() == "nan":
        return ""
    return s


def _parse_int(v: Any) -> int | None:
    s = _clean_str(v)
    if not s:
        return None
    # "1,500" 같은 천단위 콤마 허용
    s = s.replace(",", "")
    try:
        # 소수점 표기("3.0")도 허용 → int 캐스팅
        return int(float(s))
    except (ValueError, TypeError):
        return None


_DATE_FORMATS = (
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%d",
    "%Y/%m/%d %H:%M:%S",
    "%Y/%m/%d %H:%M",
    "%Y/%m/%d",
)


def _parse_datetime(v: Any) -> datetime | None:
    s = _clean_str(v)
    if not s:
        return None
    # pandas Timestamp 등 datetime-호환 객체 우선 처리
    if isinstance(v, datetime):
        return v.replace(tzinfo=None) if v.tzinfo else v
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    # 마지막으로 ISO 8601 (fromisoformat — Python 3.11+는 Z 직접 지원)
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None
