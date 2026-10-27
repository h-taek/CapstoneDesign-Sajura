"""발주 품목 입고 처리·확정 단가.

01_basic_design.md §3.7.4·§3.7.5, 02_implementation_design.md §4.3.20.

- orders.recommendation_id 유니크 — 추천안 하나에 발주 하나
- order_items.unit_price DECIMAL NULL(단가 미설정이면 NULL)·subtotal NULL 허용
- order_items 입고 상태·입고 로트·처리 시각

Revision ID: 0012_order_receipt
Revises: 0011_menu_deduction_recipe
Create Date: 2026-10-28
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0012_order_receipt"
down_revision = "0011_menu_deduction_recipe"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE orders ADD UNIQUE KEY uq_orders_recommendation_id (recommendation_id)"
    )
    op.execute(
        """
        ALTER TABLE order_items
            MODIFY COLUMN unit_price DECIMAL(12,3) NULL
                COMMENT '확정 시점 재료 단위당 단가(원). 미설정이면 NULL',
            MODIFY COLUMN subtotal INT NULL
                COMMENT 'round(final_quantity × unit_price). unit_price가 NULL이면 NULL',
            ADD COLUMN receipt_status ENUM('PENDING','RECEIVED','SKIPPED') NOT NULL
                DEFAULT 'PENDING' AFTER subtotal,
            ADD COLUMN lot_id CHAR(36) NULL COMMENT '입고 처리로 만든 로트' AFTER receipt_status,
            ADD COLUMN processed_at DATETIME NULL COMMENT '입고 처리·입고 안 함 시각' AFTER lot_id,
            ADD KEY idx_order_items_item_status (item_id, receipt_status),
            ADD CONSTRAINT fk_order_items_lot
                FOREIGN KEY (lot_id) REFERENCES inventory_lots (lot_id)
        """
    )


def _ensure_fk_index(table: str, name: str, column: str) -> None:
    """MySQL은 새 인덱스가 외래 키를 맡으면 외래 키 자동 인덱스를 지운다 — 없으면 다시 만든다."""
    exists = op.get_bind().execute(
        sa.text(
            """
            SELECT 1 FROM information_schema.statistics
             WHERE table_schema = DATABASE() AND table_name = :t AND index_name = :n
            """
        ),
        {"t": table, "n": name},
    ).first()
    if exists is None:
        op.execute(f"ALTER TABLE {table} ADD KEY {name} ({column})")


def downgrade() -> None:
    op.execute("ALTER TABLE order_items DROP FOREIGN KEY fk_order_items_lot")
    _ensure_fk_index("order_items", "fk_order_items_item", "item_id")
    op.execute(
        """
        ALTER TABLE order_items
            DROP KEY idx_order_items_item_status,
            DROP COLUMN processed_at,
            DROP COLUMN lot_id,
            DROP COLUMN receipt_status
        """
    )
    op.execute("UPDATE order_items SET unit_price = 0 WHERE unit_price IS NULL")
    op.execute("UPDATE order_items SET subtotal = 0 WHERE subtotal IS NULL")
    op.execute(
        """
        ALTER TABLE order_items
            MODIFY COLUMN unit_price INT NOT NULL,
            MODIFY COLUMN subtotal INT NOT NULL
        """
    )
    _ensure_fk_index("orders", "fk_orders_recommendation", "recommendation_id")
    op.execute("ALTER TABLE orders DROP INDEX uq_orders_recommendation_id")
