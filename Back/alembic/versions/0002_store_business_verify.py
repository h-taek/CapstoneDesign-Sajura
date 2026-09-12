"""stores: business_verified 추가 + 검증/온보딩 전 필드 nullable (M3.B8).

Spec: docs/spec/08_schema.md §3 stores.
사업자 검증을 온보딩 진입 전 독립 게이트로 분리 — 계정 생성 시 빈 매장 행이
생기고 store_name·business_no·business_type 등은 검증·온보딩에서 채운다.

Revision ID: 0002_store_business_verify
Revises: 0001_init
Create Date: 2026-05-29
"""
from __future__ import annotations

from alembic import op

revision = "0002_store_business_verify"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE stores
            MODIFY COLUMN store_name    VARCHAR(100)                   NULL COMMENT '온보딩 전 NULL',
            MODIFY COLUMN business_no   VARCHAR(20)                    NULL COMMENT '사업자 검증 전 NULL',
            ADD COLUMN    business_verified TINYINT(1)                 NOT NULL DEFAULT 0
                          COMMENT '국세청 검증 통과 여부 — 온보딩 진입 게이트' AFTER business_no,
            MODIFY COLUMN business_type VARCHAR(50)                    NULL,
            MODIFY COLUMN store_size    ENUM('SMALL','MEDIUM','LARGE') NULL,
            MODIFY COLUMN operation_type ENUM('HALL','DELIVERY','BOTH') NULL
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE stores
            DROP COLUMN business_verified,
            MODIFY COLUMN operation_type ENUM('HALL','DELIVERY','BOTH') NOT NULL,
            MODIFY COLUMN store_size    ENUM('SMALL','MEDIUM','LARGE') NOT NULL,
            MODIFY COLUMN business_type VARCHAR(50)                    NOT NULL,
            MODIFY COLUMN business_no   VARCHAR(20)                    NOT NULL,
            MODIFY COLUMN store_name    VARCHAR(100)                   NOT NULL
        """
    )
