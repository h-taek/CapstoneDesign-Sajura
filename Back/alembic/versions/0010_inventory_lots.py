"""재고 로트 전환 — current_quantity를 로트로 옮기고 차감 기준 시각·재고 확인 필요 추가.

08_schema.md §3.8·§3.9, 04_feature_spec.md §3.3.
- 기존 current_quantity > 0인 품목은 로트 1개로 옮긴다(구매 금액 0, 입고일 = 등록일).
- deducted_until은 판매 시각(sold_at, 매장 현지 KST)과 같은 기준이라
  UTC인 created_at에 9시간을 더한다.
- inventory_lots.unit_price → purchase_price(로트 구매 총액).

Revision ID: 0010_inventory_lots
Revises: 0009_users_withdrawn_at
Create Date: 2026-10-19
"""

from __future__ import annotations

from alembic import op

revision = "0010_inventory_lots"
down_revision = "0009_users_withdrawn_at"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE inventory_lots
            CHANGE COLUMN unit_price purchase_price INT NOT NULL
                COMMENT '로트 구매 총액(원). 단위당 단가 = purchase_price / quantity'
        """
    )
    op.execute(
        """
        INSERT INTO inventory_lots
            (lot_id, item_id, quantity, remaining_quantity, purchase_price,
             received_at, expiry_date)
        SELECT UUID(), item_id, current_quantity, current_quantity, 0,
               DATE(created_at + INTERVAL 9 HOUR), NULL
        FROM inventory_items
        WHERE current_quantity > 0
        """
    )
    op.execute(
        """
        ALTER TABLE inventory_items
            ADD COLUMN deducted_until DATETIME NULL
                COMMENT '차감 기준 시각(매장 현지 시각). 이 시각보다 뒤에 팔린 판매만 차감'
                AFTER safety_stock,
            ADD COLUMN needs_check TINYINT(1) NOT NULL DEFAULT 0
                COMMENT '재고 확인 필요' AFTER deducted_until
        """
    )
    op.execute("UPDATE inventory_items SET deducted_until = created_at + INTERVAL 9 HOUR")
    op.execute(
        """
        ALTER TABLE inventory_items
            MODIFY COLUMN deducted_until DATETIME NOT NULL
                COMMENT '차감 기준 시각(매장 현지 시각). 이 시각보다 뒤에 팔린 판매만 차감',
            DROP COLUMN current_quantity
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE inventory_items
            ADD COLUMN current_quantity DECIMAL(10,3) NOT NULL DEFAULT 0
                COMMENT '간소화된 현재 재고 수량 (lots 도입 전)' AFTER unit
        """
    )
    op.execute(
        """
        UPDATE inventory_items i
        SET current_quantity = COALESCE(
            (SELECT SUM(l.remaining_quantity) FROM inventory_lots l WHERE l.item_id = i.item_id), 0
        )
        """
    )
    # 0010 전에는 로트를 쓰는 코드가 없었다. 남겨 두면 재-upgrade 때 수량이 두 번 옮겨진다.
    op.execute("DELETE FROM inventory_adjustment_logs")
    op.execute("DELETE FROM disposal_logs")
    op.execute("DELETE FROM inventory_lots")
    op.execute("ALTER TABLE inventory_items DROP COLUMN needs_check, DROP COLUMN deducted_until")
    op.execute("ALTER TABLE inventory_lots CHANGE COLUMN purchase_price unit_price INT NOT NULL")
