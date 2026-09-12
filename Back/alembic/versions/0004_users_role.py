"""users: role(OWNER/ADMIN) 추가 — 관리자 심사 (M3.B9, PR-B).

관리자는 DB에서 수동으로 ADMIN 지정 (가입 경로로 부여 불가, 12_security.md §5.1).

Revision ID: 0004_users_role
Revises: 0003_business_status_enum
Create Date: 2026-05-29
"""
from __future__ import annotations

from alembic import op

revision = "0004_users_role"
down_revision = "0003_business_status_enum"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
            ADD COLUMN role ENUM('OWNER','ADMIN') NOT NULL DEFAULT 'OWNER'
                COMMENT '점주/관리자 — 관리자는 운영자 계정만 수동 지정' AFTER name
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN role")
