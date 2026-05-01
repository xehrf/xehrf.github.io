from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.service import get_user_from_access_token
from app.core.redis_client import get_redis
from app.db.models import Match, MatchStatus, User
from app.db.session import get_db
from app.matchmaking import service as mm_service
from app.matchmaking.schemas import ActiveMatchResponse, MatchmakingJoinResponse, RematchRequestIn
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


def _match_found_payload(match: Match) -> dict[str, object]:
    return {
        "match_id": match.id,
        "task_id": match.task_id,
        "ends_at": match.ends_at.isoformat() if match.ends_at else None,
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

    participant_ids = [p.user_id for p in match.participants]

    # 🔥 FIX ЗДЕСЬ
    for uid in participant_ids:
        await manager.send_event(
            uid,
            "match_found",
            {
                **_match_found_payload(match),
                "opponent": _opponent_payload(db, match, uid),
            },
        )

    return MatchmakingJoinResponse(
        status="matched",
        match_id=match.id,
        task_id=match.task_id,
        ends_at=match.ends_at.isoformat() if match.ends_at else None,
        opponent=_opponent_payload(db, match, user.id),
    )


@router.get("/active", response_model=ActiveMatchResponse | None)
def active_match(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> ActiveMatchResponse | None:
    m = mm_service.get_active_match_for_user(db, user.id)
    if m is None:
        return None
    r = get_redis()
    try:
        mm_service.finalize_match_if_ready(db, m, r)
    finally:
        r.close()
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


@router.get("/quests")
def get_pvp_quests(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    r = get_redis()
    try:
        return mm_service.get_pvp_quests(db, r, user)
    finally:
        r.close()


@router.post("/quests/{period}/{quest_id}/claim")
def claim_pvp_quest(
    period: str,
    quest_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    r = get_redis()
    try:
        try:
            result = mm_service.claim_pvp_quest(db, r, user, period, quest_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        return result
    finally:
        r.close()


@router.post("/rematch", response_model=MatchmakingJoinResponse)
async def request_rematch(
    body: RematchRequestIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MatchmakingJoinResponse:
    previous_match = db.query(Match).filter(Match.id == body.match_id).first()
    if previous_match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    if previous_match.status != MatchStatus.completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Match is not completed yet")

    participant_ids = [p.user_id for p in previous_match.participants]
    if user.id not in participant_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant of this match")
    if len(participant_ids) != 2:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rematch supports only 1v1 matches")
    opponent_id = next(uid for uid in participant_ids if uid != user.id)

    r = get_redis()
    try:
        rematch_status, rematch_match = mm_service.request_rematch(
            db,
            r,
            previous_match_id=body.match_id,
            requester_user_id=user.id,
            opponent_user_id=opponent_id,
        )
    finally:
        r.close()

    if rematch_status == "waiting_rematch":
        await manager.send_event(
            opponent_id,
            "rematch_offered",
            {
                "match_id": body.match_id,
                "from_user_id": user.id,
            },
        )
        return MatchmakingJoinResponse(
            status="waiting_rematch",
            match_id=body.match_id,
            message="Waiting for opponent to accept rematch.",
        )

    if rematch_status in {"already_in_match", "opponent_busy"} and rematch_match is not None:
        return MatchmakingJoinResponse(
            status="already_in_match",
            match_id=rematch_match.id,
            task_id=rematch_match.task_id,
            ends_at=rematch_match.ends_at.isoformat() if rematch_match.ends_at else None,
            opponent=_opponent_payload(db, rematch_match, user.id),
            message="A match is already active.",
        )

    if rematch_status == "no_task":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No available match tasks for rematch")

    if rematch_match is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to create rematch")

    rematch_participants = [p.user_id for p in rematch_match.participants]

    # 🔥 FIX ЗДЕСЬ ТОЖЕ
    for uid in rematch_participants:
        await manager.send_event(
            uid,
            "match_found",
            {
                **_match_found_payload(rematch_match),
                "opponent": _opponent_payload(db, rematch_match, uid),
            },
        )

    return MatchmakingJoinResponse(
        status="matched",
        match_id=rematch_match.id,
        task_id=rematch_match.task_id,
        ends_at=rematch_match.ends_at.isoformat() if rematch_match.ends_at else None,
        opponent=_opponent_payload(db, rematch_match, user.id),
    )


@router.post("/surrender")
async def surrender_match(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    active = mm_service.get_active_match_for_user(db, user.id)
    if active is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active match to surrender.")

    r = get_redis()
    try:
        mm_service.finalize_match_if_ready(db, active, r)
    finally:
        r.close()
    db.refresh(active)
    if active.status not in (MatchStatus.pending, MatchStatus.active):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Match is already finished.")

    opponent = mm_service.get_match_opponent(db, active.id, user.id)
    if opponent is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot surrender without opponent.")

    participant_ids = [p.user_id for p in active.participants]
    result = mm_service.complete_match_with_winner(db, active, opponent.id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to complete match.")

    payload = {
        "match_id": active.id,
        "status": "completed",
        "reason": "surrender",
        **result,
    }
    for uid in participant_ids:
        await manager.send_event(uid, "match_finished", payload)
    return payload


@router.websocket("/ws")
async def matchmaking_socket(websocket: WebSocket, db: Session = Depends(get_db)) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    user = get_user_from_access_token(db, token)
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
                    "opponent": _opponent_payload(db, active, user.id),  # 👈 можно сразу и тут
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
        pass
    finally:
        await manager.disconnect(user.id, websocket)
