from app.core.config import Settings


def test_debug_accepts_release_value(monkeypatch):
    monkeypatch.setenv("DEBUG", "release")
    settings = Settings()
    assert settings.debug is False


def test_debug_accepts_dev_value(monkeypatch):
    monkeypatch.setenv("DEBUG", "dev")
    settings = Settings()
    assert settings.debug is True


def test_urls_are_trimmed(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@host/db ")
    monkeypatch.setenv("REDIS_URL", "redis://host:6379/0 ")
    settings = Settings()
    assert settings.database_url == "postgresql://user:pass@host/db"
    assert settings.redis_url == "redis://host:6379/0"
