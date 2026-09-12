"""inventory_items: current_quantity 추가 — 간소화된 재고 수량 CRUD.

lots/FIFO 기반 입출고 이력(schema.md §3.9~11)은 후속 마일스톤. 그 전까지
품목당 단일 수치로 현재 수량을 직접 관리한다.

Revision ID: 0005_inventory_current_quantity
Revises: 0004_users_role
Create Date: 2026-08-08
"""
from __future__ import annotations

from alembic import op

revision = "0005_inventory_current_quantity"
down_revision = "0004_users_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE inventory_items
            ADD COLUMN current_quantity DECIMAL(10,3) NOT NULL DEFAULT 0
                COMMENT '간소화된 현재 재고 수량 (lots 도입 전)' AFTER unit
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE inventory_items DROP COLUMN current_quantity")
