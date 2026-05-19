"""Add friendships + direct_messages tables.

Revision ID: 20260517_0004
Revises: 20260513_0003
Create Date: 2026-05-17 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260517_0004"
down_revision = "20260513_0003"
branch_labels = None
depends_on = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return _inspector().has_table(table_name)


def upgrade() -> None:
    if not _has_table("friendships"):
        op.create_table(
            "friendships",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("requester_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("addressee_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "status",
                sa.Enum("pending", "accepted", "declined", "blocked", name="friendshipstatus"),
                nullable=False,
                server_default="pending",
            ),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
            sa.UniqueConstraint("requester_id", "addressee_id", name="uq_friendship_pair"),
        )
        op.create_index("ix_friendships_requester_id", "friendships", ["requester_id"])
        op.create_index("ix_friendships_addressee_id", "friendships", ["addressee_id"])
        op.create_index("ix_friendships_status", "friendships", ["status"])

    if not _has_table("direct_messages"):
        op.create_table(
            "direct_messages",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("sender_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("recipient_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("body", sa.Text(), nullable=False),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index("ix_direct_messages_sender_id", "direct_messages", ["sender_id"])
        op.create_index("ix_direct_messages_recipient_id", "direct_messages", ["recipient_id"])
        op.create_index("ix_direct_messages_created_at", "direct_messages", ["created_at"])


def downgrade() -> None:
    if _has_table("direct_messages"):
        op.drop_index("ix_direct_messages_created_at", table_name="direct_messages")
        op.drop_index("ix_direct_messages_recipient_id", table_name="direct_messages")
        op.drop_index("ix_direct_messages_sender_id", table_name="direct_messages")
        op.drop_table("direct_messages")
    if _has_table("friendships"):
        op.drop_index("ix_friendships_status", table_name="friendships")
        op.drop_index("ix_friendships_addressee_id", table_name="friendships")
        op.drop_index("ix_friendships_requester_id", table_name="friendships")
        op.drop_table("friendships")
        sa.Enum(name="friendshipstatus").drop(op.get_bind(), checkfirst=True)
