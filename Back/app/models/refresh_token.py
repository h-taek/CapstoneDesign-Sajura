"""RefreshToken ORM — 08_schema.md §3."""
from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CHAR, Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, new_uuid

if TYPE_CHECKING:
    from app.models.user import User


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    token_id: Mapped[str] = mapped_column(CHAR(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        CHAR(36), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")
