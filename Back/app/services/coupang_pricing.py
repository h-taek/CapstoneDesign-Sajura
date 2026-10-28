"""쿠팡 상품 용량·포장 수량·단가 계산 — 01_basic_design.md §3.3.1·§3.8.1.

DB를 보지 않는 순수 함수만 둔다. 자동 담기(AutomationService)와 단가(OrderService)가 같이 쓴다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

Q3 = Decimal("0.001")
MISMATCH_RATIO = Decimal("0.02")  # 상품명 용량 대조·LLM 포장 수량 대조 허용 차이

# 재료 단위로 환산되는 용량 단위 — 무게는 무게끼리, 부피는 부피끼리, 개수 단위는 재료 단위 '개'로
_WEIGHT = {"g": Decimal(1), "kg": Decimal(1000)}
_VOLUME = {"ml": Decimal(1), "L": Decimal(1000)}
_COUNT = {"개", "구", "입"}

_UNIT_PRICE = re.compile(r"^\(?\s*([\d.,]+)\s*([^\d\s]+?)\s*당\s*([\d,]+)\s*원\s*\)?$")
# 상품명 용량 표기 — 용량('500g'·'1.8L'·'30구'·'10개입')과 묶음 개수('4개')
_NAME_MEASURE = re.compile(
    r"(\d+(?:,\d{3})*(?:\.\d+)?)\s*(kg|g|ml|l|구|개입|입)(?![a-z가-힣])", re.I
)
_NAME_COUNT = re.compile(r"(\d+)\s*개(?![입가-힣])")


@dataclass(frozen=True)
class Content:
    """상품 1개 용량."""

    quantity: Decimal
    unit: str


def _norm_unit(unit: str) -> str:
    low = unit.lower()
    if low in ("g", "kg", "ml"):
        return low
    if low == "l":
        return "L"
    if unit == "개입":
        return "입"
    return unit


def _family(unit: str) -> tuple[str, Decimal] | None:
    """(단위 계열, 기준 단위 배수). 계열 밖이면 None."""
    if unit in _WEIGHT:
        return "weight", _WEIGHT[unit]
    if unit in _VOLUME:
        return "volume", _VOLUME[unit]
    if unit in _COUNT:
        return "count", Decimal(1)
    return None


def content_from_unit_price(display_price: int, unit_price_text: str | None) -> Content | None:
    """쿠팡 단위가격 표시로 상품 1개 용량 — 표시 가격 ÷ 단위가격 × 기준 수량.

    예: 11,740원과 '100g당 2,348원' → 500g. 표시가 없거나 읽을 수 없으면 None.
    """
    if not unit_price_text:
        return None
    m = _UNIT_PRICE.match(unit_price_text.strip())
    if m is None:
        return None
    base = Decimal(m.group(1).replace(",", ""))
    per = Decimal(m.group(3).replace(",", ""))
    if base <= 0 or per <= 0 or display_price <= 0:
        return None
    quantity = (Decimal(display_price) / per * base).quantize(Q3, rounding=ROUND_HALF_UP)
    return Content(quantity, _norm_unit(m.group(2)))


def content_from_name(product_name: str) -> Content | None:
    """상품명의 용량 표기 — '500g, 4개' → 2000g. 표기가 없거나 둘 이상이면 None."""
    measures = {
        (Decimal(q.replace(",", "")), _norm_unit(u)) for q, u in _NAME_MEASURE.findall(product_name)
    }
    counts = _NAME_COUNT.findall(product_name)
    if len(counts) > 1 or len(measures) > 1:
        return None
    times = Decimal(counts[0]) if counts else Decimal(1)
    if measures:
        quantity, unit = measures.pop()
        return Content(quantity * times, unit)
    if counts:
        return Content(times, "개")
    return None


def to_item_unit(content: Content | None, item_unit: str) -> Decimal | None:
    """상품 1개 용량을 재료 단위로 환산한다. 환산되지 않으면 None."""
    if content is None:
        return None
    src = _family(content.unit)
    dst = _family(_norm_unit(item_unit))
    if src is None or dst is None or src[0] != dst[0]:
        return None
    if dst[0] == "count" and _norm_unit(item_unit) != "개":
        return None
    return (content.quantity * src[1] / dst[1]).quantize(Q3, rounding=ROUND_HALF_UP)


def differs(value: Decimal, reference: Decimal) -> bool:
    """value가 reference와 2% 넘게 다른가."""
    if reference <= 0:
        return True
    return abs(value - reference) / reference > MISMATCH_RATIO


def name_mismatch(content: Content, product_name: str) -> bool:
    """계산한 용량이 상품명 용량 표기와 2% 넘게 다른가.

    표기가 없거나 단위 계열이 다르면 대조하지 않는다.
    """
    named = content_from_name(product_name)
    if named is None:
        return False
    a, b = _family(content.unit), _family(named.unit)
    if a is None or b is None or a[0] != b[0]:
        return False
    return differs(content.quantity * a[1], named.quantity * b[1])


def pack_quantity(
    content: Content | None, item_unit: str, stored: Decimal | None
) -> Decimal | None:
    """상품 1개에 든 재료 수량 — 용량이 재료 단위로 환산되면 그 값, 아니면 저장된 포장 수량."""
    converted = to_item_unit(content, item_unit)
    if converted is not None and converted > 0:
        return converted
    if stored is not None and stored > 0:
        return stored
    return None


def unit_price(
    *,
    sale_price: int | None,
    content: Content | None,
    item_unit: str,
    stored_pack: Decimal | None,
) -> Decimal | None:
    """재료 단위당 단가(원) — 판매가 ÷ 용량(재료 단위), 안 되면 판매가 ÷ 포장 수량.

    못 구하면 None.
    """
    if sale_price is None:
        return None
    pack = pack_quantity(content, item_unit, stored_pack)
    if pack is None:
        return None
    return (Decimal(sale_price) / pack).quantize(Q3, rounding=ROUND_HALF_UP)


def stored_content(quantity: Decimal | None, unit: str | None) -> Content | None:
    """DB에 저장된 용량 칸 두 개를 Content로."""
    if quantity is None or unit is None:
        return None
    return Content(quantity, unit)
