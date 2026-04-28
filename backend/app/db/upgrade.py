from pathlib import Path

from alembic import command
from alembic.config import Config


def get_alembic_config() -> Config:
    root_dir = Path(__file__).resolve().parents[2]
    return Config(str(root_dir / "alembic.ini"))


def upgrade_to_head() -> None:
    command.upgrade(get_alembic_config(), "head")


if __name__ == "__main__":
    upgrade_to_head()
