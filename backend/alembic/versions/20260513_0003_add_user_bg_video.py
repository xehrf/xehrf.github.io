"""Add bg_video_url column to users.

Revision ID: 20260513_0003
Revises: 20260502_0002
Create Date: 2026-05-13 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260513_0003"
down_revision = "20260502_0002"
branch_labels = None
depends_on = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def _has_column(table_name: str, column_name: str) -> bool:
    return any(column["name"] == column_name for column in _inspector().get_columns(table_name))


def upgrade() -> None:
    if not _has_table("users"):
        return
    if not _has_column("users", "bg_video_url"):
        op.add_column("users", sa.Column("bg_video_url", sa.String(length=1024), nullable=True))


def downgrade() -> None:
    if _has_table("users") and _has_column("users", "bg_video_url"):
        op.drop_column("users", "bg_video_url")
