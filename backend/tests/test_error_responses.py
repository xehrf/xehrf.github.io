from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import main
from app.auth.deps import get_current_user
from app.core.errors import ApiError
from app.db.session import get_db
from app.team_matchmaking import service as tm_service


class _StartupSession:
    def close(self) -> None:
        return None


class _RequestSession:
    def __init__(self) -> None:
        self.commit_calls = 0

    def commit(self) -> None:
        self.commit_calls += 1

    def close(self) -> None:
        return None


@pytest.fixture
def api_client(monkeypatch):
    monkeypatch.setattr(main, "upgrade_to_head", lambda: None)
    monkeypatch.setattr(main, "SessionLocal", lambda: _StartupSession())
    monkeypatch.setattr(main, "seed_if_empty", lambda db: None)
    main.app.dependency_overrides.clear()
    with TestClient(main.app, raise_server_exceptions=False) as client:
        yield client
    main.app.dependency_overrides.clear()


def _override_user() -> SimpleNamespace:
    return SimpleNamespace(id=7, display_name="Test User", nickname="tester", pts=900)


def _override_db(session: _RequestSession):
    def dependency():
        yield session

    return dependency


def test_join_team_returns_structured_503_error(api_client, monkeypatch) -> None:
    session = _RequestSession()
    main.app.dependency_overrides[get_current_user] = _override_user
    main.app.dependency_overrides[get_db] = _override_db(session)

    monkeypatch.setattr(tm_service, "get_current_team", lambda db, user_id: None)
    monkeypatch.setattr(
        tm_service,
        "join_queue",
        lambda db, user: (_ for _ in ()).throw(
            ApiError(
                503,
                "team_matchmaking_task_unavailable",
                "No available team tasks for team matchmaking.",
                details={"average_pts": 900},
            )
        ),
    )

    response = api_client.post("/team-matchmaking/join")

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "team_matchmaking_task_unavailable",
            "message": "No available team tasks for team matchmaking.",
            "details": {"average_pts": 900},
        }
    }
    assert session.commit_calls == 0


def test_join_team_does_not_mask_unexpected_errors(api_client, monkeypatch) -> None:
    session = _RequestSession()
    main.app.dependency_overrides[get_current_user] = _override_user
    main.app.dependency_overrides[get_db] = _override_db(session)

    monkeypatch.setattr(tm_service, "get_current_team", lambda db, user_id: None)
    monkeypatch.setattr(
        tm_service,
        "join_queue",
        lambda db, user: (_ for _ in ()).throw(RuntimeError("database offline")),
    )

    response = api_client.post("/team-matchmaking/join")

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "internal_server_error",
            "message": "An unexpected error occurred.",
        }
    }
    assert session.commit_calls == 0


def test_http_exception_is_wrapped_in_structured_error_body(api_client, monkeypatch) -> None:
    session = _RequestSession()
    main.app.dependency_overrides[get_db] = _override_db(session)

    monkeypatch.setattr(tm_service, "get_team_by_id", lambda db, team_id: None)

    response = api_client.get("/teams/999")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "not_found",
            "message": "Team not found",
        }
    }
