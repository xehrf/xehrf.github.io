from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.auth.deps import get_current_user
from app.db.models import User, UserSkill
from app.db.session import get_db
from app.users.schemas import ProfileOut, SkillIn, SkillOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/profile", response_model=ProfileOut)
def my_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    u = db.query(User).options(selectinload(User.skills)).filter(User.id == user.id).first()
    assert u is not None
    return u


@router.get("/{user_id}/profile", response_model=ProfileOut)
def public_profile(user_id: int, db: Session = Depends(get_db)) -> User:
    u = db.query(User).options(selectinload(User.skills)).filter(User.id == user_id).first()
    if u is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return u


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
