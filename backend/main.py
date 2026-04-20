from contextlib import asynccontextmanager

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

    with engine.begin() as conn:
        conn.execute(text("""
            UPDATE users 
            SET onboarding_completed = FALSE 
            WHERE onboarding_completed IS NULL OR role IS NULL
        """))

    try:
        with engine.begin() as conn:
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

# ====================== CORS MIDDLEWARE (САМЫЙ ПЕРВЫЙ!) ======================
cors_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]

# Добавляем актуальный origin твоего фронтенда (Vercel)
extra_origins = [
    "https://xehrf-github-olhcltluo-xehrfs-projects.vercel.app",
    "https://xehrf-github-io.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
for origin in extra_origins:
    if origin not in cors_origins:
        cors_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=settings.cors_origin_regex if settings.cors_origin_regex else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# ====================== СТАТИКА ======================
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ====================== РОУТЕРЫ ======================
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