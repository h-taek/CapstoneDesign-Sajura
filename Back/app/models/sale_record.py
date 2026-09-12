"""SaleRecord ORM — 08_schema.md §3.14. 테이블은 0001_init.py에 정의됨."""
from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import CHAR, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, new_uuid


class SaleSource(str, enum.Enum):
    POS = "POS"
    CSV = "CSV"


class SaleRecord(Base):
    __tablename__ = "sale_records"

    sale_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    store_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("stores.store_id"), nullable=False, index=True
    )
    menu_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("menus.menu_id"), nullable=False, index=True
    )
    external_sale_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[int] = mapped_column(Integer, nullable=False)
    total_price: Mapped[int] = mapped_column(Integer, nullable=False)
    sold_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    source: Mapped[SaleSource] = mapped_column(
        Enum(SaleSource, name="sale_source"), nullable=False, default=SaleSource.POS
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp()
    )
