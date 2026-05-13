from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, selectinload

from app.auth.deps import get_current_user
from app.db.models import User, UserSkill
from app.db.session import get_db
from app.users.schemas import ProfileOut, SkillIn, SkillOut, OnboardingIn
from app.users.service import (
    clear_bg_video,
    complete_onboarding,
    normalize_role,
    normalize_technologies,
    set_bg_video,
    update_user_profile,
)

router = APIRouter(prefix="/users", tags=["users"])


def _get_profile(user_id: int, db: Session) -> User:
    u = db.query(User).options(selectinload(User.skills)).filter(User.id == user_id).first()
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    u.role = normalize_role(u.role)
    u.technologies = normalize_technologies(u.technologies)
    u.pvp_win_streak = int(u.pvp_win_streak or 0)
    u.pvp_best_win_streak = max(int(u.pvp_best_win_streak or 0), u.pvp_win_streak)
    if u.onboarding_completed and (u.role is None or not u.technologies):
        u.onboarding_completed = False
    return u


@router.get("/me/profile", response_model=ProfileOut)
def my_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    return _get_profile(user.id, db)


@router.get("/{user_id}/profile", response_model=ProfileOut)
def public_profile(user_id: int, db: Session = Depends(get_db)) -> User:
    return _get_profile(user_id, db)


@router.get("/{user_id}", response_model=ProfileOut)
def public_profile_by_id(user_id: int, db: Session = Depends(get_db)) -> User:
    return _get_profile(user_id, db)


@router.patch("/me", response_model=ProfileOut)
def update_my_profile(
    avatar: UploadFile | None = File(None),
    banner: UploadFile | None = File(None),
    nickname: str | None = Form(None),
    bio: str | None = Form(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return update_user_profile(user, db, nickname=nickname, bio=bio, avatar=avatar, banner=banner)


@router.put("/me/skills", response_model=list[SkillOut])
def replace_skills(
    skills: list[SkillIn],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserSkill]:
    db.query(UserSkill).filter(UserSkill.user_id == user.id).delete(synchronize_session=False)
    rows: list[UserSkill] = []
    for s in skills:
        row = UserSkill(user_id=user.id, skill_name=s.skill_name, proficiency=s.proficiency)
        db.add(row)
        rows.append(row)
    db.commit()
    for row in rows:
        db.refresh(row)
    return rows


@router.post("/me/onboarding", response_model=ProfileOut)
def complete_user_onboarding(
    data: OnboardingIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return complete_onboarding(user, db, data.role, data.technologies)


@router.post("/me/bg-video", response_model=ProfileOut)
def upload_bg_video(
    video: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Upload a short looping video to use as ASCII/pixel background on the profile."""
    return _get_profile(set_bg_video(user, db, video).id, db)


@router.delete("/me/bg-video", response_model=ProfileOut)
def remove_bg_video(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return _get_profile(clear_bg_video(user, db).id, db)
