"""쿠팡 자동 담기 — 공용 쿠팡 상품·가격 후보, 재고 품목 연결 칸.

02_implementation_design.md §4.3.8·§4.3.12·§4.3.24.

- coupang_products·coupang_price_candidates 생성
- inventory_items에 coupang_product_id·coupang_linked_at·pack_quantity
- sites·inventory_item_sites·order_recommendation_items.last_price 삭제
  — 단가 출처는 공용 쿠팡 상품 하나다 (01_basic_design.md §3.3.1)

Revision ID: 0017_coupang_cart
Revises: 0016_weather_observations
Create Date: 2026-10-28
"""

from __future__ import annotations

from alembic import op

revision = "0017_coupang_cart"
down_revision = "0016_weather_observations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE coupang_products (
            coupang_product_id  CHAR(36)        NOT NULL,
            product_id          VARCHAR(20)     NOT NULL COMMENT '쿠팡 productId',
            vendor_item_id      VARCHAR(20)     NOT NULL COMMENT '쿠팡 vendorItemId',
            product_name        VARCHAR(300)    NOT NULL,
            sale_price          INT             NULL COMMENT '판매가(원). 조건 없이 누구나 받는 표시 가격. 와우 할인 상품으로만 관찰되면 NULL',
            content_quantity    DECIMAL(10,3)   NULL COMMENT '상품 1개 용량. 쿠팡 단위가격 표시에서 계산. 모르면 NULL',
            content_unit        VARCHAR(10)     NULL COMMENT '용량 단위 (g·ml·개·구 등)',
            rocket_fresh        TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '로켓프레시 상품 여부. 비로그인 담기 불가',
            updated_at          DATETIME        NOT NULL COMMENT '확장이 마지막으로 값을 보낸 시각',
            PRIMARY KEY (coupang_product_id),
            UNIQUE KEY uq_coupang_products_item (product_id, vendor_item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    op.execute(
        """
        CREATE TABLE coupang_price_candidates (
            coupang_product_id  CHAR(36)        NOT NULL,
            store_id            CHAR(36)        NOT NULL COMMENT '후보를 보낸 매장',
            sale_price          INT             NOT NULL COMMENT '보낸 판매가(원)',
            received_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (coupang_product_id, store_id),
            CONSTRAINT fk_price_candidates_product FOREIGN KEY (coupang_product_id)
                REFERENCES coupang_products (coupang_product_id) ON DELETE CASCADE,
            CONSTRAINT fk_price_candidates_store FOREIGN KEY (store_id)
                REFERENCES stores (store_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    op.execute(
        """
        ALTER TABLE inventory_items
            ADD COLUMN coupang_product_id CHAR(36) NULL
                COMMENT '연결된 공용 쿠팡 상품 (01_basic_design.md §3.3.1)' AFTER needs_check,
            ADD COLUMN coupang_linked_at DATETIME NULL
                COMMENT '검색으로 고른 상품을 연결한 시각. 자동 담기 검색 주기 기준 (01_basic_design.md §3.8.1)'
                AFTER coupang_product_id,
            ADD COLUMN pack_quantity DECIMAL(10,3) NULL
                COMMENT '연결 상품 1개에 든 재료 수량(재료 단위). LLM 판정 또는 점주 입력'
                AFTER coupang_linked_at,
            ADD CONSTRAINT fk_inventory_items_coupang_product FOREIGN KEY (coupang_product_id)
                REFERENCES coupang_products (coupang_product_id)
        """
    )
    op.execute("DROP TABLE inventory_item_sites")
    op.execute("DROP TABLE sites")
    op.execute("ALTER TABLE order_recommendation_items DROP COLUMN last_price")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE order_recommendation_items ADD COLUMN last_price INT NULL AFTER config_status"
    )
    op.execute(
        """
        CREATE TABLE sites (
            site_id     CHAR(36)        NOT NULL,
            name        VARCHAR(50)     NOT NULL,
            base_url    VARCHAR(255)    NOT NULL,
            is_active   TINYINT(1)      NOT NULL DEFAULT 1,
            PRIMARY KEY (site_id),
            UNIQUE KEY uq_sites_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    op.execute(
        """
        CREATE TABLE inventory_item_sites (
            id              CHAR(36)        NOT NULL,
            item_id         CHAR(36)        NOT NULL,
            site_id         CHAR(36)        NOT NULL,
            product_url     VARCHAR(500)    NOT NULL,
            last_price      INT             NULL,
            last_scraped_at DATETIME        NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_item_site (item_id, site_id),
            CONSTRAINT fk_item_sites_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id) ON DELETE CASCADE,
            CONSTRAINT fk_item_sites_site FOREIGN KEY (site_id) REFERENCES sites (site_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    op.execute(
        """
        ALTER TABLE inventory_items
            DROP FOREIGN KEY fk_inventory_items_coupang_product,
            DROP COLUMN coupang_product_id,
            DROP COLUMN coupang_linked_at,
            DROP COLUMN pack_quantity
        """
    )
    op.execute("DROP TABLE coupang_price_candidates")
    op.execute("DROP TABLE coupang_products")
