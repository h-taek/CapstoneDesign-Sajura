"""stores: 매장 위치 5칸 — 좌표·예보 격자·최근접 ASOS 관측소 (02_implementation_design.md §4.3.3).

Revision ID: 0015_store_location
Revises: 0014_forecast_v2
Create Date: 2026-10-28
"""

from __future__ import annotations

from alembic import op

revision = "0015_store_location"
down_revision = "0014_forecast_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stores
            ADD COLUMN latitude DECIMAL(9,6) NULL
                COMMENT '주소에서 변환한 위도 — 변환 실패·주소 없음이면 NULL' AFTER address,
            ADD COLUMN longitude DECIMAL(9,6) NULL
                COMMENT '주소에서 변환한 경도' AFTER latitude,
            ADD COLUMN kma_nx SMALLINT NULL
                COMMENT '기상청 단기예보 격자 X' AFTER longitude,
            ADD COLUMN kma_ny SMALLINT NULL
                COMMENT '기상청 단기예보 격자 Y' AFTER kma_nx,
            ADD COLUMN asos_stn_id SMALLINT NULL
                COMMENT '가장 가까운 기상청 ASOS 관측소 번호' AFTER kma_ny
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE stores
            DROP COLUMN latitude,
            DROP COLUMN longitude,
            DROP COLUMN kma_nx,
            DROP COLUMN kma_ny,
            DROP COLUMN asos_stn_id
        """
    )
