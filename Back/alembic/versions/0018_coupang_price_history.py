"""쿠팡 공용 단가 이력·재고 품목 연결 이력 — 재고 품목 단가 추세.

02_implementation_design.md §4.3.26·§4.3.27, 01_basic_design.md §3.3.1.

- coupang_price_history(옵션·날짜당 한 행, 그날 마지막 공용 단가) 생성
- inventory_coupang_links(연결이 바뀔 때마다 한 행) 생성
- 이미 있는 값으로 첫 행을 채운다 — 공용 단가가 있는 옵션은 마지막 갱신 날짜(한국 시각) 행,
  연결된 재고 품목은 연결 시각(없으면 품목 수정 시각) 행

Revision ID: 0018_coupang_price_history
Revises: 0017_coupang_cart
Create Date: 2026-10-31
"""

from __future__ import annotations

from alembic import op

revision = "0018_coupang_price_history"
down_revision = "0017_coupang_cart"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE coupang_price_history (
            item_id             VARCHAR(20)     NOT NULL COMMENT '쿠팡 itemId',
            price_date          DATE            NOT NULL COMMENT '공용 단가를 정한 날짜(한국 시각)',
            unit_price          DECIMAL(12,4)   NOT NULL
                COMMENT '그날 마지막으로 정한 공용 단가(용량 단위 1당 원)',
            updated_at          DATETIME        NOT NULL COMMENT '그날 마지막으로 덮어쓴 시각',
            PRIMARY KEY (item_id, price_date),
            CONSTRAINT fk_price_history_product FOREIGN KEY (item_id)
                REFERENCES coupang_products (item_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    op.execute(
        """
        CREATE TABLE inventory_coupang_links (
            link_id             CHAR(36)        NOT NULL,
            item_id             CHAR(36)        NOT NULL COMMENT '매장 재고 품목',
            coupang_item_id     VARCHAR(20)     NOT NULL COMMENT '연결한 공용 쿠팡 상품 itemId',
            linked_at           DATETIME        NOT NULL COMMENT '연결한 시각',
            PRIMARY KEY (link_id),
            KEY idx_inventory_coupang_links_item (item_id, linked_at),
            CONSTRAINT fk_coupang_links_item FOREIGN KEY (item_id)
                REFERENCES inventory_items (item_id) ON DELETE CASCADE,
            CONSTRAINT fk_coupang_links_product FOREIGN KEY (coupang_item_id)
                REFERENCES coupang_products (item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    # 시각 칸은 UTC naive로 저장한다 — 한국 날짜는 9시간을 더해 정한다
    op.execute(
        """
        INSERT INTO coupang_price_history (item_id, price_date, unit_price, updated_at)
        SELECT item_id, DATE(DATE_ADD(updated_at, INTERVAL 9 HOUR)), unit_price, updated_at
        FROM coupang_products
        WHERE unit_price IS NOT NULL
        """
    )
    op.execute(
        """
        INSERT INTO inventory_coupang_links (link_id, item_id, coupang_item_id, linked_at)
        SELECT UUID(), item_id, coupang_item_id, COALESCE(coupang_linked_at, updated_at)
        FROM inventory_items
        WHERE coupang_item_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE inventory_coupang_links")
    op.execute("DROP TABLE coupang_price_history")
