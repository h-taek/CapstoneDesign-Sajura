"""쿠팡 상품명·용량·단가 계산 — 01_basic_design.md §3.3.1."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

from app.services.coupang_pricing import (
    Content,
    content,
    content_unit_for,
    daily_unit_prices,
    item_unit_price,
    kst_date,
    majority,
    split_name,
    store_price,
    unit_price_matches,
)


def test_split_name_at_first_comma() -> None:
    assert split_name("해표 카놀라유, 900ml, 3개") == ("해표 카놀라유", "900ml, 3개")
    assert split_name("햇양파 1kg") == ("햇양파 1kg", None)
    assert split_name("햇양파,") == ("햇양파", None)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("해표 카놀라유, 900ml, 3개", Content(Decimal("2700"), "ml")),
        ("양파 1kg, 1개", Content(Decimal("1000"), "g")),
        ("돼지 목심, 500g, 4팩", Content(Decimal("2000"), "g")),
        ("해표 식용유, 1개, 1.8L", Content(Decimal("1800"), "ml")),
        ("알부자집 대란, 30구, 2개", Content(Decimal("60"), "개")),
        ("대파 1000g, 1개입", Content(Decimal("1000"), "g")),
        ("국산 대파 흙대파 1kg 3kg 5kg, 1개", None),  # 기준 용량 둘 이상
        ("[양계장] 대란(L 52~59g) 30구, 1개", None),  # 상품명에 기준 용량 둘
        ("청정원 카놀라유, 1개", None),  # 기준 용량 없음
    ],
)
def test_content(raw: str, expected: Content | None) -> None:
    assert content(*split_name(raw)) == expected


def test_unit_price_matches_within_two_percent() -> None:
    g2000 = Content(Decimal("2000"), "g")
    assert unit_price_matches(58280, g2000, "100g당 2,914원")
    assert unit_price_matches(58280, g2000, "(100g당 2,914원)")
    # 계산 2,914원 — 표시 2,857원이면 2.0% 이내, 2,856원이면 넘는다
    assert unit_price_matches(58280, g2000, "100g당 2,857원")
    assert not unit_price_matches(58280, g2000, "100g당 2,856원")
    assert unit_price_matches(12900, Content(Decimal("30"), "개"), "1구당 430원")
    assert not unit_price_matches(12900, Content(Decimal("2000"), "g"), "1구당 430원")  # 계열 다름
    assert not unit_price_matches(4810, Content(Decimal("1"), "개"), "1세트당 4,810원")
    assert not unit_price_matches(58280, g2000, None)
    assert not unit_price_matches(58280, None, "100g당 2,914원")


def test_store_price_sale_and_unit() -> None:
    g2000 = Content(Decimal("2000"), "g")
    common = {"discount_label": None, "non_wow_price": None, "content": g2000}
    assert store_price(display_price=58280, unit_price_text="100g당 2,914원", **common) == (
        58280, Decimal("29.1400"),
    )
    # 대조를 통과하지 못하면 그 관측의 단가는 비운다
    assert store_price(display_price=58280, unit_price_text="100g당 1,000원", **common) == (
        58280, None,
    )
    assert store_price(display_price=58280, unit_price_text=None, **common) == (58280, None)
    assert store_price(
        display_price=58280, unit_price_text="100g당 2,914원", discount_label="쿠폰할인",
        non_wow_price=None, content=None,
    ) == (58280, None)


def test_store_price_wow_uses_non_wow_price() -> None:
    g800 = Content(Decimal("800"), "g")
    # 대조는 표시 가격(와우 가격)과 단위가격 표시로, 단가는 비회원 가격 ÷ 용량
    assert store_price(
        display_price=9600, discount_label="와우할인", unit_price_text="100g당 1,200원",
        non_wow_price=9900, content=g800,
    ) == (9900, Decimal("12.3750"))
    # 비회원 가격이 없으면 매장 가격으로 쓰지 않는다
    assert store_price(
        display_price=9600, discount_label="와우쿠폰할인", unit_price_text="100g당 1,200원",
        non_wow_price=None, content=g800,
    ) is None


def test_majority() -> None:
    t = datetime(2026, 10, 29, 9)
    assert majority([]) is None
    assert majority([(10000, Decimal("10"), t)]) == (10000, Decimal("10"))
    # 2:1이면 많은 쪽, 단가는 그 판매가의 가장 최근 매장 가격
    assert majority([
        (10000, None, t),
        (12000, Decimal("12"), t + timedelta(minutes=1)),
        (10000, Decimal("10"), t + timedelta(minutes=2)),
    ]) == (10000, Decimal("10"))
    # 매장 수가 같으면 가장 최근에 받은 판매가
    assert majority([
        (10000, Decimal("10"), t + timedelta(minutes=5)),
        (12000, Decimal("12"), t),
    ]) == (10000, Decimal("10"))


def test_item_unit_price_converts_to_item_unit() -> None:
    assert item_unit_price(Decimal("29.14"), "g", "kg") == Decimal("29140.000")
    assert item_unit_price(Decimal("29.14"), "g", "g") == Decimal("29.140")
    assert item_unit_price(Decimal("2.5"), "ml", "L") == Decimal("2500.000")
    assert item_unit_price(Decimal("430"), "개", "개") == Decimal("430.000")
    assert item_unit_price(Decimal("29.14"), "g", "개") is None  # 바꿀 수 없으면 미설정
    assert item_unit_price(None, "g", "g") is None
    assert (content_unit_for("kg"), content_unit_for("L"), content_unit_for("개")) == (
        "g", "ml", "개",
    )
    assert content_unit_for("봉") is None


def test_kst_date_adds_nine_hours() -> None:
    assert kst_date(datetime(2026, 10, 19, 14, 59)) == date(2026, 10, 19)
    assert kst_date(datetime(2026, 10, 19, 15, 0)) == date(2026, 10, 20)


def _days(start: date, n: int) -> list[date]:
    return [start + timedelta(days=i) for i in range(n)]


def test_daily_unit_prices_carries_last_value_forward() -> None:
    d = _days(date(2026, 10, 1), 5)
    history = {"A": [(date(2026, 9, 28), Decimal("15")), (date(2026, 10, 3), Decimal("16"))]}
    prices = daily_unit_prices(d, [(date(2026, 9, 20), "A")], history, {"A": "g"}, "kg")
    # 기간 앞 마지막 값(9/28)부터 이어지고, 10/3에 바뀐 뒤로는 새 값이 이어진다
    assert prices == [Decimal("15000.000")] * 2 + [Decimal("16000.000")] * 3


def test_daily_unit_prices_joins_across_link_change() -> None:
    d = _days(date(2026, 10, 1), 4)
    links = [(date(2026, 9, 1), "A"), (date(2026, 10, 3), "B")]
    history = {"A": [(date(2026, 9, 1), Decimal("15"))], "B": [(date(2026, 9, 30), Decimal("12"))]}
    prices = daily_unit_prices(d, links, history, {"A": "g", "B": "g"}, "kg")
    # 연결이 바뀐 날부터 새 상품의 그날 단가로 이어진다
    assert prices == [Decimal("15000.000")] * 2 + [Decimal("12000.000")] * 2


def test_daily_unit_prices_none_before_link_or_history() -> None:
    d = _days(date(2026, 10, 1), 4)
    history = {"A": [(date(2026, 10, 3), Decimal("10"))]}
    prices = daily_unit_prices(d, [(date(2026, 10, 2), "A")], history, {"A": "개"}, "개")
    # 10/1은 연결 전, 10/2는 연결됐지만 이력 전
    assert prices == [None, None, Decimal("10.000"), Decimal("10.000")]
    # 재료 단위로 바꿀 수 없으면 값이 없다
    assert daily_unit_prices(d, [(date(2026, 9, 1), "A")], history, {"A": "g"}, "개") == [None] * 4
