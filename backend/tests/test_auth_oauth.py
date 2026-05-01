from app.auth.security import create_access_token, create_oauth_state, decode_oauth_state, decode_token
from app.auth.service import build_frontend_oauth_callback_url, normalize_next_path
from app.core.config import get_settings


def test_access_token_roundtrip_supports_numeric_subjects() -> None:
    token = create_access_token("42")

    assert decode_token(token) == "42"


def test_oauth_state_is_decoded_separately_from_access_tokens() -> None:
    state = create_oauth_state(
        {
            "provider": "google",
            "mode": "link",
            "next": "/profile/edit",
            "link_user_id": 7,
        }
    )

    assert decode_token(state) is None
    assert decode_oauth_state(state) is not None
    assert decode_oauth_state(state)["provider"] == "google"
    assert decode_oauth_state(state)["mode"] == "link"


def test_normalize_next_path_rejects_external_urls() -> None:
    assert normalize_next_path("https://evil.example", "/dashboard") == "/dashboard"
    assert normalize_next_path("//evil.example", "/dashboard") == "/dashboard"
    assert normalize_next_path("/matchmaking?tab=leaderboard", "/dashboard") == "/matchmaking?tab=leaderboard"


def test_build_frontend_callback_url_uses_frontend_url_setting(monkeypatch) -> None:
    monkeypatch.setenv("FRONTEND_URL", "https://frontend.example")
    get_settings.cache_clear()

    try:
        url = build_frontend_oauth_callback_url(
            token="abc123",
            next_path="/profile/edit",
            provider="github",
            mode="link",
        )
    finally:
        get_settings.cache_clear()

    assert url.startswith("https://frontend.example/oauth/callback?")
    assert "token=abc123" in url
    assert "next=%2Fprofile%2Fedit" in url
    assert "provider=github" in url
    assert "mode=link" in url
