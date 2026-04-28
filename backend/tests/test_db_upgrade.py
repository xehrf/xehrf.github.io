from pathlib import Path

from alembic.config import Config

from app.db import upgrade as db_upgrade


def test_get_alembic_config_points_to_backend_ini() -> None:
    config = db_upgrade.get_alembic_config()

    assert isinstance(config, Config)
    assert config.config_file_name is not None
    assert Path(config.config_file_name).name == "alembic.ini"
    assert Path(config.config_file_name).exists()


def test_upgrade_to_head_uses_alembic_head(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_upgrade(config: Config, revision: str) -> None:
        captured["config"] = config
        captured["revision"] = revision

    monkeypatch.setattr(db_upgrade.command, "upgrade", fake_upgrade)

    db_upgrade.upgrade_to_head()

    assert isinstance(captured["config"], Config)
    assert captured["revision"] == "head"
