"""purchase_orders 테이블 추가 — 발주추천 승인(확정) 기록.

lots 기반 실제 입고 처리 전까지, 점주가 확정한 발주 품목·수량 스냅샷만 JSON으로 저장.

Revision ID: 0006_purchase_orders
Revises: 0005_inventory_current_quantity
Create Date: 2026-08-10
"""
from __future__ import annotations

from alembic import op

revision = "0006_purchase_orders"
down_revision = "0005_inventory_current_quantity"
branch_labels = None
depends_on = None


def upgrade() -> None:
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


def downgrade() -> None:
    op.execute("DROP TABLE purchase_orders")
