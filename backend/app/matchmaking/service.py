from __future__ import annotations

from datetime import datetime, timedelta, timezone

import redis
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Match, MatchParticipant, MatchStatus, Task, TaskType, User
from app.rating.elo import elo_bucket

QUEUE_KEY = "mm:queue:{bucket}"
USER_QUEUE_KEY = "mm:user_queue:{user_id}"

# LRANGE 0..n-1 + LTRIM n -1 if LLEN >= n (atomic)
_POP_N_IF_READY = """
local key = KEYS[1]
local n = tonumber(ARGV[1])
if redis.call('LLEN', key) < n then
  return nil
end
local items = redis.call('LRANGE', key, 0, n - 1)
redis.call('LTRIM', key, n, -1)
return items
"""


def _queue_key(bucket: int) -> str:
    return QUEUE_KEY.format(bucket=bucket)


def _user_queue_key(user_id: int) -> str:
    return USER_QUEUE_KEY.format(user_id=user_id)


def leave_queue_if_present(r: redis.Redis, user_id: int) -> None:
    bucket_raw = r.get(_user_queue_key(user_id))
    if bucket_raw is not None:
        r.lrem(_queue_key(int(bucket_raw)), 0, str(user_id))
        r.delete(_user_queue_key(user_id))


def try_queue_match(db: Session, r: redis.Redis, user: User) -> Match | None:
    settings = get_settings()
    leave_queue_if_present(r, user.id)
    bucket = elo_bucket(user.elo)
    key = _queue_key(bucket)
    r.rpush(key, str(user.id))
    r.set(_user_queue_key(user.id), str(bucket), ex=3600)

    raw = r.eval(_POP_N_IF_READY, 1, key, str(settings.matchmaking_party_size))
    if raw is None:
        return None

    user_ids = [int(x) for x in raw]
    for uid in user_ids:
        r.delete(_user_queue_key(uid))

    task = (
        db.query(Task)
        .filter(and_(Task.task_type == TaskType.match, Task.is_published.is_(True)))
        .order_by(Task.id)
        .first()
    )
    if task is None:
        for uid in reversed(user_ids):
            r.lpush(key, str(uid))
        for uid in user_ids:
            r.set(_user_queue_key(uid), str(bucket), ex=3600)
        return None

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

    db_users = db.query(User).filter(User.id.in_(user_ids)).all()
    by_id = {u.id: u for u in db_users}
    for uid in user_ids:
        u = by_id.get(uid)
        elo_val = u.elo if u else settings.default_elo
        db.add(
            MatchParticipant(
                match_id=match.id,
                user_id=uid,
                elo_before=elo_val,
            )
        )
    db.commit()
    db.refresh(match)
    return match


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
