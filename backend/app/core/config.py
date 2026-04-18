from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "CodeArena MVP"
    debug: bool = False

    database_url: str = "postgresql://codearena:codearena@localhost:5432/codearena"
    redis_url: str = "redis://localhost:6379/0"

    secret_key: str | None = None
    jwt_secret: str = "change-me-in-production-use-openssl-rand-hex-32"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    api_url: str | None = None
cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,https://*.vercel.app"
    cors_origin_regex: str = r"^https:\/\/.*\.vercel\.app$"

    default_pts: int = 0
    matchmaking_party_size: int = 4
    match_default_duration_minutes: int = 120


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.secret_key:
        settings.jwt_secret = settings.secret_key
    return settings
