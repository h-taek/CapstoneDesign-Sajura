"""재고 차감 ON 메뉴는 레시피 필수 — 01_basic_design.md §3.2.

- 레시피 재료가 없는 재고 차감 ON 메뉴를 OFF로 바꾼다. 판매 차감은 원래 레시피 없는
  메뉴를 건너뛰므로 동작은 같다.
- 기본값을 0으로: 등록 시점엔 레시피가 없다.

Revision ID: 0011_menu_deduction_recipe
Revises: 0010_inventory_lots
Create Date: 2026-10-25
"""

from __future__ import annotations

from alembic import op

revision = "0011_menu_deduction_recipe"
down_revision = "0010_inventory_lots"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE menus m
           SET m.use_inventory_deduction = 0
         WHERE m.use_inventory_deduction = 1
           AND NOT EXISTS (
               SELECT 1 FROM recipes r
                 JOIN recipe_ingredients ri ON ri.recipe_id = r.recipe_id
                WHERE r.menu_id = m.menu_id
           )
        """
    )
    op.execute(
        """
        ALTER TABLE menus
            MODIFY COLUMN use_inventory_deduction TINYINT(1) NOT NULL DEFAULT 0
                COMMENT '재고 차감 사용 여부. 1이면 재료 1개 이상의 레시피 필수'
        """
    )


def downgrade() -> None:
    # OFF로 바꾼 메뉴는 되돌리지 않는다(원래 값 기록 없음)
    op.execute(
        """
        ALTER TABLE menus
            MODIFY COLUMN use_inventory_deduction TINYINT(1) NOT NULL DEFAULT 1
                COMMENT '재고 차감 사용 여부'
        """
    )
