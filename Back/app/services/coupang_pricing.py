"""쿠팡 상품명·용량·단가 계산 — 01_basic_design.md §3.3.1·§3.8.1.

DB를 보지 않는 순수 함수만 둔다. 자동 담기(AutomationService)·재고·추천발주가 같이 쓴다.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal

Q3 = Decimal("0.001")
Q4 = Decimal("0.0001")
MISMATCH_RATIO = Decimal("0.02")  # 관측 단가와 쿠팡 단위가격 표시의 허용 차이

# 기준 용량(g·kg·ml·L·구)과 옵션 이름의 개수 표기
_MEASURE = re.compile(r"(\d+(?:,\d{3})*(?:\.\d+)?)\s*(kg|g|ml|l|구)(?![a-z])", re.I)
_COUNT = re.compile(r"(\d+)\s*(?:개입|개|입|팩|봉|병|박스|세트)")
_UNIT_PRICE = re.compile(r"^\(?\s*([\d.,]+)\s*([^\d\s]+?)\s*당\s*([\d,]+)\s*원\s*\)?$")

# 용량 단위 → (단위 계열, 저장 단위 g·ml·개 배수)
_FAMILY = {
    "g": ("weight", Decimal(1)),
    "kg": ("weight", Decimal(1000)),
    "ml": ("volume", Decimal(1)),
    "l": ("volume", Decimal(1000)),
    "개": ("count", Decimal(1)),
    "구": ("count", Decimal(1)),
}
_STORED_UNIT = {"weight": "g", "volume": "ml", "count": "개"}
# 저장 단위 → 재료 단위 배수 (g은 g·kg, ml은 ml·L, 개는 개)
_TO_ITEM = {
    ("g", "g"): Decimal(1),
    ("g", "kg"): Decimal(1000),
    ("ml", "ml"): Decimal(1),
    ("ml", "L"): Decimal(1000),
    ("개", "개"): Decimal(1),
}


@dataclass(frozen=True)
class Content:
    """상품 1개 용량 — 단위는 g·ml·개."""

    quantity: Decimal
    unit: str


def split_name(raw: str) -> tuple[str, str | None]:
    """상품명 원문을 첫 쉼표로 나눈 (상품명, 옵션 이름). 쉼표가 없으면 옵션 이름은 None."""
    name, sep, option = raw.partition(",")
    option = option.strip()
    return name.strip(), (option or None) if sep else None


def _measures(text: str) -> set[tuple[Decimal, str]]:
    return {(Decimal(q.replace(",", "")), u.lower()) for q, u in _MEASURE.findall(text)}


def content(product_name: str, option_name: str | None) -> Content | None:
    """상품 1개 용량 — 옵션 이름(없으면 상품명)의 기준 용량 하나 × 옵션 이름의 개수 표기.

    기준 용량을 못 찾거나 둘 이상이면 None. 예: '900ml, 3개' → 2,700ml, '양파 1kg' + '1개' → 1,000g.
    """
    measures = _measures(option_name or "") or _measures(product_name)
    if len(measures) != 1:
        return None
    quantity, unit = measures.pop()
    for count in _COUNT.findall(option_name or ""):
        quantity *= Decimal(count)
    family, factor = _FAMILY[unit]
    if quantity <= 0:
        return None
    return Content((quantity * factor).quantize(Q3, rounding=ROUND_HALF_UP), _STORED_UNIT[family])


def stored_content(quantity: Decimal | None, unit: str | None) -> Content | None:
    """DB에 저장된 용량 칸 두 개를 Content로."""
    if quantity is None or unit is None:
        return None
    return Content(quantity, unit)


def unit_price_matches(display_price: int | None, c: Content | None, text: str | None) -> bool:
    """`표시 가격 ÷ 용량`을 쿠팡 단위가격 표시의 기준 수량으로 바꾼 값이 표시 금액과 2% 이내인가.

    용량·단위가격 표시가 없거나, 읽을 수 없거나, 단위 계열이 다르면 False.
    예: 58,280원, 2,000g, '100g당 2,914원' → True.
    """
    if display_price is None or display_price <= 0 or c is None or not text:
        return False
    m = _UNIT_PRICE.match(text.strip())
    if m is None:
        return False
    base_family = _FAMILY.get(m.group(2).lower())
    if base_family is None or _STORED_UNIT[base_family[0]] != c.unit:
        return False
    base = Decimal(m.group(1).replace(",", "")) * base_family[1]
    shown = Decimal(m.group(3).replace(",", ""))
    if base <= 0 or shown <= 0 or c.quantity <= 0:
        return False
    computed = Decimal(display_price) / c.quantity * base
    return abs(computed - shown) / shown <= MISMATCH_RATIO


def is_unit_price_text(text: str) -> bool:
    """쿠팡 단위가격 표시 모양('100g당 2,348원'·'(1구당 430원)')인가."""
    return _UNIT_PRICE.match(text.strip()) is not None


def is_wow(discount_label: str | None) -> bool:
    """와우 회원 할인('와우할인'·'와우쿠폰할인')인가."""
    return discount_label is not None and "와우" in discount_label


def store_price(
    *,
    display_price: int | None,
    discount_label: str | None,
    unit_price_text: str | None,
    non_wow_price: int | None,
    content: Content | None,
) -> tuple[int, Decimal | None] | None:
    """그 관측의 매장 가격 (판매가, 단가). 매장 가격으로 쓸 수 없는 관측이면 None.

    판매가는 와우 할인이 아니면 표시 가격, 와우 할인이면 비회원 가격이다. 대조는 표시 가격과
    단위가격 표시로 하고, 단가는 판매가 ÷ 용량이다. 대조를 통과하지 못하면 단가는 None.
    """
    sale = non_wow_price if is_wow(discount_label) else display_price
    if sale is None or sale <= 0:
        return None
    if content is None or not unit_price_matches(display_price, content, unit_price_text):
        return sale, None
    return sale, (Decimal(sale) / content.quantity).quantize(Q4, rounding=ROUND_HALF_UP)


def majority(
    prices: Iterable[tuple[int, Decimal | None, datetime]],
) -> tuple[int, Decimal | None] | None:
    """매장 가격 (판매가, 단가, 받은 시각) 목록의 다수결 — (판매가, 공용 단가).

    가장 많은 매장이 보낸 판매가, 매장 수가 같으면 가장 최근에 받은 판매가. 공용 단가는
    그 판매가를 보낸 매장 가격 중 가장 최근 것의 단가다. 목록이 비면 None.
    """
    counts: dict[int, int] = {}
    latest: dict[int, tuple[datetime, Decimal | None]] = {}
    for sale, unit, received_at in prices:
        counts[sale] = counts.get(sale, 0) + 1
        if sale not in latest or received_at > latest[sale][0]:
            latest[sale] = (received_at, unit)
    if not counts:
        return None
    best = max(counts, key=lambda s: (counts[s], latest[s][0]))
    return best, latest[best][1]


def content_unit_for(item_unit: str) -> str | None:
    """재료 단위로 바꿀 수 있는 용량 단위(g·ml·개). 바꿀 수 없는 재료 단위면 None."""
    return next((src for src, dst in _TO_ITEM if dst == item_unit), None)


def item_unit_price(
    per_unit: Decimal | None, content_unit: str | None, item_unit: str
) -> Decimal | None:
    """용량 단위 1당 원 → 재료 단위 1당 원. 예: 29.14원/g, 재료 단위 kg → 29,140원/kg.

    값이 없거나 재료 단위로 바꿀 수 없으면 None.
    """
    factor = _TO_ITEM.get((content_unit or "", item_unit))
    if per_unit is None or factor is None:
        return None
    return (per_unit * factor).quantize(Q3, rounding=ROUND_HALF_UP)
