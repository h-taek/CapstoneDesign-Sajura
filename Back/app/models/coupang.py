"""공용 쿠팡 상품·매장 가격·단가 이력·재고 연결 이력 ORM.

02_implementation_design.md §4.3.12·§4.3.24·§4.3.26·§4.3.27 (테이블은 0017·0018).
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CHAR, DECIMAL, Boolean, Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, new_uuid


class CoupangProduct(Base):
    """매장 공용 쿠팡 상품 — 쿠팡 옵션(itemId) 하나당 한 행. 01_basic_design.md §3.3.1."""

    __tablename__ = "coupang_products"

    item_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    product_id: Mapped[str] = mapped_column(String(20), nullable=False)
    vendor_item_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    product_name: Mapped[str] = mapped_column(String(300), nullable=False)
    option_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    sale_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rocket_fresh: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    content_quantity: Mapped[Decimal | None] = mapped_column(DECIMAL(12, 3), nullable=True)
    content_unit: Mapped[str | None] = mapped_column(String(4), nullable=True)
    unit_price: Mapped[Decimal | None] = mapped_column(DECIMAL(12, 4), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CoupangStorePrice(Base):
    """매장 가격 — 매장마다 마지막으로 본 옵션의 판매가·단가. 이틀마다 모두 지운다."""

    __tablename__ = "coupang_store_prices"

    item_id: Mapped[str] = mapped_column(
        String(20), ForeignKey("coupang_products.item_id", ondelete="CASCADE"), primary_key=True
    )
    store_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("stores.store_id", ondelete="CASCADE"), primary_key=True
    )
    sale_price: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal | None] = mapped_column(DECIMAL(12, 4), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CoupangPriceHistory(Base):
    """공용 단가 이력 — 옵션마다 하루(한국 시각) 한 행, 그날 마지막 공용 단가. 지우지 않는다."""

    __tablename__ = "coupang_price_history"

    item_id: Mapped[str] = mapped_column(
        String(20), ForeignKey("coupang_products.item_id", ondelete="CASCADE"), primary_key=True
    )
    price_date: Mapped[date] = mapped_column(Date, primary_key=True)
    unit_price: Mapped[Decimal] = mapped_column(DECIMAL(12, 4), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class InventoryCoupangLink(Base):
    """재고 품목의 쿠팡 상품 연결 이력 — 연결이 바뀔 때마다(처음 포함) 한 행. 지우지 않는다."""

    __tablename__ = "inventory_coupang_links"

    link_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    item_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("inventory_items.item_id", ondelete="CASCADE"), nullable=False
    )
    coupang_item_id: Mapped[str] = mapped_column(
        String(20), ForeignKey("coupang_products.item_id"), nullable=False
    )
    linked_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
