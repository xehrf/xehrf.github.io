import pytest
from pydantic import ValidationError

from app.users.schemas import OnboardingIn
from app.users.service import normalize_technologies


def test_onboarding_schema_cleans_payload() -> None:
    data = OnboardingIn(
        role="  Full-stack  ",
        technologies=[" Python ", "python", "React", "   "],
    )
    assert data.role == "Full-stack"
    assert data.technologies == ["Python", "React"]


def test_onboarding_schema_requires_non_empty_technologies() -> None:
    with pytest.raises(ValidationError):
        OnboardingIn(role="Back-end", technologies=["   "])


def test_normalize_technologies_handles_json_string() -> None:
    assert normalize_technologies('["Python","FastAPI"]') == ["Python", "FastAPI"]


def test_normalize_technologies_handles_pg_style_string() -> None:
    assert normalize_technologies('{"Python","React"}') == ["Python", "React"]
