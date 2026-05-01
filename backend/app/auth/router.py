from secrets import token_urlsafe

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user, get_optional_current_user
from app.auth.schemas import (
    AuthMeResponse,
    OAuthProvidersResponse,
    OAuthProviderStatus,
    OAuthStartBody,
    OAuthStartResponse,
    TokenResponse,
    UserLogin,
    UserRegister,
)
from app.auth.security import create_access_token, create_oauth_state, decode_oauth_state, hash_password, verify_password
from app.auth.service import (
    build_frontend_oauth_callback_url,
    build_oauth_authorize_url,
    complete_oauth_link,
    complete_oauth_login,
    fetch_oauth_identity,
    github_connected,
    google_connected,
    is_oauth_provider_configured,
    normalize_next_path,
    normalize_oauth_mode,
    normalize_oauth_provider,
    oauth_provider_label,
    password_login_enabled,
)
from app.core.config import get_settings
from app.db.models import User, UserLevel
from app.db.session import get_db
from app.users.service import normalize_role, normalize_technologies

router = APIRouter(prefix="/auth", tags=["auth"])


def _oauth_error_redirect(
    message: str,
    *,
    next_path: str | None = None,
    provider: str | None = None,
    mode: str | None = None,
) -> RedirectResponse:
    return RedirectResponse(
        url=build_frontend_oauth_callback_url(
            error=message,
            next_path=next_path,
            provider=provider,
            mode=mode,
        ),
        status_code=status.HTTP_302_FOUND,
    )


@router.post("/register", response_model=TokenResponse)
def register(body: UserRegister, db: Session = Depends(get_db)) -> TokenResponse:
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    settings = get_settings()
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
        nickname=body.display_name,
        pts=settings.default_pts,
        level=UserLevel.beginner,
        role=None,
        onboarding_completed=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/login", response_model=TokenResponse)
def login(body: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == body.email).first()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/oauth/providers", response_model=OAuthProvidersResponse)
def oauth_providers() -> OAuthProvidersResponse:
    return OAuthProvidersResponse(
        google=OAuthProviderStatus(configured=is_oauth_provider_configured("google")),
        github=OAuthProviderStatus(configured=is_oauth_provider_configured("github")),
    )


@router.post("/oauth/{provider}/start", response_model=OAuthStartResponse)
def start_oauth(
    provider: str,
    body: OAuthStartBody,
    user: User | None = Depends(get_optional_current_user),
) -> OAuthStartResponse:
    try:
        normalized_provider = normalize_oauth_provider(provider)
        mode = normalize_oauth_mode(body.mode)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if mode == "link" and user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login required to link OAuth")

    next_path = normalize_next_path(body.next, "/profile/edit" if mode == "link" else "/dashboard")
    state_payload: dict[str, object] = {
        "provider": normalized_provider,
        "mode": mode,
        "next": next_path,
        "nonce": token_urlsafe(24),
    }
    if mode == "link" and user is not None:
        state_payload["link_user_id"] = user.id

    try:
        authorize_url = build_oauth_authorize_url(normalized_provider, create_oauth_state(state_payload))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return OAuthStartResponse(authorize_url=authorize_url)


@router.get("/oauth/{provider}/callback")
async def oauth_callback(
    provider: str,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
) -> RedirectResponse:
    try:
        normalized_provider = normalize_oauth_provider(provider)
    except ValueError:
        return _oauth_error_redirect("Unsupported OAuth provider")

    if error:
        return _oauth_error_redirect(
            f"{oauth_provider_label(normalized_provider)} authorization was cancelled or denied",
            provider=normalized_provider,
        )
    if not code or not state:
        return _oauth_error_redirect(
            f"{oauth_provider_label(normalized_provider)} OAuth callback is missing required parameters",
            provider=normalized_provider,
        )

    state_payload = decode_oauth_state(state)
    if not state_payload:
        return _oauth_error_redirect(
            "OAuth session expired. Please try again.",
            provider=normalized_provider,
        )

    state_provider = str(state_payload.get("provider") or "").strip().lower()
    if state_provider != normalized_provider:
        return _oauth_error_redirect("OAuth provider mismatch", provider=normalized_provider)

    try:
        mode = normalize_oauth_mode(str(state_payload.get("mode") or "login"))
    except ValueError:
        return _oauth_error_redirect("Invalid OAuth mode", provider=normalized_provider)

    next_path = normalize_next_path(
        str(state_payload.get("next") or ""),
        "/profile/edit" if mode == "link" else "/dashboard",
    )

    try:
        identity = await fetch_oauth_identity(normalized_provider, code)
        if mode == "link":
            link_user_id = int(state_payload.get("link_user_id") or 0)
            user = complete_oauth_link(db, link_user_id, identity)
        else:
            user = complete_oauth_login(db, identity)
    except ValueError as exc:
        return _oauth_error_redirect(str(exc), next_path=next_path, provider=normalized_provider, mode=mode)
    except Exception:
        return _oauth_error_redirect(
            f"{oauth_provider_label(normalized_provider)} sign-in failed. Please try again.",
            next_path=next_path,
            provider=normalized_provider,
            mode=mode,
        )

    return RedirectResponse(
        url=build_frontend_oauth_callback_url(
            token=create_access_token(str(user.id)),
            next_path=next_path,
            provider=normalized_provider,
            mode=mode,
        ),
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/me", response_model=AuthMeResponse)
def me(user: User = Depends(get_current_user)) -> dict:
    role = normalize_role(user.role)
    technologies = normalize_technologies(user.technologies)
    onboarding_completed = bool(user.onboarding_completed and role and technologies)
    current_streak = int(user.pvp_win_streak or 0)
    best_streak = max(int(user.pvp_best_win_streak or 0), current_streak)
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "pts": user.pts,
        "level": user.level.value,
        "role": role,
        "technologies": technologies,
        "onboarding_completed": onboarding_completed,
        "pvp_win_streak": current_streak,
        "pvp_best_win_streak": best_streak,
        "google_connected": google_connected(user),
        "github_connected": github_connected(user),
        "password_login_enabled": password_login_enabled(user),
    }
