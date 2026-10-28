"""쿠팡 상품 용량·포장 수량·단가 계산 — 01_basic_design.md §3.3.1."""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.services.coupang_pricing import (
    Content,
    content_from_name,
    content_from_unit_price,
    name_mismatch,
    pack_quantity,
    to_item_unit,
    unit_price,
)


@pytest.mark.parametrize(
    ("price", "text", "expected"),
    [
        (11740, "100g당 2,348원", Content(Decimal("500"), "g")),
        (12000, "10g당 600원", Content(Decimal("200"), "g")),
        (9460, "1구당 946원", Content(Decimal("10"), "구")),
        (5460, "(100ml당 546원)", Content(Decimal("1000"), "ml")),
        (9900, "1세트당 9,900원", Content(Decimal("1"), "세트")),
        (9900, None, None),
        (9900, "단위가격 없음", None),
    ],
)
def test_content_from_unit_price(price: int, text: str | None, expected: Content | None) -> None:
    assert content_from_unit_price(price, text) == expected


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("돼지 삼겹살 (냉장), 500g, 4개", Content(Decimal("2000"), "g")),
        ("알부자집 대란 30구, 1개", Content(Decimal("30"), "구")),
        ("착한가격 삼겹살 구이용, 1박스, 1kg", Content(Decimal("1"), "kg")),
        ("미국산 삼겹살 구이용 (냉장), 1개, 1kg", Content(Decimal("1"), "kg")),
        ("일회용 간장 30개, 10ml", Content(Decimal("300"), "ml")),
        ("해표 콩기름 1.8L, 6개", Content(Decimal("10.8"), "L")),
        ("대파 1,000g", Content(Decimal("1000"), "g")),
        ("햇양파", None),
        ("삼겹살 500g + 목살 1kg", None),
    ],
)
def test_content_from_name(name: str, expected: Content | None) -> None:
    assert content_from_name(name) == expected


def test_to_item_unit_converts_within_family_only() -> None:
    assert to_item_unit(Content(Decimal("500"), "g"), "kg") == Decimal("0.5")
    assert to_item_unit(Content(Decimal("1.8"), "L"), "ml") == Decimal("1800")
    assert to_item_unit(Content(Decimal("30"), "구"), "개") == Decimal("30")
    assert to_item_unit(Content(Decimal("500"), "g"), "ml") is None  # 환산 불가
    assert to_item_unit(Content(Decimal("1"), "세트"), "개") is None
    assert to_item_unit(None, "g") is None


def test_name_mismatch_over_two_percent() -> None:
    name = "삼겹살, 500g, 4개"  # 2000g
    assert not name_mismatch(Content(Decimal("2040"), "g"), name)  # 2.0%
    assert name_mismatch(Content(Decimal("2041"), "g"), name)
    assert not name_mismatch(Content(Decimal("2"), "kg"), name)
    assert not name_mismatch(Content(Decimal("9999"), "g"), "햇양파")  # 표기 없으면 대조 안 함
    assert not name_mismatch(Content(Decimal("10"), "구"), name)  # 단위 계열이 다르면 대조 안 함


def test_unit_price_from_content_then_pack_quantity() -> None:
    kg = Content(Decimal("1"), "kg")
    assert unit_price(sale_price=28000, content=kg, item_unit="g", stored_pack=None) == Decimal(28)
    # 용량이 환산되지 않으면 포장 수량
    box = Content(Decimal("1"), "세트")
    assert unit_price(sale_price=9900, content=box, item_unit="개", stored_pack=Decimal(30)) == (
        Decimal(330)
    )
    assert unit_price(sale_price=9900, content=None, item_unit="개", stored_pack=None) is None
    assert unit_price(sale_price=None, content=kg, item_unit="g", stored_pack=None) is None


def test_pack_quantity_prefers_converted_content() -> None:
    assert pack_quantity(Content(Decimal("1"), "kg"), "g", Decimal(7)) == Decimal(1000)
    assert pack_quantity(Content(Decimal("1"), "세트"), "g", Decimal(7)) == Decimal(7)
    assert pack_quantity(None, "g", None) is None
