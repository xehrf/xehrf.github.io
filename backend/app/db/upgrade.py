from sqlalchemy import inspect, text

from app.db.models import Team, User
from app.db.session import engine


def has_column(table_name: str, column_name: str) -> bool:
    inspector = inspect(engine)
    return inspector.has_column(table_name, column_name)


def upgrade_user_profile_fields() -> None:
    with engine.begin() as connection:
        if not has_column(User.__tablename__, "avatar_url"):
            connection.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(1024) NULL"))
        if not has_column(User.__tablename__, "banner_url"):
            connection.execute(text("ALTER TABLE users ADD COLUMN banner_url VARCHAR(1024) NULL"))
        if not has_column(User.__tablename__, "bio"):
            connection.execute(text("ALTER TABLE users ADD COLUMN bio TEXT NULL"))
        if not has_column(User.__tablename__, "nickname"):
            connection.execute(
                text(
                    "ALTER TABLE users ADD COLUMN nickname VARCHAR(100) NOT NULL DEFAULT ''"
                )
            )
        if has_column(User.__tablename__, "nickname"):
            connection.execute(
                text(
                    "UPDATE users SET nickname = display_name WHERE nickname = '' OR nickname IS NULL"
                )
            )


def upgrade_team_profile_fields() -> None:
    with engine.begin() as connection:
        if not has_column(Team.__tablename__, "avatar_url"):
            connection.execute(text("ALTER TABLE teams ADD COLUMN avatar_url VARCHAR(1024) NULL"))
        if not has_column(Team.__tablename__, "banner_url"):
            connection.execute(text("ALTER TABLE teams ADD COLUMN banner_url VARCHAR(1024) NULL"))


if __name__ == "__main__":
    upgrade_user_profile_fields()
    upgrade_team_profile_fields()
    print("User and team profile fields upgraded.")
