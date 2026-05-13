from functools import lru_cache

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_JWT_SECRETS = frozenset(
    {
        "change-me-in-production-use-openssl-rand-hex-32",
        "dev-change-me",
    }
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "CodeArena MVP"
    debug: bool = False

    database_url: str = "postgresql://codearena:codearena@localhost:5432/codearena"
    redis_url: str = "redis://localhost:6379"

    secret_key: str | None = None
    jwt_secret: str | None = None
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    api_url: str | None = None
    frontend_url: str | None = None
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    cors_origin_regex: str = ""

    oauth_state_expire_minutes: int = 10
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    google_oauth_redirect_uri: str = ""
    github_oauth_client_id: str = ""
    github_oauth_client_secret: str = ""
    github_oauth_redirect_uri: str = ""

    default_pts: int = 0
    matchmaking_party_size: int = 4
    match_default_duration_minutes: int = 120

    @field_validator("debug", mode="before")
    @classmethod
    def normalize_debug(cls, value: object) -> object:
        """Support common non-boolean DEBUG values used in deployment panels."""
        if isinstance(value, str):
            normalized = value.strip().lower()
            truthy = {"1", "true", "t", "yes", "y", "on", "dev", "development", "debug"}
            falsy = {"0", "false", "f", "no", "n", "off", "prod", "production", "release"}
            if normalized in truthy:
                return True
            if normalized in falsy:
                return False
        return value

    @field_validator(
        "database_url",
        "redis_url",
        "cors_origins",
        "cors_origin_regex",
        "api_url",
        "frontend_url",
        "secret_key",
        "jwt_secret",
        "google_oauth_client_id",
        "google_oauth_client_secret",
        "google_oauth_redirect_uri",
        "github_oauth_client_id",
        "github_oauth_client_secret",
        "github_oauth_redirect_uri",
        mode="before",
    )
    @classmethod
    def strip_string_settings(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @model_validator(mode="after")
    def validate_jwt_secret(self) -> "Settings":
        resolved_secret = self.secret_key or self.jwt_secret
        if not resolved_secret:
            raise ValueError("JWT_SECRET or SECRET_KEY must be set.")
        if resolved_secret in INSECURE_JWT_SECRETS:
            raise ValueError("JWT secret uses an insecure placeholder value.")
        self.jwt_secret = resolved_secret
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
