"""InventoryItem ORM — schema.md §3."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CHAR, DECIMAL, DateTime, ForeignKey, Integer, String, func
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
    # 간소화된 현재 수량 — schema.md §3.9 inventory_lots(배치·FIFO) 설계 전 단계의
    # 단일 수치 재고. lots 기반 입출고 이력이 도입되면 이 컬럼은 대체될 수 있다.
    current_quantity: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False, default=0)
    low_stock_threshold: Mapped[Decimal] = mapped_column(DECIMAL(10, 3), nullable=False, default=0)
    lead_time_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    safety_stock: Mapped[Decimal | None] = mapped_column(DECIMAL(10, 3), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )
