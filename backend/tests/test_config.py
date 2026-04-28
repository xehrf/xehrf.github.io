import pytest

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


def test_jwt_secret_is_required(monkeypatch):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("SECRET_KEY", raising=False)

    with pytest.raises(ValueError, match="JWT_SECRET or SECRET_KEY must be set"):
        Settings(_env_file=None)


@pytest.mark.parametrize(
    "env_name, env_value",
    [
        ("JWT_SECRET", "change-me-in-production-use-openssl-rand-hex-32"),
        ("JWT_SECRET", "dev-change-me"),
        ("SECRET_KEY", "change-me-in-production-use-openssl-rand-hex-32"),
        ("SECRET_KEY", "dev-change-me"),
    ],
)
def test_insecure_jwt_secret_values_are_rejected(monkeypatch, env_name, env_value):
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.setenv(env_name, env_value)

    with pytest.raises(ValueError, match="JWT secret uses an insecure placeholder value"):
        Settings(_env_file=None)
