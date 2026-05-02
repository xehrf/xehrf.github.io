"""Add OAuth-related user columns for existing databases.

Revision ID: 20260502_0002
Revises: 20260427_0001
Create Date: 2026-05-02 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260502_0002"
down_revision = "20260427_0001"
branch_labels = None
depends_on = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def _has_column(table_name: str, column_name: str) -> bool:
    return any(column["name"] == column_name for column in _inspector().get_columns(table_name))


def _has_index(table_name: str, index_name: str) -> bool:
    return any(index["name"] == index_name for index in _inspector().get_indexes(table_name))


def upgrade() -> None:
    if not _has_table("users"):
        return

    if not _has_column("users", "google_sub"):
        op.add_column("users", sa.Column("google_sub", sa.String(length=255), nullable=True))
    if not _has_column("users", "github_user_id"):
        op.add_column("users", sa.Column("github_user_id", sa.String(length=255), nullable=True))
    if not _has_column("users", "github_login"):
        op.add_column("users", sa.Column("github_login", sa.String(length=255), nullable=True))

    if _has_column("users", "google_sub") and not _has_index("users", "ix_users_google_sub"):
        op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)
    if _has_column("users", "github_user_id") and not _has_index("users", "ix_users_github_user_id"):
        op.create_index("ix_users_github_user_id", "users", ["github_user_id"], unique=True)


def downgrade() -> None:
    raise NotImplementedError("Downgrade is not supported for the OAuth user columns migration.")
