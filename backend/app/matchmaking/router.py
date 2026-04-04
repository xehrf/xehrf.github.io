from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.core.redis_client import get_redis
from app.db.models import Match, User
from app.db.session import get_db
from app.matchmaking import service as mm_service
from app.matchmaking.schemas import ActiveMatchResponse, MatchmakingJoinResponse

router = APIRouter(prefix="/matchmaking", tags=["matchmaking"])


@router.post("/queue", response_model=MatchmakingJoinResponse)
def join_queue(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MatchmakingJoinResponse:
    active = mm_service.get_active_match_for_user(db, user.id)
    if active:
        return MatchmakingJoinResponse(
            status="already_in_match",
            match_id=active.id,
            task_id=active.task_id,
            ends_at=active.ends_at.isoformat() if active.ends_at else None,
            message="Finish current match before queuing.",
        )

    r = get_redis()
    try:
        match = mm_service.try_queue_match(db, r, user)
    finally:
        r.close()

    if match is None:
        return MatchmakingJoinResponse(status="queued", message="Waiting for players with similar rating.")

    return MatchmakingJoinResponse(
        status="matched",
        match_id=match.id,
        task_id=match.task_id,
        ends_at=match.ends_at.isoformat() if match.ends_at else None,
    )


@router.get("/active", response_model=ActiveMatchResponse | None)
def active_match(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ActiveMatchResponse | None:
    m = mm_service.get_active_match_for_user(db, user.id)
    if m is None:
        return None
    now = datetime.now(timezone.utc)
    remaining: int | None = None
    if m.ends_at:
        remaining = max(0, int((m.ends_at - now).total_seconds()))
    return ActiveMatchResponse(
        match_id=m.id,
        task_id=m.task_id,
        status=m.status.value,
        started_at=m.started_at.isoformat() if m.started_at else None,
        ends_at=m.ends_at.isoformat() if m.ends_at else None,
        seconds_remaining=remaining,
    )


@router.delete("/queue")
def leave_queue(user: User = Depends(get_current_user)) -> dict:
    r = get_redis()
    try:
        mm_service.leave_queue_if_present(r, user.id)
    finally:
        r.close()
    return {"status": "left"}
