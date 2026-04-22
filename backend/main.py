from contextlib import asynccontextmanager
import os
import re

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.auth.router import router as auth_router
from app.core.config import get_settings
from app.db.base import Base
from app.db.bootstrap import seed_if_empty
from app.db.session import SessionLocal, engine
from app.uploads.service import UPLOAD_DIR
from app.freelance.router import router as freelance_router
from app.matchmaking.router import router as mm_router
from app.payments.router import router as payments_router
from app.rating.router import router as rating_router
from app.submissions.router import router as submissions_router
from app.team_matchmaking.router import router as team_matchmaking_router, team_router
from app.tasks.router import router as tasks_router
from app.users.router import router as users_router
from app.matchmaking.match_ws import match_ws_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS pts INTEGER DEFAULT 0"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS level VARCHAR DEFAULT 'beginner'"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(100)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS technologies TEXT DEFAULT '[]'"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS pvp_win_streak INTEGER DEFAULT 0"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS pvp_best_win_streak INTEGER DEFAULT 0"))
        conn.execute(text("ALTER TABLE rating_history ADD COLUMN IF NOT EXISTS season_code VARCHAR(16)"))
        conn.execute(text("ALTER TABLE rating_history ADD COLUMN IF NOT EXISTS language_key VARCHAR(64)"))
        conn.execute(text("ALTER TABLE rating_history ADD COLUMN IF NOT EXISTS topic_key VARCHAR(64)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_rating_history_season_code ON rating_history (season_code)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_rating_history_language_key ON rating_history (language_key)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_rating_history_topic_key ON rating_history (topic_key)"))

    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE users 
            SET onboarding_completed = FALSE 
            WHERE onboarding_completed IS NULL OR role IS NULL
        """))

    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE teams ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1024)"))
            conn.execute(text("ALTER TABLE teams ADD COLUMN IF NOT EXISTS banner_url VARCHAR(1024)"))
            conn.execute(text("ALTER TABLE teams ADD COLUMN IF NOT EXISTS description VARCHAR DEFAULT ''"))
            conn.execute(text("ALTER TABLE teams ADD COLUMN IF NOT EXISTS owner_id INTEGER"))
            conn.execute(text("ALTER TABLE teams ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0"))
            conn.execute(text("ALTER TABLE team_members ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'member'"))
            conn.execute(text("ALTER TABLE team_match_history ADD COLUMN IF NOT EXISTS ptc_earned INTEGER DEFAULT 0"))
    except Exception:
        pass

    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

def _normalize_origin(value: str) -> str:
    return value.strip().rstrip("/")


cors_origins = [
    normalized
    for raw in re.split(r"[,\s]+", settings.cors_origins)
    if raw.strip()
    for normalized in [_normalize_origin(raw)]
    if normalized
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=settings.cors_origin_regex if settings.cors_origin_regex else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(tasks_router)
app.include_router(mm_router)
app.include_router(team_matchmaking_router)
app.include_router(team_router)
app.include_router(submissions_router)
app.include_router(rating_router)
app.include_router(payments_router)
app.include_router(freelance_router)
app.include_router(match_ws_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/")
def root() -> dict:
    return {"status": "ok", "service": settings.app_name}


def _resolve_port(default: int = 8000) -> int:
    raw = os.getenv("PORT", "").strip()
    if raw.isdigit():
        return int(raw)
    return default


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=_resolve_port())
