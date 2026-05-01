"""Bootstrap schema and move runtime drift fixes into Alembic.

Revision ID: 20260427_0001
Revises:
Create Date: 2026-04-27 00:00:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.db import models  # noqa: F401
from app.db.base import Base
from app.db.models import TeamMemberRole, UserLevel

# revision identifiers, used by Alembic.
revision = "20260427_0001"
down_revision = None
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


def _has_foreign_key(table_name: str, constrained_columns: list[str]) -> bool:
    return any(
        fk.get("constrained_columns") == constrained_columns
        for fk in _inspector().get_foreign_keys(table_name)
    )


def _technologies_column_type() -> sa.TypeEngine:
    if op.get_bind().dialect.name == "postgresql":
        return postgresql.ARRAY(sa.String(length=100))
    return sa.JSON()


def _ensure_postgres_enum_types() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    sa.Enum(UserLevel, name="userlevel").create(bind, checkfirst=True)
    sa.Enum(TeamMemberRole, name="teammemberrole").create(bind, checkfirst=True)


def upgrade() -> None:
    bind = op.get_bind()

    # Bootstrap a fresh database from the current metadata.
    Base.metadata.create_all(bind=bind)
    _ensure_postgres_enum_types()

    if _has_table("users"):
        if not _has_column("users", "google_sub"):
            op.add_column("users", sa.Column("google_sub", sa.String(length=255), nullable=True))
        if not _has_column("users", "github_user_id"):
            op.add_column("users", sa.Column("github_user_id", sa.String(length=255), nullable=True))
        if not _has_column("users", "github_login"):
            op.add_column("users", sa.Column("github_login", sa.String(length=255), nullable=True))
        if not _has_column("users", "display_name"):
            op.add_column("users", sa.Column("display_name", sa.String(length=100), nullable=True))
        if not _has_column("users", "nickname"):
            op.add_column(
                "users",
                sa.Column("nickname", sa.String(length=100), nullable=False, server_default=""),
            )
        if not _has_column("users", "avatar_url"):
            op.add_column("users", sa.Column("avatar_url", sa.String(length=1024), nullable=True))
        if not _has_column("users", "banner_url"):
            op.add_column("users", sa.Column("banner_url", sa.String(length=1024), nullable=True))
        if not _has_column("users", "bio"):
            op.add_column("users", sa.Column("bio", sa.Text(), nullable=True))
        if not _has_column("users", "pts"):
            op.add_column("users", sa.Column("pts", sa.Integer(), nullable=False, server_default="0"))
        if not _has_column("users", "level"):
            op.add_column(
                "users",
                sa.Column(
                    "level",
                    sa.Enum(UserLevel, name="userlevel"),
                    nullable=False,
                    server_default=UserLevel.beginner.value,
                ),
            )
        if not _has_column("users", "role"):
            op.add_column("users", sa.Column("role", sa.String(length=100), nullable=True))
        if not _has_column("users", "technologies"):
            op.add_column(
                "users",
                sa.Column(
                    "technologies",
                    _technologies_column_type(),
                    nullable=False,
                    server_default=sa.text("'{}'") if bind.dialect.name == "postgresql" else sa.text("'[]'"),
                ),
            )
        if not _has_column("users", "onboarding_completed"):
            op.add_column(
                "users",
                sa.Column("onboarding_completed", sa.Boolean(), nullable=False, server_default=sa.false()),
            )
        if not _has_column("users", "pvp_win_streak"):
            op.add_column(
                "users",
                sa.Column("pvp_win_streak", sa.Integer(), nullable=False, server_default="0"),
            )
        if not _has_column("users", "pvp_best_win_streak"):
            op.add_column(
                "users",
                sa.Column("pvp_best_win_streak", sa.Integer(), nullable=False, server_default="0"),
            )
        if _has_column("users", "google_sub") and not _has_index("users", "ix_users_google_sub"):
            op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)
        if _has_column("users", "github_user_id") and not _has_index("users", "ix_users_github_user_id"):
            op.create_index("ix_users_github_user_id", "users", ["github_user_id"], unique=True)

        op.execute(
            sa.text(
                """
                UPDATE users
                SET nickname = COALESCE(NULLIF(display_name, ''), nickname, '')
                WHERE nickname IS NULL OR nickname = ''
                """
            )
        )
        op.execute(
            sa.text(
                """
                UPDATE users
                SET onboarding_completed = FALSE
                WHERE onboarding_completed IS NULL OR role IS NULL
                """
            )
        )

    if _has_table("rating_history"):
        if not _has_column("rating_history", "season_code"):
            op.add_column("rating_history", sa.Column("season_code", sa.String(length=16), nullable=True))
        if not _has_column("rating_history", "language_key"):
            op.add_column("rating_history", sa.Column("language_key", sa.String(length=64), nullable=True))
        if not _has_column("rating_history", "topic_key"):
            op.add_column("rating_history", sa.Column("topic_key", sa.String(length=64), nullable=True))

        if not _has_index("rating_history", "ix_rating_history_season_code"):
            op.create_index("ix_rating_history_season_code", "rating_history", ["season_code"], unique=False)
        if not _has_index("rating_history", "ix_rating_history_language_key"):
            op.create_index("ix_rating_history_language_key", "rating_history", ["language_key"], unique=False)
        if not _has_index("rating_history", "ix_rating_history_topic_key"):
            op.create_index("ix_rating_history_topic_key", "rating_history", ["topic_key"], unique=False)

    if _has_table("teams"):
        if not _has_column("teams", "avatar_url"):
            op.add_column("teams", sa.Column("avatar_url", sa.String(length=1024), nullable=True))
        if not _has_column("teams", "banner_url"):
            op.add_column("teams", sa.Column("banner_url", sa.String(length=1024), nullable=True))
        if not _has_column("teams", "description"):
            op.add_column("teams", sa.Column("description", sa.String(length=256), nullable=False, server_default=""))
        if not _has_column("teams", "owner_id"):
            op.add_column("teams", sa.Column("owner_id", sa.Integer(), nullable=True))
        if not _has_column("teams", "rating"):
            op.add_column("teams", sa.Column("rating", sa.Integer(), nullable=False, server_default="0"))

        if _has_column("teams", "owner_id") and not _has_foreign_key("teams", ["owner_id"]):
            op.create_foreign_key("fk_teams_owner_id_users", "teams", "users", ["owner_id"], ["id"], ondelete="SET NULL")
        if _has_column("teams", "owner_id") and not _has_index("teams", "ix_teams_owner_id"):
            op.create_index("ix_teams_owner_id", "teams", ["owner_id"], unique=False)

    if _has_table("team_members"):
        if not _has_column("team_members", "role"):
            op.add_column(
                "team_members",
                sa.Column(
                    "role",
                    sa.Enum(TeamMemberRole, name="teammemberrole"),
                    nullable=False,
                    server_default=TeamMemberRole.member.value,
                ),
            )
        if _has_column("team_members", "role") and not _has_index("team_members", "ix_team_members_role"):
            op.create_index("ix_team_members_role", "team_members", ["role"], unique=False)

    if _has_table("team_match_history") and not _has_column("team_match_history", "ptc_earned"):
        op.add_column(
            "team_match_history",
            sa.Column("ptc_earned", sa.Integer(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    raise NotImplementedError("Downgrade is not supported for the baseline schema migration.")
