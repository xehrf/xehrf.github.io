"""Replace freelance tables with announcements tables.

Revision ID: 20260519_0005
Revises: 20260517_0004
Create Date: 2026-05-19 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260519_0005"
down_revision = "20260517_0004"
branch_labels = None
depends_on = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def _drop_enum(name: str) -> None:
    sa.Enum(name=name).drop(op.get_bind(), checkfirst=True)


def upgrade() -> None:
    # Drop old freelance tables (in FK-dependency order)
    for tbl in ("contract_events", "contract_messages", "reviews", "contracts", "proposals", "freelance_posts"):
        if _has_table(tbl):
            op.drop_table(tbl)
    for enum_name in (
        "contracteventtype",
        "contractstatus",
        "proposalstatus",
        "freelancepoststatus",
    ):
        _drop_enum(enum_name)

    # New enums + tables
    skill_enum = sa.Enum("junior", "middle", "senior", "lead", name="announcementskilllevel")
    category_enum = sa.Enum("work_search", "job_offer", name="announcementcategory")
    source_enum = sa.Enum("manual", "telegram", name="announcementsource")

    if not _has_table("announcements"):
        op.create_table(
            "announcements",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("category", category_enum, nullable=False, index=True),
            sa.Column("skill_level", skill_enum, nullable=True, index=True),
            sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("contact_handle", sa.String(length=255), nullable=True),
            sa.Column("contact_link", sa.String(length=500), nullable=True),
            sa.Column("contact_phone", sa.String(length=50), nullable=True),
            sa.Column("contact_email", sa.String(length=255), nullable=True),
            sa.Column(
                "tags",
                sa.ARRAY(sa.String(length=100)),
                nullable=False,
                server_default="{}",
            ),
            sa.Column("source_type", source_enum, nullable=False, server_default="manual", index=True),
            sa.Column("telegram_channel", sa.String(length=255), nullable=True),
            sa.Column("message_link", sa.String(length=500), nullable=True),
            sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("click_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("save_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False, index=True),
        )
        op.create_index("ix_announcements_author_id", "announcements", ["author_id"])
        op.create_index("ix_announcements_created_at", "announcements", ["created_at"])

    if not _has_table("announcement_ratings"):
        op.create_table(
            "announcement_ratings",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "announcement_id",
                sa.Integer(),
                sa.ForeignKey("announcements.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("rating", sa.Integer(), nullable=False),
            sa.Column("user_skill_level", skill_enum, nullable=True, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("announcement_id", "user_id", name="uq_announcement_rating_user"),
        )

    if not _has_table("announcement_saves"):
        op.create_table(
            "announcement_saves",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column(
                "announcement_id",
                sa.Integer(),
                sa.ForeignKey("announcements.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("announcement_id", "user_id", name="uq_announcement_save_user"),
        )


def downgrade() -> None:
    # Drop new tables
    for tbl in ("announcement_saves", "announcement_ratings", "announcements"):
        if _has_table(tbl):
            op.drop_table(tbl)
    for enum_name in ("announcementsource", "announcementcategory", "announcementskilllevel"):
        _drop_enum(enum_name)

    # Old freelance tables are not re-created (data is gone).
