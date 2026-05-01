from __future__ import annotations

import re
from dataclasses import dataclass
from secrets import token_urlsafe
from urllib.parse import urlencode, urlsplit, urlunsplit

import httpx
from sqlalchemy.orm import Session

from app.auth.security import decode_token, hash_password
from app.core.config import Settings, get_settings
from app.db.models import User, UserLevel

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"

SUPPORTED_OAUTH_PROVIDERS = {"google", "github"}
DEFAULT_OAUTH_NEXT_PATH = "/dashboard"


@dataclass(frozen=True)
class OAuthProviderConfig:
    provider: str
    client_id: str
    client_secret: str
    redirect_uri: str
    authorize_url: str
    token_url: str
    scopes: tuple[str, ...]


@dataclass(frozen=True)
class OAuthIdentity:
    provider: str
    provider_user_id: str
    email: str | None
    email_verified: bool
    display_name: str
    nickname: str
    avatar_url: str | None


def get_user_by_token_subject(db: Session, subject: str | None) -> User | None:
    if not subject:
        return None

    stripped = str(subject).strip()
    if not stripped:
        return None

    if stripped.isdigit():
        user = db.query(User).filter(User.id == int(stripped)).first()
        if user is not None:
            return user

    return db.query(User).filter(User.email == stripped).first()


def get_user_from_access_token(db: Session, token: str) -> User | None:
    subject = decode_token(token)
    if subject is None:
        return None
    user = get_user_by_token_subject(db, subject)
    if user is None or not user.is_active:
        return None
    return user


def password_login_enabled(user: User) -> bool:
    return bool((user.hashed_password or "").strip())


def google_connected(user: User) -> bool:
    return bool((user.google_sub or "").strip())


def github_connected(user: User) -> bool:
    return bool((user.github_user_id or "").strip())


def normalize_oauth_provider(provider: str) -> str:
    normalized = provider.strip().lower()
    if normalized not in SUPPORTED_OAUTH_PROVIDERS:
        raise ValueError("Unsupported OAuth provider")
    return normalized


def normalize_oauth_mode(mode: str | None) -> str:
    normalized = (mode or "login").strip().lower()
    if normalized not in {"login", "link"}:
        raise ValueError("Unsupported OAuth mode")
    return normalized


def normalize_next_path(next_path: str | None, default: str = DEFAULT_OAUTH_NEXT_PATH) -> str:
    candidate = (next_path or "").strip()
    if not candidate.startswith("/") or candidate.startswith("//"):
        return default
    return candidate


def resolve_frontend_base_url(settings: Settings | None = None) -> str:
    resolved = settings or get_settings()
    if resolved.frontend_url:
        return resolved.frontend_url.rstrip("/")

    candidates = [item.strip().rstrip("/") for item in re.split(r"[,\s]+", resolved.cors_origins) if item.strip()]
    if candidates:
        return candidates[0]

    return "http://localhost:5173"


def build_frontend_oauth_callback_url(
    *,
    token: str | None = None,
    error: str | None = None,
    next_path: str | None = None,
    provider: str | None = None,
    mode: str | None = None,
) -> str:
    base_url = resolve_frontend_base_url()
    params: dict[str, str] = {}
    if token:
        params["token"] = token
    if error:
        params["error"] = error
    if next_path:
        params["next"] = normalize_next_path(next_path)
    if provider:
        params["provider"] = provider
    if mode:
        params["mode"] = mode

    callback_url = f"{base_url}/oauth/callback"
    if not params:
        return callback_url
    return f"{callback_url}?{urlencode(params)}"


def _provider_config_from_settings(provider: str, settings: Settings) -> OAuthProviderConfig:
    if provider == "google":
        return OAuthProviderConfig(
            provider=provider,
            client_id=settings.google_oauth_client_id,
            client_secret=settings.google_oauth_client_secret,
            redirect_uri=settings.google_oauth_redirect_uri,
            authorize_url=GOOGLE_AUTHORIZE_URL,
            token_url=GOOGLE_TOKEN_URL,
            scopes=("openid", "email", "profile"),
        )

    if provider == "github":
        return OAuthProviderConfig(
            provider=provider,
            client_id=settings.github_oauth_client_id,
            client_secret=settings.github_oauth_client_secret,
            redirect_uri=settings.github_oauth_redirect_uri,
            authorize_url=GITHUB_AUTHORIZE_URL,
            token_url=GITHUB_TOKEN_URL,
            scopes=("read:user", "user:email"),
        )

    raise ValueError("Unsupported OAuth provider")


