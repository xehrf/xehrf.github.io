from datetime import datetime, timezone

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.security import decode_token
from app.core.redis_client import get_redis
from app.db.models import Match, MatchStatus, User
from app.db.session import get_db
from app.matchmaking import service as mm_service
from app.matchmaking.schemas import ActiveMatchResponse, MatchmakingJoinResponse
from app.matchmaking.ws import manager

router = APIRouter(prefix="/matchmaking", tags=["matchmaking"])


def _opponent_payload(db: Session, match: Match, user_id: int) -> dict | None:
    opponent = mm_service.get_match_opponent(db, match.id, user_id)
    if opponent is None:
        return None
    return {
        "user_id": opponent.id,
        "display_name": opponent.display_name,
        "nickname": opponent.nickname,
        "pts": opponent.pts,
    }


@router.post("/queue", response_model=MatchmakingJoinResponse)
async def join_queue(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MatchmakingJoinResponse:
    active = mm_service.get_active_match_for_user(db, user.id)
    if active:
        return MatchmakingJoinResponse(
            status="already_in_match",
            match_id=active.id,
            task_id=active.task_id,
            ends_at=active.ends_at.isoformat() if active.ends_at else None,
            opponent=_opponent_payload(db, active, user.id),
            message="Finish current match before queuing.",
        )

    r = get_redis()
    try:
        match = mm_service.try_queue_match(db, r, user)
        q_size = mm_service.queue_size(r)
        q_pos = mm_service.queue_position(r, user.id)
    finally:
        r.close()

    if match is None:
        await manager.send_event(
    user.id,
    "queue_update",
    {"queue_size": q_size, "queue_position": q_pos, "status": "queued", "total": 2},
        )

        return MatchmakingJoinResponse(
            status="queued",
            queue_size=q_size,
            queue_position=q_pos,
            message="Waiting for players with similar rating.",
        )

    opponent = _opponent_payload(db, match, user.id)
    participant_ids = [p.user_id for p in match.participants]
    for uid in participant_ids:
        await manager.send_event(
            uid,
            "match_found",
            {
                "match_id": match.id,
                "task_id": match.task_id,
                "ends_at": match.ends_at.isoformat() if match.ends_at else None,
            },
        )

    return MatchmakingJoinResponse(
        status="matched",
        match_id=match.id,
        task_id=match.task_id,
        ends_at=match.ends_at.isoformat() if match.ends_at else None,
        opponent=opponent,
    )


@router.get("/active", response_model=ActiveMatchResponse | None)
def active_match(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ActiveMatchResponse | None:
    m = mm_service.get_active_match_for_user(db, user.id)
    if m is None:
        return None
    mm_service.finalize_match_if_ready(db, m)
    db.refresh(m)
    if m.status not in (MatchStatus.pending, MatchStatus.active):
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
        opponent=_opponent_payload(db, m, user.id),
    )


@router.delete("/queue")
async def leave_queue(user: User = Depends(get_current_user)) -> dict:
    r = get_redis()
    try:
        mm_service.leave_queue_if_present(r, user.id)
        q_size = mm_service.queue_size(r)
    finally:
        r.close()
    await manager.send_event(user.id, "queue_update", {"queue_size": q_size, "queue_position": None, "status": "left", "total": 2})
    return {"status": "left"}


@router.websocket("/ws")
async def matchmaking_socket(websocket: WebSocket, db: Session = Depends(get_db)) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    sub = decode_token(token)
    if not sub:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    user = db.query(User).filter(User.email == sub, User.is_active.is_(True)).first()
    if user is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    await manager.connect(user.id, websocket)
    try:
        active = mm_service.get_active_match_for_user(db, user.id)
        if active is not None:
            await manager.send_event(
                user.id,
                "active_match",
                {
                    "match_id": active.id,
                    "task_id": active.task_id,
                    "ends_at": active.ends_at.isoformat() if active.ends_at else None,
                    "status": active.status.value,
                },
            )
        else:
            r = get_redis()
            try:
                await manager.send_event(
                    user.id,
                    "queue_update",
                    {
                        "queue_size": mm_service.queue_size(r),
                        "queue_position": mm_service.queue_position(r, user.id),
                        "status": "queued" if mm_service.is_user_in_queue(r, user.id) else "idle",
                        "total": 2,
                    },
                )
            finally:
                r.close()

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user.id, websocket)
