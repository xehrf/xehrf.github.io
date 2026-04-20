from __future__ import annotations

from datetime import datetime, timedelta, timezone

import redis
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.db.models import Match, MatchParticipant, MatchStatus, Task, TaskType, User

QUEUE_KEY = "mm:queue"
USER_QUEUE_KEY = "mm:user_queue:{user_id}"

def _queue_key() -> str:
    return QUEUE_KEY


def _user_queue_key(user_id: int) -> str:
    return USER_QUEUE_KEY.format(user_id=user_id)


def leave_queue_if_present(r: redis.Redis, user_id: int) -> None:
    """Remove user from matchmaking queue."""
    r.lrem(_queue_key(), 0, str(user_id))
    r.delete(_user_queue_key(user_id))


def is_user_in_queue(r: redis.Redis, user_id: int) -> bool:
    return bool(r.exists(_user_queue_key(user_id)))


def queue_size(r: redis.Redis) -> int:
    return int(r.llen(_queue_key()))


def queue_position(r: redis.Redis, user_id: int) -> int | None:
    members = [int(raw) for raw in r.lrange(_queue_key(), 0, -1)]
    for idx, uid in enumerate(members, start=1):
        if uid == user_id:
            return idx
    return None


def _select_party_users(db: Session, r: redis.Redis, anchor_user: User, size: int) -> list[int] | None:
    queued = [int(raw) for raw in r.lrange(_queue_key(), 0, -1)]
    seen: set[int] = set()
    ordered_unique: list[int] = []
    for uid in queued:
        if uid not in seen and is_user_in_queue(r, uid):
            ordered_unique.append(uid)
            seen.add(uid)
    if len(ordered_unique) < size:
        return None

    users = db.query(User).filter(User.id.in_(ordered_unique)).all()
    pts_map = {u.id: u.pts for u in users}
    indexed = list(enumerate(ordered_unique))
    indexed.sort(key=lambda pair: (abs(pts_map.get(pair[1], anchor_user.pts) - anchor_user.pts), pair[0]))
    selected = [uid for _, uid in indexed[:size]]
    return selected if len(selected) == size else None


def _select_match_task(db: Session) -> Task | None:
    return (
        db.query(Task)
        .filter(and_(Task.task_type == TaskType.match, Task.is_published.is_(True)))
        .order_by(func.random())
        .first()
    )


def _create_match(db: Session, user_ids: list[int], task: Task) -> Match:
    now = datetime.now(timezone.utc)
    ends = now + timedelta(minutes=task.time_limit_minutes)
    match = Match(
        task_id=task.id,
        status=MatchStatus.active,
        started_at=now,
        ends_at=ends,
        duration_minutes=task.time_limit_minutes,
    )
    db.add(match)
    db.flush()

    for uid in user_ids:
        db.add(
            MatchParticipant(
                match_id=match.id,
                user_id=uid,
            )
        )
    db.commit()
    db.refresh(match)
    return match


def try_queue_match(db: Session, r: redis.Redis, user: User) -> Match | None:
    """Try to create a match for the caller and closest queued users by PTS."""
    party_size = 2
    leave_queue_if_present(r, user.id)
    key = _queue_key()
    r.rpush(key, str(user.id))
    r.set(_user_queue_key(user.id), "1", ex=3600)

    user_ids = _select_party_users(db, r, user, party_size)
    if user_ids is None:
        return None

    for uid in user_ids:
        r.lrem(key, 1, str(uid))

    task = _select_match_task(db)
    if task is None:
        for uid in user_ids:
            r.rpush(key, str(uid))
        for uid in user_ids:
            r.set(_user_queue_key(uid), "1", ex=3600)
        return None

    for uid in user_ids:
        r.delete(_user_queue_key(uid))
    return _create_match(db, user_ids, task)


def get_active_match_for_user(db: Session, user_id: int) -> Match | None:
    return (
        db.query(Match)
        .join(MatchParticipant)
        .filter(
            MatchParticipant.user_id == user_id,
            Match.status.in_([MatchStatus.pending, MatchStatus.active]),
        )
        .order_by(Match.id.desc())
        .first()
    )


def get_match_opponent(db: Session, match_id: int, user_id: int) -> User | None:
    return (
        db.query(User)
        .join(MatchParticipant, MatchParticipant.user_id == User.id)
        .filter(MatchParticipant.match_id == match_id, MatchParticipant.user_id != user_id)
        .order_by(User.id.asc())
        .first()
    )


def finalize_match_if_ready(db: Session, match: Match) -> bool:
    if match.status not in (MatchStatus.active, MatchStatus.pending):
        return False
    if not match.ends_at:
        return False

    now = datetime.now(timezone.utc)
    if now < match.ends_at:
        return False

    match.status = MatchStatus.completed
    participants = list(match.participants)
    for participant in participants:
        participant.placement = 1
        participant.pts_awarded = 0
    db.commit()
    return True


def complete_match_with_winner(db: Session, match: Match, winner_user_id: int) -> bool:
    if match.status not in (MatchStatus.active, MatchStatus.pending):
        return False

    participants = list(match.participants)
    user_ids = [p.user_id for p in participants]
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    users_by_id = {u.id: u for u in users}

    winner_found = False
    for participant in participants:
        if participant.user_id == winner_user_id:
            participant.placement = 1
            participant.pts_awarded = 30
            winner_user = users_by_id.get(participant.user_id)
            if winner_user is not None:
                winner_user.pts += 30
            winner_found = True
        else:
            participant.placement = 2
            participant.pts_awarded = -10
            loser_user = users_by_id.get(participant.user_id)
            if loser_user is not None:
                loser_user.pts = max(0, loser_user.pts - 10)
    if not winner_found:
        return False

    match.status = MatchStatus.completed
    db.commit()
    return True
