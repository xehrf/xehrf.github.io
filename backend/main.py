import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from http import HTTPStatus
import logging
import os
import re

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.announcements.router import router as announcements_router
from app.announcements.sources.hh_poller import run_forever as run_hh_poller
from app.auth.router import router as auth_router
from app.core.config import get_settings
from app.core.errors import ApiError, build_error_body
from app.db.bootstrap import seed_if_empty
from app.db.models import Announcement, Match, MatchStatus
from app.db.session import SessionLocal
from app.db.upgrade import upgrade_to_head
from app.uploads.service import UPLOAD_DIR
from app.matchmaking.router import router as mm_router
from app.matchmaking import service as mm_service
from app.matchmaking.ws import manager as matchmaking_manager
from app.payments.router import router as payments_router
from app.rating.router import router as rating_router
from app.stats.router import router as stats_router
from app.submissions.router import router as submissions_router
from app.social.router import router as social_router
from app.team_matchmaking.router import router as team_matchmaking_router, team_router
from app.tasks.router import router as tasks_router
from app.users.router import router as users_router
from app.matchmaking.match_ws import match_ws_router
from app.core.limiter import limiter
from app.core.redis_client import get_redis

# Configure root logging so messages from `logging.getLogger(__name__)` in our
# package modules actually reach Render's log capture. Without this, Python's
# root logger has no handlers and our INFO/WARNING messages get silently
# dropped (LastResort only fires above WARNING and only to stderr).
#
# We attach an explicit StreamHandler to stdout so the output is unbuffered and
# matches uvicorn's format.
if not logging.getLogger().handlers:
    import sys
    _handler = logging.StreamHandler(sys.stdout)
    _handler.setFormatter(logging.Formatter(
        "%(levelname)s:%(name)s:%(message)s",
    ))
    logging.getLogger().addHandler(_handler)
    logging.getLogger().setLevel(logging.INFO)
# Ensure our package loggers also propagate at INFO level.
logging.getLogger("app").setLevel(logging.INFO)

logger = logging.getLogger(__name__)
logger.warning("CodeArena backend boot: logging configured")
MATCH_TIMEOUT_SWEEP_LOCK_KEY = "mm:timeout_sweep_lock"
MATCH_TIMEOUT_SWEEP_INTERVAL_SECONDS = 10
ANNOUNCEMENT_SWEEP_LOCK_KEY = "announcements:sweep_lock"
ANNOUNCEMENT_SWEEP_INTERVAL_SECONDS = 300  # check every 5 minutes


async def _emit_match_finished(participant_ids: list[int], payload: dict) -> None:
    for participant_id in participant_ids:
        await matchmaking_manager.send_event(participant_id, "match_finished", payload)


async def _match_timeout_sweeper() -> None:
    while True:
        pending_events: list[tuple[list[int], dict]] = []
        db = SessionLocal()
        r = get_redis()
        lock_acquired = False

        try:
            lock_acquired = bool(r.set(MATCH_TIMEOUT_SWEEP_LOCK_KEY, "1", ex=30, nx=True))
            if lock_acquired:
                expired_matches = (
                    db.query(Match)
                    .filter(
                        Match.status.in_([MatchStatus.pending, MatchStatus.active]),
                        Match.ends_at.is_not(None),
                        Match.ends_at <= datetime.now(timezone.utc),
                    )
                    .all()
                )

                for match in expired_matches:
                    payload = mm_service.finalize_match_if_ready(db, match, r)
                    if payload is None:
                        continue
                    participant_ids = [participant.user_id for participant in match.participants]
                    pending_events.append((participant_ids, payload))
        except Exception:
            logger.exception("Failed to sweep expired matches")
        finally:
            if lock_acquired:
                try:
                    r.delete(MATCH_TIMEOUT_SWEEP_LOCK_KEY)
                except Exception:
                    pass
            r.close()
            db.close()

        for participant_ids, payload in pending_events:
            try:
                await _emit_match_finished(participant_ids, payload)
            except Exception:
                logger.exception("Failed to emit match_finished for match_id=%s", payload.get("match_id"))

        await asyncio.sleep(MATCH_TIMEOUT_SWEEP_INTERVAL_SECONDS)


async def _announcement_expiry_sweeper() -> None:
    while True:
        db = SessionLocal()
        r = get_redis()
        lock_acquired = False
        try:
            lock_acquired = bool(r.set(ANNOUNCEMENT_SWEEP_LOCK_KEY, "1", ex=120, nx=True))
            if lock_acquired:
                deleted = (
                    db.query(Announcement)
                    .filter(Announcement.expires_at <= datetime.now(timezone.utc))
                    .delete(synchronize_session=False)
                )
                if deleted:
                    db.commit()
                    logger.info("Hard-deleted %d expired announcements", deleted)
        except Exception:
            logger.exception("Failed to sweep expired announcements")
            try:
                db.rollback()
            except Exception:
                pass
        finally:
            if lock_acquired:
                try:
                    r.delete(ANNOUNCEMENT_SWEEP_LOCK_KEY)
                except Exception:
                    pass
            r.close()
            db.close()

        await asyncio.sleep(ANNOUNCEMENT_SWEEP_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Diagnostic prints (bypassing the logging module) — these always reach
    # Render's stdout when PYTHONUNBUFFERED=1 is set, even if some library
    # has reset the root logger handlers.
    print("LIFESPAN: start", flush=True)
    upgrade_to_head()
    print("LIFESPAN: migrations applied", flush=True)
    db = SessionLocal()
    sweep_task: asyncio.Task | None = None
    announcement_sweep_task: asyncio.Task | None = None
    try:
        seed_if_empty(db)
        print("LIFESPAN: seeds applied", flush=True)
    finally:
        db.close()
    sweep_task = asyncio.create_task(_match_timeout_sweeper())
    announcement_sweep_task = asyncio.create_task(_announcement_expiry_sweeper())
    hh_poller_task = asyncio.create_task(run_hh_poller())
    print("LIFESPAN: background tasks scheduled (match sweeper, ann sweeper, hh poller)", flush=True)
    try:
        yield
    finally:
        # Cancel every task FIRST so none of them gets an event-loop cycle to
        # execute body code while we await another task's cancellation.
        tasks = [t for t in (sweep_task, announcement_sweep_task, hh_poller_task) if t is not None]
        for task in tasks:
            task.cancel()
        for task in tasks:
            try:
                await task
            except asyncio.CancelledError:
                pass


settings = get_settings()
app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


def _default_error_code(status_code: int) -> str:
    try:
        return HTTPStatus(status_code).name.lower()
    except ValueError:
        return f"http_{status_code}"


def _json_error_response(status_code: int, code: str, message: str, *, details: object = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=build_error_body(code, message, details=details),
    )


@app.exception_handler(ApiError)
async def api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
    return _json_error_response(exc.status_code, exc.code, exc.message, details=exc.details)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        code = str(exc.detail.get("code") or _default_error_code(exc.status_code))
        message = str(exc.detail.get("message") or exc.detail.get("detail") or HTTPStatus(exc.status_code).phrase)
        details = exc.detail.get("details")
    else:
        code = _default_error_code(exc.status_code)
        message = str(exc.detail)
        details = None
    return _json_error_response(exc.status_code, code, message, details=details)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return _json_error_response(
        422,
        "validation_error",
        "Request validation failed.",
        details=exc.errors(),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled application error", exc_info=exc)
    return _json_error_response(500, "internal_server_error", "An unexpected error occurred.")


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
app.include_router(stats_router)
app.include_router(payments_router)
app.include_router(announcements_router)
app.include_router(social_router)
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
