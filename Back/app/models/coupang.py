"""공용 쿠팡 상품·가격 후보 ORM — 02_implementation_design.md §4.3.12·§4.3.24 (테이블은 0016)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CHAR, DECIMAL, Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, new_uuid


class CoupangProduct(Base):
    """매장 공용 쿠팡 상품 — 확장이 담기에 성공한 상품의 값만 들어온다.

    01_basic_design.md §3.3.1.
    """

    __tablename__ = "coupang_products"

    coupang_product_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    product_id: Mapped[str] = mapped_column(String(20), nullable=False)
    vendor_item_id: Mapped[str] = mapped_column(String(20), nullable=False)
    product_name: Mapped[str] = mapped_column(String(300), nullable=False)
    sale_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    content_quantity: Mapped[Decimal | None] = mapped_column(DECIMAL(10, 3), nullable=True)
    content_unit: Mapped[str | None] = mapped_column(String(10), nullable=True)
    rocket_fresh: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class CoupangPriceCandidate(Base):
    """공용 판매가와 20% 이상 다른 값 — 다른 매장 확인 전까지 보관한다."""

    __tablename__ = "coupang_price_candidates"

    coupang_product_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("coupang_products.coupang_product_id", ondelete="CASCADE"),
        primary_key=True,
    )
    store_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("stores.store_id", ondelete="CASCADE"), primary_key=True
    )
    sale_price: Mapped[int] = mapped_column(Integer, nullable=False)
    received_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
