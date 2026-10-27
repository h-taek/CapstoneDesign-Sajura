"""예측 결과 v2 + 추천 수정안 칸 삭제.

02_implementation_design.md §4.3.14·§4.3.15·§4.3.17·§4.3.20.

- forecast_results — 메뉴별 수량(구 정의) → 매장 일 매출·예측 구간·근거.
  예측 행은 dev·prod 모두 없다
- forecast_menu_items — 대상일 메뉴별 예상 수량
- order_recommendation_items·order_approval_logs.adjusted_quantity 삭제
  — 확정 전 수정값은 저장하지 않는다

Revision ID: 0014_forecast_v2
Revises: 0013_notification_settings
Create Date: 2026-10-28
"""

from __future__ import annotations

from alembic import op

revision = "0014_forecast_v2"
down_revision = "0013_notification_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP TABLE forecast_results")
    op.execute(
        """
        CREATE TABLE forecast_results (
            forecast_id             CHAR(36)        NOT NULL,
            store_id                CHAR(36)        NOT NULL,
            target_date             DATE            NOT NULL,
            horizon_days            TINYINT         NOT NULL COMMENT '선행일 1~3',
            predicted_sales         INT             NOT NULL COMMENT '예측 일 매출(원)',
            interval_p10            INT             NOT NULL COMMENT '80% 예측 구간 하한',
            interval_p90            INT             NOT NULL COMMENT '80% 예측 구간 상한',
            is_low_confidence       TINYINT(1)      NOT NULL DEFAULT 0,
            low_confidence_reason   VARCHAR(32)     NULL,
            explanation             JSON            NULL COMMENT '예측 근거',
            generated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (forecast_id),
            UNIQUE KEY uq_forecast_store_date (store_id, target_date),
            CONSTRAINT fk_forecast_results_store FOREIGN KEY (store_id) REFERENCES stores (store_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    op.execute(
        """
        CREATE TABLE forecast_menu_items (
            id                  CHAR(36)        NOT NULL,
            forecast_id         CHAR(36)        NOT NULL,
            menu_id             CHAR(36)        NOT NULL,
            expected_quantity   DECIMAL(10,3)   NOT NULL COMMENT '대상일 예상 판매 수량(참고치)',
            PRIMARY KEY (id),
            UNIQUE KEY uq_forecast_menu (forecast_id, menu_id),
            CONSTRAINT fk_forecast_menu_items_forecast FOREIGN KEY (forecast_id)
                REFERENCES forecast_results (forecast_id) ON DELETE CASCADE,
            CONSTRAINT fk_forecast_menu_items_menu FOREIGN KEY (menu_id) REFERENCES menus (menu_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
    op.execute("ALTER TABLE order_recommendation_items DROP COLUMN adjusted_quantity")
    op.execute("ALTER TABLE order_approval_logs DROP COLUMN adjusted_quantity")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE order_approval_logs ADD COLUMN adjusted_quantity DECIMAL(10,3) NOT NULL"
        " DEFAULT 0 AFTER recommended_quantity"
    )
    op.execute("UPDATE order_approval_logs SET adjusted_quantity = recommended_quantity")
    op.execute(
        "ALTER TABLE order_recommendation_items ADD COLUMN adjusted_quantity DECIMAL(10,3)"
        " NOT NULL DEFAULT 0 AFTER recommended_quantity"
    )
    op.execute("UPDATE order_recommendation_items SET adjusted_quantity = recommended_quantity")
    op.execute("DROP TABLE forecast_menu_items")
    op.execute("DROP TABLE forecast_results")
    op.execute(
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
            CONSTRAINT fk_forecast_results_store FOREIGN KEY (store_id)
                REFERENCES stores (store_id),
            CONSTRAINT fk_forecast_results_menu FOREIGN KEY (menu_id) REFERENCES menus (menu_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )
