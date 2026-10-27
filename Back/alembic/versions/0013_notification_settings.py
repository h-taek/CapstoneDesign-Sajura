"""users: 알림 설정 묶음 4칸 (01_basic_design.md §3.12).

Revision ID: 0013_notification_settings
Revises: 0012_order_receipt
Create Date: 2026-10-28
"""

from __future__ import annotations

from alembic import op

revision = "0013_notification_settings"
down_revision = "0012_order_receipt"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
            ADD COLUMN notify_expiry TINYINT(1) NOT NULL DEFAULT 1
                COMMENT '알림 설정 — 소비기한 임박' AFTER withdrawn_at,
            ADD COLUMN notify_stock_low TINYINT(1) NOT NULL DEFAULT 1
                COMMENT '알림 설정 — 재고 부족' AFTER notify_expiry,
            ADD COLUMN notify_forecast_done TINYINT(1) NOT NULL DEFAULT 1
                COMMENT '알림 설정 — 예측 완료' AFTER notify_stock_low,
            ADD COLUMN notify_anomaly TINYINT(1) NOT NULL DEFAULT 1
                COMMENT '알림 설정 — 이상치 감지' AFTER notify_forecast_done
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
            DROP COLUMN notify_expiry,
            DROP COLUMN notify_stock_low,
            DROP COLUMN notify_forecast_done,
            DROP COLUMN notify_anomaly
        """
    )
