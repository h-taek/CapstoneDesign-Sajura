"""purchase_orders 테이블 제거 — 발주 확정은 orders·order_items·order_approval_logs로 이전.

08_schema.md §3.19~§3.21 테이블은 0001_init에 이미 있다. 기존 JSON 스냅샷 행은 옮기지 않는다.

Revision ID: 0007_drop_purchase_orders
Revises: 0006_purchase_orders
Create Date: 2026-10-03
"""
from __future__ import annotations

from alembic import op

revision = "0007_drop_purchase_orders"
down_revision = "0006_purchase_orders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TABLE purchase_orders")


def downgrade() -> None:
    op.execute(
        """
        CREATE TABLE purchase_orders (
            order_id CHAR(36) NOT NULL PRIMARY KEY,
            store_id CHAR(36) NOT NULL,
            items JSON NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY ix_purchase_orders_store_id (store_id),
            CONSTRAINT fk_purchase_orders_store
                FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
