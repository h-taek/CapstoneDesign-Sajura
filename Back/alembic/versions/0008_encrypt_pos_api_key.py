"""pos_connections.api_key 평문 행을 AES-256-GCM으로 암호화 (12_security.md §4.1).

이 리비전 전까지 api_key는 평문으로 저장됐다. 행이 있는데 AES_GCM_KEY_BASE64가 없으면 중단한다.

Revision ID: 0008_encrypt_pos_api_key
Revises: 0007_drop_purchase_orders
Create Date: 2026-10-03
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op
from app.core import crypto

revision = "0008_encrypt_pos_api_key"
down_revision = "0007_drop_purchase_orders"
branch_labels = None
depends_on = None


def _rewrite(transform) -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT pos_id, store_id, api_key FROM pos_connections")).all()
    for pos_id, store_id, api_key in rows:
        conn.execute(
            sa.text("UPDATE pos_connections SET api_key = :k WHERE pos_id = :id"),
            {"k": transform(api_key, aad=store_id), "id": pos_id},
        )


def upgrade() -> None:
    _rewrite(crypto.encrypt)


def downgrade() -> None:
    _rewrite(crypto.decrypt)