def get_oauth_provider_config(provider: str) -> OAuthProviderConfig:
    normalized_provider = normalize_oauth_provider(provider)
    config = _provider_config_from_settings(normalized_provider, get_settings())

    missing_fields = [
        field_name
        for field_name, value in (
            ("client_id", config.client_id),
            ("client_secret", config.client_secret),
            ("redirect_uri", config.redirect_uri),
        )
        if not str(value or "").strip()
    ]
    if missing_fields:
        provider_label = normalized_provider.capitalize()
        raise ValueError(f"{provider_label} OAuth is not configured on the server")
    return config


def build_oauth_authorize_url(provider: str, state: str) -> str:
    config = get_oauth_provider_config(provider)
    params = {
        "client_id": config.client_id,
        "redirect_uri": config.redirect_uri,
        "response_type": "code",
        "scope": " ".join(config.scopes),
        "state": state,
    }
    if config.provider == "github":
        params["allow_signup"] = "true"
    return f"{config.authorize_url}?{urlencode(params)}"


def _choose_display_name(name: str | None, nickname: str | None, email: str | None) -> str:
    for candidate in (name, nickname, email):
        cleaned = str(candidate or "").strip()
        if cleaned:
            return cleaned[:100]
    return "CodeArena User"


def _choose_nickname(nickname: str | None, display_name: str | None, email: str | None) -> str:
    for candidate in (nickname, display_name, email):
        cleaned = str(candidate or "").strip()
        if cleaned:
            if "@" in cleaned:
                cleaned = cleaned.split("@", 1)[0]
            return cleaned[:100]
    return "user"


def _normalize_bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "y", "on"}
    return bool(value)


async def _fetch_google_identity(client: httpx.AsyncClient, config: OAuthProviderConfig, code: str) -> OAuthIdentity:
    token_response = await client.post(
        config.token_url,
        data={
            "code": code,
            "client_id": config.client_id,
            "client_secret": config.client_secret,
            "redirect_uri": config.redirect_uri,
            "grant_type": "authorization_code",
        },
        headers={"Accept": "application/json"},
    )
    token_response.raise_for_status()
    token_data = token_response.json()
    access_token = str(token_data.get("access_token") or "").strip()
    if not access_token:
        raise ValueError("Google OAuth did not return an access token")

    userinfo_response = await client.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    userinfo_response.raise_for_status()
    profile = userinfo_response.json()

    provider_user_id = str(profile.get("sub") or "").strip()
    if not provider_user_id:
        raise ValueError("Google OAuth did not return a subject identifier")

    email = str(profile.get("email") or "").strip() or None
    return OAuthIdentity(
        provider="google",
        provider_user_id=provider_user_id,
        email=email,
        email_verified=_normalize_bool(profile.get("email_verified")),
        display_name=_choose_display_name(profile.get("name"), profile.get("given_name"), email),
        nickname=_choose_nickname(profile.get("given_name"), profile.get("name"), email),
        avatar_url=str(profile.get("picture") or "").strip() or None,
    )


def _pick_verified_github_email(payload: object) -> str | None:
    if not isinstance(payload, list):
        return None

    verified_rows = [row for row in payload if isinstance(row, dict) and _normalize_bool(row.get("verified"))]
    primary_verified = next(
        (
            str(row.get("email") or "").strip()
            for row in verified_rows
            if _normalize_bool(row.get("primary")) and str(row.get("email") or "").strip()
        ),
        None,
    )
    if primary_verified:
        return primary_verified

    return next(
        (str(row.get("email") or "").strip() for row in verified_rows if str(row.get("email") or "").strip()),
        None,
    )


async def _fetch_github_identity(client: httpx.AsyncClient, config: OAuthProviderConfig, code: str) -> OAuthIdentity:
    token_headers = {
        "Accept": "application/json",
        "User-Agent": "CodeArena OAuth",
    }
    token_response = await client.post(
        config.token_url,
        data={
            "client_id": config.client_id,
            "client_secret": config.client_secret,
            "code": code,
            "redirect_uri": config.redirect_uri,
        },
        headers=token_headers,
    )
    token_response.raise_for_status()
    token_data = token_response.json()
    access_token = str(token_data.get("access_token") or "").strip()
    if not access_token:
        raise ValueError("GitHub OAuth did not return an access token")

    api_headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "CodeArena OAuth",
    }
    profile_response = await client.get(GITHUB_USER_URL, headers=api_headers)
    profile_response.raise_for_status()
    profile = profile_response.json()

    emails_response = await client.get(GITHUB_EMAILS_URL, headers=api_headers)
    emails_response.raise_for_status()
    email = _pick_verified_github_email(emails_response.json())
    if not email:
        raise ValueError("GitHub account must expose at least one verified email address")

    provider_user_id = str(profile.get("id") or "").strip()
    if not provider_user_id:
        raise ValueError("GitHub OAuth did not return a user identifier")

    login = str(profile.get("login") or "").strip() or None
    return OAuthIdentity(
        provider="github",
        provider_user_id=provider_user_id,
        email=email,
        email_verified=True,
        display_name=_choose_display_name(profile.get("name"), login, email),
        nickname=_choose_nickname(login, profile.get("name"), email),
        avatar_url=str(profile.get("avatar_url") or "").strip() or None,
    )


