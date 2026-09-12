"""Store ORM — 08_schema.md §3 stores."""
from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CHAR, Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_uuid

if TYPE_CHECKING:
    from app.models.user import User


class StoreSize(str, enum.Enum):
    SMALL = "SMALL"
    MEDIUM = "MEDIUM"
    LARGE = "LARGE"


class OperationType(str, enum.Enum):
    HALL = "HALL"
    DELIVERY = "DELIVERY"
    BOTH = "BOTH"


class BusinessStatus(str, enum.Enum):
    UNVERIFIED = "UNVERIFIED"   # 초기 — 사업자 검증 전
    PENDING = "PENDING"         # NTS 통과 + 등록증 업로드, 관리자 심사 대기
    VERIFIED = "VERIFIED"       # 관리자 승인 (또는 마스터 코드)
    REJECTED = "REJECTED"       # 관리자 반려 — 재검증 필요


class Store(Base):
    __tablename__ = "stores"

    store_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("users.user_id", ondelete="CASCADE"), unique=True, nullable=False
    )
    store_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    business_no: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    business_status: Mapped[BusinessStatus] = mapped_column(
        Enum(BusinessStatus, name="business_status"),
        nullable=False, default=BusinessStatus.UNVERIFIED,
    )
    business_cert_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    business_reject_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    business_reviewed_by: Mapped[str | None] = mapped_column(CHAR(36), nullable=True)
    business_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    store_size: Mapped[StoreSize | None] = mapped_column(Enum(StoreSize, name="store_size"), nullable=True)
    operation_type: Mapped[OperationType | None] = mapped_column(
        Enum(OperationType, name="operation_type"), nullable=True
    )
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    user: Mapped["User"] = relationship(back_populates="store")
