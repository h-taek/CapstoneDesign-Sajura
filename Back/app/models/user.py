"""User ORM — 02_implementation_design.md §4.3 users."""
from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CHAR, Boolean, DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_uuid

if TYPE_CHECKING:
    from app.models.refresh_token import RefreshToken
    from app.models.store import Store


class AuthProvider(str, enum.Enum):
    LOCAL = "LOCAL"
    KAKAO = "KAKAO"
    GOOGLE = "GOOGLE"


class UserRole(str, enum.Enum):
    OWNER = "OWNER"   # 점주 (기본)
    ADMIN = "ADMIN"   # 운영자 — DB에서 수동 지정 (03_be.md §8.1)


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), nullable=False, default=UserRole.OWNER
    )
    auth_provider: Mapped[AuthProvider] = mapped_column(
        Enum(AuthProvider, name="auth_provider"), nullable=False, default=AuthProvider.LOCAL
    )
    social_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # 회원 탈퇴 시각 — 값이 있으면 파기 유예 중 (01_basic_design.md §5.2.1)
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # 알림 설정 묶음 (01_basic_design.md §3.12)
    notify_expiry: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_stock_low: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_forecast_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notify_anomaly: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.current_timestamp(), onupdate=func.current_timestamp()
    )

    store: Mapped["Store | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
