"""쿠팡 자동 담기 — 공용 쿠팡 상품·매장 가격, 재고 품목 연결 칸, 발주 상태 삭제.

02_implementation_design.md §4.3.8·§4.3.12·§4.3.18·§4.3.24.

- coupang_products(쿠팡 옵션 itemId 한 행)·coupang_store_prices 생성
- inventory_items에 coupang_item_id·coupang_linked_at
- sites·inventory_item_sites·order_recommendation_items.last_price 삭제
  — 단가 출처는 공용 쿠팡 상품 하나다 (01_basic_design.md §3.3.1)
- orders.status·automated_at 삭제 — 발주는 쿠팡 담기를 마칠 때 담긴 품목으로만 저장한다
  (01_basic_design.md §3.7.4)

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
            item_id             VARCHAR(20)     NOT NULL COMMENT '쿠팡 itemId',
            product_id          VARCHAR(20)     NOT NULL COMMENT '쿠팡 productId. 상품 페이지 주소용',
            vendor_item_id      VARCHAR(20)     NOT NULL COMMENT '마지막으로 본 쿠팡 vendorItemId',
            product_name        VARCHAR(300)    NOT NULL COMMENT '상품명 원문의 첫 쉼표 앞. 쉼표가 없으면 전체',
            option_name         VARCHAR(200)    NULL COMMENT '상품명 원문의 첫 쉼표 뒤. 쉼표가 없으면 NULL',
            sale_price          INT             NULL COMMENT '판매가(원). 매장 가격 다수결. 매장 가격을 받은 적 없으면 NULL',
            rocket_fresh        TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '로켓프레시 상품 여부. 비로그인 담기 불가',
            content_quantity    DECIMAL(12,3)   NULL COMMENT '상품 1개 용량. 상품명·옵션 이름에서 계산. 계산하지 못하면 NULL',
            content_unit        VARCHAR(4)      NULL COMMENT '용량 단위 g·ml·개',
            unit_price          DECIMAL(12,4)   NULL COMMENT '공용 단가(용량 단위 1당 원). 판매가를 보낸 매장 가격 중 가장 최근 것의 단가',
            updated_at          DATETIME        NOT NULL COMMENT '마지막으로 값을 갱신한 시각',
            PRIMARY KEY (item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    op.execute(
        """
        CREATE TABLE coupang_store_prices (
            item_id             VARCHAR(20)     NOT NULL COMMENT '쿠팡 itemId',
            store_id            CHAR(36)        NOT NULL COMMENT '관측한 매장',
            sale_price          INT             NOT NULL COMMENT '그 관측의 판매가(원). 비회원 가격',
            unit_price          DECIMAL(12,4)   NULL COMMENT '그 관측의 단가(용량 단위 1당 원). 단위가격 대조를 통과하지 못했으면 NULL',
            received_at         DATETIME        NOT NULL COMMENT '마지막으로 관측한 시각. 같은 값이어도 갱신',
            PRIMARY KEY (item_id, store_id),
            CONSTRAINT fk_store_prices_product FOREIGN KEY (item_id)
                REFERENCES coupang_products (item_id) ON DELETE CASCADE,
            CONSTRAINT fk_store_prices_store FOREIGN KEY (store_id)
                REFERENCES stores (store_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    op.execute(
        """
        ALTER TABLE inventory_items
            ADD COLUMN coupang_item_id VARCHAR(20) NULL
                COMMENT '연결된 공용 쿠팡 상품 itemId (01_basic_design.md §3.3.1)' AFTER needs_check,
            ADD COLUMN coupang_linked_at DATETIME NULL
                COMMENT '검색으로 고른 상품을 연결한 시각. 자동 담기 검색 주기 기준 (01_basic_design.md §3.8.1)'
                AFTER coupang_item_id,
            ADD CONSTRAINT fk_inventory_items_coupang_product FOREIGN KEY (coupang_item_id)
                REFERENCES coupang_products (item_id)
        """
    )
    op.execute("DROP TABLE inventory_item_sites")
    op.execute("DROP TABLE sites")
    op.execute("ALTER TABLE order_recommendation_items DROP COLUMN last_price")
    op.execute("ALTER TABLE orders DROP COLUMN status, DROP COLUMN automated_at")


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE orders
            ADD COLUMN status ENUM('APPROVED','AUTOMATED','MANUAL_REQUIRED') NOT NULL
                DEFAULT 'APPROVED' AFTER recommendation_id,
            ADD COLUMN automated_at DATETIME NULL AFTER approved_at
        """
    )
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
            DROP COLUMN coupang_item_id,
            DROP COLUMN coupang_linked_at
        """
    )
    op.execute("DROP TABLE coupang_store_prices")
    op.execute("DROP TABLE coupang_products")
