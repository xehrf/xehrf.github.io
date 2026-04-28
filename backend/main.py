from contextlib import asynccontextmanager
from http import HTTPStatus
import logging
import os
import re

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.auth.router import router as auth_router
from app.core.config import get_settings
from app.core.errors import ApiError, build_error_body
from app.db.bootstrap import seed_if_empty
from app.db.session import SessionLocal
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

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, lifespan=lifespan)
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
