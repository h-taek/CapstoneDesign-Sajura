"""init — 08_schema.md 전체 테이블 (M2.B3).

Spec: docs/spec/08_schema.md §3 (23 tables).
FK 순서대로 CREATE, 역순으로 DROP.

Revision ID: 0001_init
Revises:
Create Date: 2026-05-24
"""
from __future__ import annotations

from alembic import op

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


# 테이블 생성 순서 — FK 의존성 위반 없는 위상 정렬.
CREATE_STATEMENTS: list[tuple[str, str]] = [
    (
        "users",
        """
        CREATE TABLE users (
            user_id       CHAR(36)                            NOT NULL,
            email         VARCHAR(255)                        NOT NULL,
            password_hash VARCHAR(255)                        NULL COMMENT '소셜 로그인 계정은 NULL',
            name          VARCHAR(50)                         NOT NULL,
            auth_provider ENUM('LOCAL','KAKAO','GOOGLE')      NOT NULL DEFAULT 'LOCAL',
            social_id     VARCHAR(100)                        NULL COMMENT '소셜 서비스의 사용자 고유 ID',
            created_at    DATETIME                            NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at    DATETIME                            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id),
            UNIQUE KEY uq_users_email (email),
            UNIQUE KEY uq_users_social (auth_provider, social_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "refresh_tokens",
        """
        CREATE TABLE refresh_tokens (
            token_id    CHAR(36)        NOT NULL,
            user_id     CHAR(36)        NOT NULL,
            token_hash  VARCHAR(255)    NOT NULL,
            expires_at  DATETIME        NOT NULL,
            is_revoked  TINYINT(1)      NOT NULL DEFAULT 0,
            created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (token_id),
            UNIQUE KEY uq_refresh_tokens_hash (token_hash),
            KEY idx_refresh_tokens_user_id (user_id),
            CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "stores",
        """
        CREATE TABLE stores (
            store_id              CHAR(36)                                    NOT NULL,
            user_id               CHAR(36)                                    NOT NULL,
            store_name            VARCHAR(100)                                NOT NULL,
            business_no           VARCHAR(20)                                 NOT NULL,
            business_type         VARCHAR(50)                                 NOT NULL COMMENT '업종 (AI 예측 지역 변수)',
            store_size            ENUM('SMALL','MEDIUM','LARGE')              NOT NULL COMMENT '소형~10석 / 중형11~30석 / 대형31석~',
            operation_type        ENUM('HALL','DELIVERY','BOTH')              NOT NULL COMMENT '홀 운영 / 배달 전용 / 홀+배달',
            address               VARCHAR(255)                                NULL,
            phone                 VARCHAR(20)                                 NULL COMMENT 'NATIONAL 형식 010-1234-5678 — BE가 phonenumbers로 정규화 후 저장',
            onboarding_completed  TINYINT(1)                                  NOT NULL DEFAULT 0,
            created_at            DATETIME                                    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at            DATETIME                                    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (store_id),
            UNIQUE KEY uq_stores_user_id (user_id),
            UNIQUE KEY uq_stores_business_no (business_no),
            CONSTRAINT fk_stores_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "pos_connections",
        """
        CREATE TABLE pos_connections (
            pos_id          CHAR(36)        NOT NULL,
            store_id        CHAR(36)        NOT NULL,
            pos_type        VARCHAR(50)     NOT NULL,
            api_key         VARCHAR(255)    NOT NULL COMMENT '암호화 저장',
            store_code      VARCHAR(50)     NOT NULL,
            status          ENUM('CONNECTED','ERROR','CSV_MODE','DISCONNECTED') NOT NULL DEFAULT 'DISCONNECTED',
            last_synced_at  DATETIME        NULL,
            error_message   VARCHAR(500)    NULL,
            connected_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (pos_id),
            UNIQUE KEY uq_pos_connections_store_id (store_id),
            CONSTRAINT fk_pos_connections_store FOREIGN KEY (store_id) REFERENCES stores (store_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "menus",
        """
        CREATE TABLE menus (
            menu_id                  CHAR(36)      NOT NULL,
            store_id                 CHAR(36)      NOT NULL,
            name                     VARCHAR(100)  NOT NULL,
            category                 VARCHAR(50)   NULL,
            price                    INT           NOT NULL,
            is_active                TINYINT(1)    NOT NULL DEFAULT 1,
            use_inventory_deduction  TINYINT(1)    NOT NULL DEFAULT 1 COMMENT '재고 차감 사용 여부',
            is_deleted               TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '점주 삭제 표시 여부',
            deleted_at               DATETIME      NULL COMMENT '소프트 삭제 시각',
            created_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (menu_id),
            KEY idx_menus_store_id (store_id),
            KEY idx_menus_store_deleted (store_id, is_deleted),
            CONSTRAINT fk_menus_store FOREIGN KEY (store_id) REFERENCES stores (store_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "inventory_items",
        """
        CREATE TABLE inventory_items (
            item_id             CHAR(36)        NOT NULL,
            store_id            CHAR(36)        NOT NULL,
            name                VARCHAR(100)    NOT NULL,
            unit                VARCHAR(20)     NOT NULL,
            low_stock_threshold DECIMAL(10,3)   NOT NULL DEFAULT 0,
            lead_time_days      INT             NULL COMMENT '추천발주 리드타임(일). NULL이면 기본값 1일 사용',
            safety_stock        DECIMAL(10,3)   NULL COMMENT '추천발주 안전재고 수량. NULL이면 기본값 0 사용',
            created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (item_id),
            KEY idx_inventory_items_store_id (store_id),
            CONSTRAINT fk_inventory_items_store FOREIGN KEY (store_id) REFERENCES stores (store_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "recipes",
        """
        CREATE TABLE recipes (
            recipe_id   CHAR(36)        NOT NULL,
            menu_id     CHAR(36)        NOT NULL,
            updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (recipe_id),
            UNIQUE KEY uq_recipes_menu_id (menu_id),
            CONSTRAINT fk_recipes_menu FOREIGN KEY (menu_id) REFERENCES menus (menu_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "recipe_ingredients",
        """
        CREATE TABLE recipe_ingredients (
            id          CHAR(36)        NOT NULL,
            recipe_id   CHAR(36)        NOT NULL,
            item_id     CHAR(36)        NOT NULL,
            quantity    DECIMAL(10,3)   NOT NULL,
            unit        VARCHAR(20)     NOT NULL,
            PRIMARY KEY (id),
            KEY idx_recipe_ingredients_recipe_id (recipe_id),
            KEY idx_recipe_ingredients_item_id (item_id),
            CONSTRAINT fk_recipe_ingredients_recipe FOREIGN KEY (recipe_id) REFERENCES recipes (recipe_id) ON DELETE CASCADE,
            CONSTRAINT fk_recipe_ingredients_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "inventory_lots",
        """
        CREATE TABLE inventory_lots (
            lot_id              CHAR(36)        NOT NULL,
            item_id             CHAR(36)        NOT NULL,
            quantity            DECIMAL(10,3)   NOT NULL,
            remaining_quantity  DECIMAL(10,3)   NOT NULL,
            unit_price          INT             NOT NULL,
            received_at         DATE            NOT NULL,
            expiry_date         DATE            NULL,
            created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (lot_id),
            KEY idx_inventory_lots_item_id (item_id),
            KEY idx_inventory_lots_expiry_date (expiry_date),
            CONSTRAINT fk_inventory_lots_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "inventory_adjustment_logs",
        """
        CREATE TABLE inventory_adjustment_logs (
            adjustment_id       CHAR(36)        NOT NULL,
            lot_id              CHAR(36)        NOT NULL,
            item_id             CHAR(36)        NOT NULL COMMENT '조회 편의용 비정규화',
            store_id            CHAR(36)        NOT NULL COMMENT '조회 편의용 비정규화',
            user_id             CHAR(36)        NOT NULL,
            before_quantity     DECIMAL(10,3)   NOT NULL,
            after_quantity      DECIMAL(10,3)   NOT NULL,
            delta_quantity      DECIMAL(10,3)   NOT NULL,
            before_expiry_date  DATE            NULL,
            after_expiry_date   DATE            NULL,
            reason              ENUM('STOCKTAKE','EXPIRY_CORRECTION','OTHER') NOT NULL,
            memo                VARCHAR(255)    NULL,
            adjusted_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (adjustment_id),
            KEY idx_inventory_adjustment_logs_store_id (store_id),
            KEY idx_inventory_adjustment_logs_item_id (item_id),
            KEY idx_inventory_adjustment_logs_lot_id (lot_id),
            CONSTRAINT fk_inventory_adjustment_logs_lot FOREIGN KEY (lot_id) REFERENCES inventory_lots (lot_id),
            CONSTRAINT fk_inventory_adjustment_logs_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id),
            CONSTRAINT fk_inventory_adjustment_logs_store FOREIGN KEY (store_id) REFERENCES stores (store_id),
            CONSTRAINT fk_inventory_adjustment_logs_user FOREIGN KEY (user_id) REFERENCES users (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "disposal_logs",
        """
        CREATE TABLE disposal_logs (
            disposal_id CHAR(36)        NOT NULL,
            lot_id      CHAR(36)        NOT NULL,
            item_id     CHAR(36)        NOT NULL COMMENT '조회 편의용 비정규화',
            store_id    CHAR(36)        NOT NULL COMMENT '조회 편의용 비정규화',
            user_id     CHAR(36)        NOT NULL COMMENT '폐기 처리 사용자 (감사 로그용)',
            quantity    DECIMAL(10,3)   NOT NULL,
            reason      VARCHAR(255)    NULL,
            disposed_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (disposal_id),
            KEY idx_disposal_logs_store_id (store_id),
            KEY idx_disposal_logs_item_id (item_id),
            CONSTRAINT fk_disposal_logs_lot FOREIGN KEY (lot_id) REFERENCES inventory_lots (lot_id),
            CONSTRAINT fk_disposal_logs_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id),
            CONSTRAINT fk_disposal_logs_store FOREIGN KEY (store_id) REFERENCES stores (store_id),
            CONSTRAINT fk_disposal_logs_user FOREIGN KEY (user_id) REFERENCES users (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "sites",
        """
        CREATE TABLE sites (
            site_id     CHAR(36)        NOT NULL,
            name        VARCHAR(50)     NOT NULL,
            base_url    VARCHAR(255)    NOT NULL,
            is_active   TINYINT(1)      NOT NULL DEFAULT 1,
            PRIMARY KEY (site_id),
            UNIQUE KEY uq_sites_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "inventory_item_sites",
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
        """,
    ),
    (
        "sale_records",
        """
        CREATE TABLE sale_records (
            sale_id          CHAR(36)        NOT NULL,
            store_id         CHAR(36)        NOT NULL,
            menu_id          CHAR(36)        NOT NULL,
            external_sale_id VARCHAR(100)    NULL COMMENT 'POS/CSV 원본 판매 식별자',
            quantity         INT             NOT NULL,
            unit_price       INT             NOT NULL,
            total_price      INT             NOT NULL,
            sold_at          DATETIME        NOT NULL,
            source           ENUM('POS','CSV') NOT NULL DEFAULT 'POS',
            created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (sale_id),
            UNIQUE KEY uq_sale_records_source_external (store_id, source, external_sale_id),
            KEY idx_sale_records_store_sold_at (store_id, sold_at),
            KEY idx_sale_records_menu_id (menu_id),
            CONSTRAINT fk_sale_records_store FOREIGN KEY (store_id) REFERENCES stores (store_id),
            CONSTRAINT fk_sale_records_menu FOREIGN KEY (menu_id) REFERENCES menus (menu_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "forecast_results",
        """
        CREATE TABLE forecast_results (
            forecast_id             CHAR(36)        NOT NULL,
            store_id                CHAR(36)        NOT NULL,
            menu_id                 CHAR(36)        NOT NULL,
            target_date             DATE            NOT NULL,
            predicted_quantity      INT             NOT NULL,
            confidence_score        DECIMAL(4,3)    NOT NULL,
            is_low_confidence       TINYINT(1)      NOT NULL DEFAULT 0,
            low_confidence_reason   VARCHAR(255)    NULL,
            generated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (forecast_id),
            UNIQUE KEY uq_forecast_store_menu_date (store_id, menu_id, target_date),
            CONSTRAINT fk_forecast_results_store FOREIGN KEY (store_id) REFERENCES stores (store_id),
            CONSTRAINT fk_forecast_results_menu FOREIGN KEY (menu_id) REFERENCES menus (menu_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "order_recommendations",
        """
        CREATE TABLE order_recommendations (
            recommendation_id   CHAR(36)    NOT NULL,
            store_id            CHAR(36)    NOT NULL,
            target_date         DATE        NOT NULL COMMENT '추천발주 대상 발주일 (n8n 배치 기준일)',
            generated_at        DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (recommendation_id),
            KEY idx_order_recommendations_store_id (store_id),
            CONSTRAINT fk_order_recommendations_store FOREIGN KEY (store_id) REFERENCES stores (store_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "order_recommendation_items",
        """
        CREATE TABLE order_recommendation_items (
            id                      CHAR(36)        NOT NULL,
            recommendation_id       CHAR(36)        NOT NULL,
            item_id                 CHAR(36)        NOT NULL,
            recommended_quantity    DECIMAL(10,3)   NOT NULL,
            adjusted_quantity       DECIMAL(10,3)   NOT NULL,
            lead_time_days          INT             NOT NULL COMMENT '추천 계산 시 사용한 리드타임 스냅샷',
            safety_stock            DECIMAL(10,3)   NOT NULL COMMENT '추천 계산 시 사용한 안전재고 스냅샷',
            config_status           ENUM('USER_CONFIGURED','DEFAULT_USED') NOT NULL COMMENT '추천 계산 시 설정값 사용 상태',
            last_price              INT             NULL,
            PRIMARY KEY (id),
            KEY idx_order_rec_items_recommendation_id (recommendation_id),
            CONSTRAINT fk_order_rec_items_recommendation FOREIGN KEY (recommendation_id) REFERENCES order_recommendations (recommendation_id) ON DELETE CASCADE,
            CONSTRAINT fk_order_rec_items_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "orders",
        """
        CREATE TABLE orders (
            order_id                CHAR(36)        NOT NULL,
            store_id                CHAR(36)        NOT NULL,
            recommendation_id       CHAR(36)        NULL COMMENT '수동 발주 시 NULL 허용',
            status                  ENUM('APPROVED','AUTOMATED','MANUAL_REQUIRED') NOT NULL DEFAULT 'APPROVED',
            total_estimated_cost    INT             NOT NULL,
            note                    VARCHAR(500)    NULL,
            approved_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            automated_at            DATETIME        NULL,
            PRIMARY KEY (order_id),
            KEY idx_orders_store_approved_at (store_id, approved_at),
            CONSTRAINT fk_orders_store FOREIGN KEY (store_id) REFERENCES stores (store_id),
            CONSTRAINT fk_orders_recommendation FOREIGN KEY (recommendation_id) REFERENCES order_recommendations (recommendation_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "order_items",
        """
        CREATE TABLE order_items (
            id              CHAR(36)        NOT NULL,
            order_id        CHAR(36)        NOT NULL,
            item_id         CHAR(36)        NOT NULL,
            final_quantity  DECIMAL(10,3)   NOT NULL,
            unit_price      INT             NOT NULL,
            subtotal        INT             NOT NULL,
            PRIMARY KEY (id),
            KEY idx_order_items_order_id (order_id),
            CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (order_id) ON DELETE CASCADE,
            CONSTRAINT fk_order_items_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "order_approval_logs",
        """
        CREATE TABLE order_approval_logs (
            id                      CHAR(36)        NOT NULL,
            order_id                CHAR(36)        NOT NULL,
            item_id                 CHAR(36)        NOT NULL,
            recommended_quantity    DECIMAL(10,3)   NOT NULL,
            adjusted_quantity       DECIMAL(10,3)   NOT NULL,
            final_quantity          DECIMAL(10,3)   NOT NULL,
            was_modified            TINYINT(1)      NOT NULL DEFAULT 0,
            PRIMARY KEY (id),
            KEY idx_order_approval_logs_order_id (order_id),
            CONSTRAINT fk_order_approval_logs_order FOREIGN KEY (order_id) REFERENCES orders (order_id) ON DELETE CASCADE,
            CONSTRAINT fk_order_approval_logs_item FOREIGN KEY (item_id) REFERENCES inventory_items (item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "pipeline_jobs",
        """
        CREATE TABLE pipeline_jobs (
            job_id          CHAR(36)        NOT NULL,
            store_id        CHAR(36)        NOT NULL,
            type            ENUM('FORECAST','TRAIN') NOT NULL,
            status          ENUM('QUEUED','RUNNING','DONE','FAILED') NOT NULL DEFAULT 'QUEUED',
            triggered_by    ENUM('USER','N8N') NOT NULL DEFAULT 'USER',
            started_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            finished_at     DATETIME        NULL,
            error_message   VARCHAR(500)    NULL,
            PRIMARY KEY (job_id),
            KEY idx_pipeline_jobs_store_id (store_id),
            KEY idx_pipeline_jobs_status (status),
            CONSTRAINT fk_pipeline_jobs_store FOREIGN KEY (store_id) REFERENCES stores (store_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "notifications",
        """
        CREATE TABLE notifications (
            notification_id        CHAR(36)        NOT NULL,
            user_id                CHAR(36)        NOT NULL,
            store_id               CHAR(36)        NOT NULL,
            type                   ENUM('STOCK_LOW','EXPIRY_D3','EXPIRY_D1','EXPIRY_OVER','FORECAST_DONE','ANOMALY_HIGH') NOT NULL,
            priority               ENUM('INFO','WARNING','URGENT') NOT NULL DEFAULT 'INFO',
            title                  VARCHAR(200)    NOT NULL,
            body                   TEXT            NULL,
            related_resource_type  VARCHAR(50)     NULL COMMENT 'inventory_item / forecast / order 등',
            related_resource_id    CHAR(36)        NULL,
            is_read                TINYINT(1)      NOT NULL DEFAULT 0,
            created_at             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (notification_id),
            KEY idx_notifications_user_unread (user_id, is_read, created_at),
            KEY idx_notifications_store (store_id),
            CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
            CONSTRAINT fk_notifications_store FOREIGN KEY (store_id) REFERENCES stores (store_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
    (
        "push_subscriptions",
        """
        CREATE TABLE push_subscriptions (
            subscription_id  CHAR(36)        NOT NULL,
            user_id          CHAR(36)        NOT NULL,
            endpoint         VARCHAR(500)    NOT NULL COMMENT '브라우저별 Push Service endpoint URL',
            p256dh           VARCHAR(255)    NOT NULL COMMENT 'VAPID 공개 키 (브라우저 발급)',
            auth             VARCHAR(255)    NOT NULL COMMENT 'VAPID 인증 시크릿',
            user_agent       VARCHAR(255)    NULL,
            created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (subscription_id),
            UNIQUE KEY uq_push_subscriptions_endpoint (endpoint),
            KEY idx_push_subscriptions_user (user_id),
            CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """,
    ),
]


def upgrade() -> None:
    for _, ddl in CREATE_STATEMENTS:
        op.execute(ddl)


def downgrade() -> None:
    for name, _ in reversed(CREATE_STATEMENTS):
        op.execute(f"DROP TABLE IF EXISTS {name}")
