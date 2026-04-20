import json

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.models import User
from app.uploads.service import save_upload_file


def update_user_profile(
    user: User,
    db: Session,
    nickname: str | None = None,
    bio: str | None = None,
    avatar: UploadFile | None = None,
    banner: UploadFile | None = None,
) -> User:
    """Apply profile changes for the authenticated user and persist them."""
    if nickname is not None:
        cleaned = nickname.strip()
        if len(cleaned) < 2 or len(cleaned) > 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nickname должен быть от 2 до 100 символов.",
            )
        user.nickname = cleaned
        user.display_name = cleaned

    if bio is not None:
        user.bio = bio.strip() if bio.strip() else None

    if avatar is not None:
        user.avatar_url = save_upload_file(avatar, "avatars")

    if banner is not None:
        user.banner_url = save_upload_file(banner, "banners")

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def normalize_role(raw_role: str | None) -> str | None:
    if raw_role is None:
        return None
    cleaned = raw_role.strip()
    return cleaned or None


def normalize_technologies(raw_value: object) -> list[str]:
    values: list[str] = []

    if raw_value is None:
        return values

    if isinstance(raw_value, (list, tuple, set)):
        source = list(raw_value)
    elif isinstance(raw_value, str):
        stripped = raw_value.strip()
        if not stripped or stripped in {"[]", "{}"}:
            return values
        if stripped.startswith("[") and stripped.endswith("]"):
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError:
                parsed = []
            source = parsed if isinstance(parsed, list) else []
        elif stripped.startswith("{") and stripped.endswith("}"):
            # PostgreSQL text-like array fallback: {"Python","React"}
            content = stripped[1:-1].strip()
            source = [] if not content else [part.strip().strip('"') for part in content.split(",")]
        else:
            source = [stripped]
    else:
        source = [str(raw_value)]

    seen: set[str] = set()
    for item in source:
        tech = str(item).strip()
        if not tech:
            continue
        key = tech.lower()
        if key in seen:
            continue
        seen.add(key)
        values.append(tech)
    return values


def complete_onboarding(user: User, db: Session, role: str, technologies: list[str]) -> User:
    """Complete user onboarding by setting role, technologies, and marking as completed."""
    clean_role = normalize_role(role)
    clean_technologies = normalize_technologies(technologies)
    if not clean_role:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role is required.")
    if not clean_technologies:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one technology is required.")

    user.role = clean_role
    user.technologies = clean_technologies
    user.onboarding_completed = True
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