async def fetch_oauth_identity(provider: str, code: str) -> OAuthIdentity:
    config = get_oauth_provider_config(provider)
    async with httpx.AsyncClient(timeout=15) as client:
        if config.provider == "google":
            return await _fetch_google_identity(client, config, code)
        if config.provider == "github":
            return await _fetch_github_identity(client, config, code)
    raise ValueError("Unsupported OAuth provider")


def _get_user_by_provider_identity(db: Session, provider: str, provider_user_id: str) -> User | None:
    if provider == "google":
        return db.query(User).filter(User.google_sub == provider_user_id).first()
    if provider == "github":
        return db.query(User).filter(User.github_user_id == provider_user_id).first()
    raise ValueError("Unsupported OAuth provider")


def _apply_oauth_identity_to_user(user: User, identity: OAuthIdentity) -> None:
    if identity.provider == "google":
        user.google_sub = identity.provider_user_id
    elif identity.provider == "github":
        user.github_user_id = identity.provider_user_id
        user.github_login = identity.nickname

    if not user.avatar_url and identity.avatar_url:
        user.avatar_url = identity.avatar_url
    if not user.display_name and identity.display_name:
        user.display_name = identity.display_name[:100]
    if not user.nickname and identity.nickname:
        user.nickname = identity.nickname[:100]


def _create_user_from_oauth_identity(db: Session, identity: OAuthIdentity) -> User:
    if not identity.email or not identity.email_verified:
        raise ValueError("OAuth provider did not supply a verified email address")

    settings = get_settings()
    user = User(
        email=identity.email,
        hashed_password=hash_password(token_urlsafe(48)),
        display_name=identity.display_name[:100],
        nickname=identity.nickname[:100],
        avatar_url=identity.avatar_url,
        pts=settings.default_pts,
        level=UserLevel.beginner,
        role=None,
        onboarding_completed=False,
    )
    _apply_oauth_identity_to_user(user, identity)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def complete_oauth_login(db: Session, identity: OAuthIdentity) -> User:
    linked_user = _get_user_by_provider_identity(db, identity.provider, identity.provider_user_id)
    if linked_user is not None:
        _apply_oauth_identity_to_user(linked_user, identity)
        db.add(linked_user)
        db.commit()
        db.refresh(linked_user)
        return linked_user

    if not identity.email or not identity.email_verified:
        raise ValueError("OAuth provider did not supply a verified email address")

    existing_user = db.query(User).filter(User.email == identity.email).first()
    if existing_user is not None:
        _apply_oauth_identity_to_user(existing_user, identity)
        db.add(existing_user)
        db.commit()
        db.refresh(existing_user)
        return existing_user

    return _create_user_from_oauth_identity(db, identity)


def complete_oauth_link(db: Session, user_id: int, identity: OAuthIdentity) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise ValueError("User not found")

    linked_user = _get_user_by_provider_identity(db, identity.provider, identity.provider_user_id)
    if linked_user is not None and linked_user.id != user.id:
        raise ValueError("This provider is already linked to another account")

    if identity.email:
        email_owner = db.query(User).filter(User.email == identity.email).first()
        if email_owner is not None and email_owner.id != user.id:
            raise ValueError("OAuth email is already used by another account")

    _apply_oauth_identity_to_user(user, identity)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def add_query_params(url: str, params: dict[str, str]) -> str:
    filtered_params = {key: value for key, value in params.items() if value != ""}
    if not filtered_params:
        return url

    parts = urlsplit(url)
    existing = {}
    if parts.query:
        for chunk in parts.query.split("&"):
            if "=" not in chunk:
                continue
            key, value = chunk.split("=", 1)
            existing[key] = value
    merged = {**existing, **filtered_params}
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(merged), parts.fragment))
