"""추천발주·발주 ORM — 02_implementation_design.md §4.3.16~§4.3.20 (테이블은 0001_init에 존재)."""

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


class ConfigStatus(str, enum.Enum):
    USER_CONFIGURED = "USER_CONFIGURED"
    DEFAULT_USED = "DEFAULT_USED"


class OrderStatus(str, enum.Enum):
    APPROVED = "APPROVED"
    AUTOMATED = "AUTOMATED"
    MANUAL_REQUIRED = "MANUAL_REQUIRED"


class ReceiptStatus(str, enum.Enum):
    PENDING = "PENDING"
    RECEIVED = "RECEIVED"
    SKIPPED = "SKIPPED"


class OrderRecommendation(Base):
    __tablename__ = "order_recommendations"

    recommendation_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    store_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("stores.store_id"), nullable=False, index=True
    )
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )


class OrderRecommendationItem(Base):
    __tablename__ = "order_recommendation_items"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    recommendation_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("order_recommendations.recommendation_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("inventory_items.item_id"), nullable=False
    )
    recommended_quantity: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False)
    lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False)
    safety_stock: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False)
    config_status: Mapped[ConfigStatus] = mapped_column(
        Enum(ConfigStatus, name="config_status"), nullable=False
    )
    last_price: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Order(Base):
    __tablename__ = "orders"

    order_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    store_id: Mapped[str] = mapped_column(CHAR(36), ForeignKey("stores.store_id"), nullable=False)
    # 추천안 하나에 발주 하나 — 수동 발주(NULL)는 여러 건 허용
    recommendation_id: Mapped[str | None] = mapped_column(
        CHAR(36), ForeignKey("order_recommendations.recommendation_id"), unique=True, nullable=True
    )
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status"), nullable=False, default=OrderStatus.APPROVED
    )
    total_estimated_cost: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    approved_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
    automated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    order_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("inventory_items.item_id"), nullable=False
    )
    final_quantity: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False)
    # 확정 시점 단가 — 미설정이면 단가·소계 모두 NULL (01_basic_design.md §3.7.4)
    unit_price: Mapped[Decimal | None] = mapped_column(DECIMAL(12, 3), nullable=True)
    subtotal: Mapped[int | None] = mapped_column(Integer, nullable=True)
    receipt_status: Mapped[ReceiptStatus] = mapped_column(
        Enum(ReceiptStatus, name="receipt_status"), nullable=False, default=ReceiptStatus.PENDING
    )
    lot_id: Mapped[str | None] = mapped_column(
        CHAR(36), ForeignKey("inventory_lots.lot_id"), nullable=True
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class OrderApprovalLog(Base):
    __tablename__ = "order_approval_logs"

    id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    order_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("orders.order_id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("inventory_items.item_id"), nullable=False
    )
    recommended_quantity: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False)
    final_quantity: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False)
    was_modified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
