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
