from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.schemas import AuthMeResponse, TokenResponse, UserLogin, UserRegister
from app.auth.security import create_access_token, hash_password, verify_password
from app.core.config import get_settings
from app.db.models import User, UserLevel
from app.db.session import get_db
from app.users.service import normalize_role, normalize_technologies

router = APIRouter(prefix="/auth", tags=["auth"])


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
    return TokenResponse(access_token=create_access_token(user.email))


@router.post("/login", response_model=TokenResponse)
def login(body: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == body.email).first()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=create_access_token(user.email))


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
    }
