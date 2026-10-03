"""users: withdrawn_at 추가 — 회원 탈퇴 30일 유예 (12_security.md §3.1).

Revision ID: 0009_users_withdrawn_at
Revises: 0008_encrypt_pos_api_key
Create Date: 2026-10-03
"""

from __future__ import annotations

from alembic import op

revision = "0009_users_withdrawn_at"
down_revision = "0008_encrypt_pos_api_key"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
            ADD COLUMN withdrawn_at DATETIME NULL
                COMMENT '회원 탈퇴 시각 — 값이 있으면 파기 유예 중' AFTER social_id
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN withdrawn_at")
