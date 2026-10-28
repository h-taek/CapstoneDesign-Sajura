"""weather_observations: 기상청 ASOS 관측 날씨 — 관측소·날짜 단위 (02_implementation_design.md §4.3.25).

n8n 예측 배치만 쓰고 읽는다. BE ORM 모델은 두지 않는다.

Revision ID: 0016_weather_observations
Revises: 0015_store_location
Create Date: 2026-10-28
"""

from __future__ import annotations

from alembic import op

revision = "0016_weather_observations"
down_revision = "0015_store_location"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE weather_observations (
            asos_stn_id     SMALLINT        NOT NULL COMMENT '기상청 ASOS 관측소 번호 (stores.asos_stn_id)',
            obs_date        DATE            NOT NULL,
            temp_min        DECIMAL(4,1)    NULL COMMENT '일 최저기온(℃) — 기상청 값 없음이면 NULL',
            temp_max        DECIMAL(4,1)    NULL COMMENT '일 최고기온(℃)',
            rainfall_mm     DECIMAL(5,1)    NULL COMMENT '일 강수량(mm) — 비 없는 날 0',
            fetched_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (asos_stn_id, obs_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE weather_observations")
