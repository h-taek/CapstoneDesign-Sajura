"""PurchaseOrder ORM — 발주추천 승인(확정) 기록.

lots/FIFO 기반 실제 입고 처리(schema.md §3.9~11)는 후속 마일스톤. 그 전까지
점주가 확정한 발주 품목·수량 스냅샷만 JSON으로 저장한다.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import CHAR, JSON, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, new_uuid


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    order_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    store_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("stores.store_id", ondelete="CASCADE"), nullable=False, index=True
    )
    # [{item_id, name, unit, quantity}, ...] 확정 시점 스냅샷
    items: Mapped[list] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="CONFIRMED")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
