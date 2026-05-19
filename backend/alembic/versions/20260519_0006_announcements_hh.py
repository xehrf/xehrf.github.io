"""Extend announcements with HH source fields.

Revision ID: 20260519_0006
Revises: 20260519_0005
Create Date: 2026-05-19 12:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260519_0006"
down_revision = "20260519_0005"
branch_labels = None
depends_on = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def _has_column(table_name: str, column_name: str) -> bool:
    return any(c["name"] == column_name for c in _inspector().get_columns(table_name))


def upgrade() -> None:
    if not _has_table("announcements"):
        return

    bind = op.get_bind()
    dialect = bind.dialect.name

    # Make author_id nullable so external sources don't need a synthetic user.
    if dialect == "postgresql":
        op.alter_column("announcements", "author_id", nullable=True)
    # SQLite (used in tests) ignores constraint changes silently; the model
    # will still treat the column as nullable in Python.

    # Extend the announcementsource enum with 'hh'.
    if dialect == "postgresql":
        op.execute("ALTER TYPE announcementsource ADD VALUE IF NOT EXISTS 'hh'")

    new_cols = [
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("external_url", sa.String(length=500), nullable=True),
        sa.Column("salary_from", sa.Integer(), nullable=True),
        sa.Column("salary_to", sa.Integer(), nullable=True),
        sa.Column("salary_currency", sa.String(length=10), nullable=True),
        sa.Column("employer_name", sa.String(length=255), nullable=True),
        sa.Column("area_name", sa.String(length=255), nullable=True),
    ]
    for col in new_cols:
        if not _has_column("announcements", col.name):
            op.add_column("announcements", col)

    # Composite index used by the upsert path (find existing hh vacancy by id).
    existing = {idx["name"] for idx in _inspector().get_indexes("announcements")}
    if "ix_announcements_source_external" not in existing:
        op.create_index(
            "ix_announcements_source_external",
            "announcements",
            ["source_type", "external_id"],
            unique=False,
        )


def downgrade() -> None:
    if not _has_table("announcements"):
        return

    existing = {idx["name"] for idx in _inspector().get_indexes("announcements")}
    if "ix_announcements_source_external" in existing:
        op.drop_index("ix_announcements_source_external", table_name="announcements")

    for col in (
        "area_name",
        "employer_name",
        "salary_currency",
        "salary_to",
        "salary_from",
        "external_url",
        "external_id",
    ):
        if _has_column("announcements", col):
            op.drop_column("announcements", col)

    # author_id NOT NULL is intentionally not restored (existing rows may have NULL).
    # Enum 'hh' value cannot be dropped from a Postgres enum without a recreate;
    # leave it in place to avoid invalidating any historical rows.
