"""재고 ORM — 02_implementation_design.md §4.3.8~§4.3.11.

로트·조정 이력·폐기 이력 테이블은 0001_init에 존재.
"""

from __future__ import annotations

import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CHAR,
    DECIMAL,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, new_uuid


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    item_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    store_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("stores.store_id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    low_stock_threshold: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False, default=0)
    lead_time_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    safety_stock: Mapped[Decimal | None] = mapped_column(DECIMAL(10, 3), nullable=True)
    # 판매 시각(sold_at)과 같은 매장 현지 시각(KST, naive). 01_basic_design.md §3.3.3
    deducted_until: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    needs_check: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # 연결된 공용 쿠팡 상품 — 01_basic_design.md §3.3.1·§3.8.1
    coupang_item_id: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("coupang_products.item_id"), nullable=True
    )
    coupang_linked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )


class InventoryLot(Base):
    __tablename__ = "inventory_lots"

    lot_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    item_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("inventory_items.item_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False)
    remaining_quantity: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False)
    purchase_price: Mapped[int] = mapped_column(Integer, nullable=False)
    received_at: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )


class AdjustmentReason(str, enum.Enum):
    STOCKTAKE = "STOCKTAKE"
    EXPIRY_CORRECTION = "EXPIRY_CORRECTION"
    OTHER = "OTHER"


class InventoryAdjustmentLog(Base):
    __tablename__ = "inventory_adjustment_logs"

    adjustment_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    lot_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("inventory_lots.lot_id"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("inventory_items.item_id"), nullable=False, index=True
    )
    store_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("stores.store_id"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.user_id"), nullable=False)
    before_quantity: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False)
    after_quantity: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False)
    delta_quantity: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False)
    before_expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    after_expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    reason: Mapped[AdjustmentReason] = mapped_column(
        Enum(AdjustmentReason, name="adjustment_reason"), nullable=False
    )
    memo: Mapped[str | None] = mapped_column(String(255), nullable=True)
    adjusted_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )


class DisposalLog(Base):
    __tablename__ = "disposal_logs"

    disposal_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    lot_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("inventory_lots.lot_id"), nullable=False
    )
    item_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("inventory_items.item_id"), nullable=False, index=True
    )
    store_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("stores.store_id"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("users.user_id"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    disposed_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
