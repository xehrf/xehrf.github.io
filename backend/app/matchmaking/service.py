from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta, timezone

import redis
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import Match, MatchParticipant, MatchStatus, Submission, Task, TaskType, User
from app.rating.pts import apply_pts_delta, level_from_pts, pts_for_match_loss, pts_for_match_win
from app.rating.service import add_rating_history

QUEUE_KEY = "mm:queue"
USER_QUEUE_KEY = "mm:user_queue:{user_id}"
REMATCH_OFFER_KEY = "mm:rematch_offer:{match_id}:{user_id}"
REMATCH_LOCK_KEY = "mm:rematch_lock:{match_id}"
MATCH_ROUND_RESULTS_KEY = "mm:match_room:{match_id}:round_results"
QUEUE_MATCH_LOCK_KEY = "mm:queue_match_lock"
QUEUE_MATCH_LOCK_TTL = 10  # seconds — long enough to finish DB writes, short
# enough that a crashed worker doesn't block matchmaking for long.

# Lua script that releases the lock only if we still own it.  Direct
# `r.delete(key)` would risk freeing someone else's lock if ours had expired.
_RELEASE_LOCK_LUA = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
else
    return 0
end
"""

PVP_QUESTS: dict[str, list[dict[str, object]]] = {
    "daily": [
        {
            "id": "daily_play_3",
            "title": "Play 3 PvP matches",
            "description": "Complete three PvP duels today.",
            "metric": "played",
            "target": 3,
            "reward_pts": 20,
        },
        {
            "id": "daily_win_2",
            "title": "Win 2 PvP matches",
            "description": "Get two wins today.",
            "metric": "wins",
            "target": 2,
            "reward_pts": 30,
        },
    ],
    "weekly": [
        {
            "id": "weekly_play_12",
            "title": "Play 12 PvP matches",
            "description": "Complete twelve PvP duels this week.",
            "metric": "played",
            "target": 12,
            "reward_pts": 70,
        },
        {
            "id": "weekly_win_7",
            "title": "Win 7 PvP matches",
            "description": "Get seven wins this week.",
            "metric": "wins",
            "target": 7,
            "reward_pts": 100,
        },
    ],
}

def _queue_key() -> str:
    return QUEUE_KEY


def _user_queue_key(user_id: int) -> str:
    return USER_QUEUE_KEY.format(user_id=user_id)


def _rematch_offer_key(match_id: int, user_id: int) -> str:
    return REMATCH_OFFER_KEY.format(match_id=match_id, user_id=user_id)


def _rematch_lock_key(match_id: int) -> str:
    return REMATCH_LOCK_KEY.format(match_id=match_id)


def _match_round_results_key(match_id: int) -> str:
    return MATCH_ROUND_RESULTS_KEY.format(match_id=match_id)


def _streak_bonus_for_win(streak: int) -> int:
    """Scale win-streak bonus: +5 per streak step from 2+, capped to +30."""
    return max(0, min(30, (streak - 1) * 5))


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _period_start(period: str, now: datetime) -> datetime:
    if period == "daily":
        return datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    if period == "weekly":
        start = now - timedelta(days=now.weekday())
        return datetime(start.year, start.month, start.day, tzinfo=timezone.utc)
    raise ValueError("Unsupported quest period")


def _period_end(period: str, now: datetime) -> datetime:
    start = _period_start(period, now)
    if period == "daily":
        return start + timedelta(days=1)
    return start + timedelta(days=7)


def _period_id(period: str, now: datetime) -> str:
    if period == "daily":
        return now.strftime("%Y-%m-%d")
    if period == "weekly":
        iso_year, iso_week, _ = now.isocalendar()
        return f"{iso_year}-W{iso_week:02d}"
    raise ValueError("Unsupported quest period")


def _quest_claim_key(user_id: int, period: str, period_id: str, quest_id: str) -> str:
    return f"mm:quest_claim:{user_id}:{period}:{period_id}:{quest_id}"


def _quest_metrics(db: Session, user_id: int, since: datetime) -> dict[str, int]:
    played = (
        db.query(func.count(func.distinct(Match.id)))
        .join(MatchParticipant, MatchParticipant.match_id == Match.id)
        .filter(
            MatchParticipant.user_id == user_id,
            Match.status == MatchStatus.completed,
            Match.created_at >= since,
        )
        .scalar()
    )
    wins = (
        db.query(func.count(MatchParticipant.id))
        .join(Match, Match.id == MatchParticipant.match_id)
        .filter(
            MatchParticipant.user_id == user_id,
            MatchParticipant.placement == 1,
            Match.status == MatchStatus.completed,
            Match.created_at >= since,
        )
        .scalar()
    )
    return {
        "played": int(played or 0),
        "wins": int(wins or 0),
    }


def _quest_payload_for_period(db: Session, r: redis.Redis, user_id: int, period: str, now: datetime) -> dict[str, object]:
    period_cfg = PVP_QUESTS.get(period)
    if period_cfg is None:
        raise ValueError("Unsupported quest period")

    start = _period_start(period, now)
    pid = _period_id(period, now)
    metrics = _quest_metrics(db, user_id, start)
    quests: list[dict[str, object]] = []

    for quest in period_cfg:
        metric = str(quest["metric"])
        progress = int(metrics.get(metric, 0))
        target = int(quest["target"])
        claim_key = _quest_claim_key(user_id, period, pid, str(quest["id"]))
        claimed = bool(r.exists(claim_key))
        quests.append(
            {
                "id": str(quest["id"]),
                "title": str(quest["title"]),
                "description": str(quest["description"]),
                "metric": metric,
                "progress": progress,
                "target": target,
                "completed": progress >= target,
                "claimed": claimed,
                "reward_pts": int(quest["reward_pts"]),
            }
        )

    return {
        "period": period,
        "period_id": pid,
        "starts_at": start.isoformat(),
        "ends_at": _period_end(period, now).isoformat(),
        "quests": quests,
    }


def get_pvp_quests(db: Session, r: redis.Redis, user: User) -> dict[str, object]:
    now = _now_utc()
    return {
        "streak": {
            "current": int(user.pvp_win_streak or 0),
            "best": int(user.pvp_best_win_streak or 0),
        },
        "daily": _quest_payload_for_period(db, r, user.id, "daily", now),
        "weekly": _quest_payload_for_period(db, r, user.id, "weekly", now),
    }


def claim_pvp_quest(db: Session, r: redis.Redis, user: User, period: str, quest_id: str) -> dict[str, object]:
    now = _now_utc()
    period_cfg = PVP_QUESTS.get(period)
    if period_cfg is None:
        raise ValueError("Unsupported quest period")

    quest = next((q for q in period_cfg if str(q["id"]) == quest_id), None)
    if quest is None:
        raise ValueError("Quest not found")

    period_payload = _quest_payload_for_period(db, r, user.id, period, now)
    quest_payload = next((q for q in period_payload["quests"] if q["id"] == quest_id), None)
    if quest_payload is None:
        raise ValueError("Quest not found")
    if bool(quest_payload["claimed"]):
        raise ValueError("Quest already claimed")
    if not bool(quest_payload["completed"]):
        raise ValueError("Quest is not completed yet")

    claim_key = _quest_claim_key(user.id, period, str(period_payload["period_id"]), quest_id)
    ttl = max(60, int((_period_end(period, now) - now).total_seconds()) + 86400)
    claimed = r.set(claim_key, "1", ex=ttl, nx=True)
    if not claimed:
        raise ValueError("Quest already claimed")

    reward_pts = int(quest["reward_pts"])
    user.pts += reward_pts
    user.level = level_from_pts(user.pts)
    add_rating_history(
        db,
        user_id=user.id,
        pts_delta=reward_pts,
        reason="pvp_quest_claimed",
        topic_key="pvp_quest",
        language_key=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "status": "claimed",
        "period": period,
        "quest_id": quest_id,
        "reward_pts": reward_pts,
        "updated_pts": user.pts,
    }
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


def _difficulty_band_for_avg_pts(avg_pts: int) -> list[int]:
    """Choose preferred task difficulties by average party rating."""
    if avg_pts < 200:
        return [1, 2]
    if avg_pts < 500:
        return [2, 3]
    if avg_pts < 900:
        return [3, 4]
    return [4, 5]


def _average_pts_for_users(db: Session, user_ids: list[int]) -> int:
    if not user_ids:
        return 0
    avg_pts = db.query(func.avg(User.pts)).filter(User.id.in_(user_ids)).scalar()
    return int(avg_pts or 0)


def _recent_task_ids_for_users(db: Session, user_ids: list[int], *, limit: int = 20) -> list[int]:
    if not user_ids:
        return []

    # Fetch enough rows to deduplicate task ids for both players while preserving recency.
    raw_rows = (
        db.query(Match.task_id)
        .join(MatchParticipant, MatchParticipant.match_id == Match.id)
        .filter(MatchParticipant.user_id.in_(user_ids))
        .order_by(Match.id.desc())
        .limit(limit * max(1, len(user_ids)) * 2)
        .all()
    )

    seen: set[int] = set()
    out: list[int] = []
    for (task_id,) in raw_rows:
        if task_id is None or task_id in seen:
            continue
        seen.add(task_id)
        out.append(task_id)
        if len(out) >= limit:
            break
    return out


def _select_match_task(db: Session, user_ids: list[int]) -> Task | None:
    avg_pts = _average_pts_for_users(db, user_ids)
    preferred_difficulties = _difficulty_band_for_avg_pts(avg_pts)
    recent_task_ids = _recent_task_ids_for_users(db, user_ids)

    base_q = db.query(Task).filter(Task.task_type == TaskType.match, Task.is_published.is_(True))

    # 1) Prefer suitable difficulty and avoid recent repeats.
    q = base_q.filter(Task.difficulty.in_(preferred_difficulties))
    if recent_task_ids:
        q = q.filter(~Task.id.in_(recent_task_ids))
    task = q.order_by(func.random()).first()
    if task is not None:
        return task

    # 2) Keep suitable difficulty even if recently played.
    task = base_q.filter(Task.difficulty.in_(preferred_difficulties)).order_by(func.random()).first()
    if task is not None:
        return task

    # 3) Any difficulty, but still try to avoid recent repeats.
    if recent_task_ids:
        task = base_q.filter(~Task.id.in_(recent_task_ids)).order_by(func.random()).first()
        if task is not None:
            return task

    # 4) Hard fallback.
    return base_q.order_by(func.random()).first()


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
    """Try to create a match for the caller and closest queued users by PTS.

    Two-phase:
      1. Always enqueue the caller (fast, no lock).
      2. Acquire a global matchmaking lock and try to pair from the queue.

    Without the lock, two simultaneous calls could each read the queue, pick
    the same pair, and create two separate matches — a real data-corrupting
    bug since both players would then have ambiguous "active" state.

    If the lock is busy, the caller just stays enqueued; whoever holds the
    lock will pair them, and a follow-up matchmaking pulse (or the polling
    fallback on the client) will pick the new match up.
    """
    party_size = 2
    leave_queue_if_present(r, user.id)
    key = _queue_key()
    r.rpush(key, str(user.id))
    r.set(_user_queue_key(user.id), "1", ex=3600)

    lock_token = secrets.token_hex(8)
    acquired = bool(r.set(QUEUE_MATCH_LOCK_KEY, lock_token, ex=QUEUE_MATCH_LOCK_TTL, nx=True))
    if not acquired:
        return None

    try:
        user_ids = _select_party_users(db, r, user, party_size)
        if user_ids is None:
            return None

        for uid in user_ids:
            r.lrem(key, 1, str(uid))

        task = _select_match_task(db, user_ids)
        if task is None:
            # Put everyone back so they can be picked up next round.
            for uid in user_ids:
                r.rpush(key, str(uid))
            for uid in user_ids:
                r.set(_user_queue_key(uid), "1", ex=3600)
            return None

        for uid in user_ids:
            r.delete(_user_queue_key(uid))
        return _create_match(db, user_ids, task)
    finally:
        try:
            r.eval(_RELEASE_LOCK_LUA, 1, QUEUE_MATCH_LOCK_KEY, lock_token)
        except Exception:
            # Best-effort: the TTL will reap a stuck lock anyway.
            pass


def request_rematch(
    db: Session,
    r: redis.Redis,
    *,
    previous_match_id: int,
    requester_user_id: int,
    opponent_user_id: int,
) -> tuple[str, Match | None]:
    """Register rematch vote and create a new match once both players confirm."""
    active_for_requester = get_active_match_for_user(db, requester_user_id)
    if active_for_requester is not None:
        return ("already_in_match", active_for_requester)

    active_for_opponent = get_active_match_for_user(db, opponent_user_id)
    if active_for_opponent is not None:
        return ("opponent_busy", active_for_opponent)

    requester_offer_key = _rematch_offer_key(previous_match_id, requester_user_id)
    opponent_offer_key = _rematch_offer_key(previous_match_id, opponent_user_id)
    lock_key = _rematch_lock_key(previous_match_id)

    r.set(requester_offer_key, "1", ex=300)
    if not r.exists(opponent_offer_key):
        return ("waiting_rematch", None)

    # Prevent double-creation when both users press at nearly the same time.
    if not r.set(lock_key, "1", ex=15, nx=True):
        return ("waiting_rematch", None)

    try:
        existing = get_active_match_for_user(db, requester_user_id)
        if existing is not None:
            return ("already_in_match", existing)

        user_ids = [requester_user_id, opponent_user_id]
        task = _select_match_task(db, user_ids)
        if task is None:
            return ("no_task", None)

        new_match = _create_match(db, user_ids, task)
        r.delete(requester_offer_key)
        r.delete(opponent_offer_key)
        return ("matched", new_match)
    finally:
        r.delete(lock_key)


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


def reset_match_round_results(r: redis.Redis, match_id: int) -> None:
    r.delete(_match_round_results_key(match_id))


def store_match_round_result(r: redis.Redis, match_id: int, payload: dict) -> None:
    round_index = payload.get("roundIndex")
    if not isinstance(round_index, int):
        return

    key = _match_round_results_key(match_id)
    r.hset(key, str(round_index), json.dumps(payload))
    r.expire(key, 3600)


def get_match_round_results(r: redis.Redis, match_id: int) -> list[dict]:
    raw_rows = r.hgetall(_match_round_results_key(match_id))
    parsed: list[tuple[int, dict]] = []

    for raw_round_index, raw_payload in raw_rows.items():
        try:
            round_index = int(raw_round_index)
            payload = json.loads(raw_payload)
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        if not isinstance(payload, dict):
            continue
        parsed.append((round_index, payload))

    parsed.sort(key=lambda item: item[0])
    return [payload for _, payload in parsed]


def _normalize_user_id(user_id: object) -> int | None:
    try:
        return int(user_id)
    except (TypeError, ValueError):
        return None


def _score_by_user_id_from_round_results(round_results: list[dict], participant_ids: list[int]) -> dict[int, int]:
    scores = {participant_id: 0 for participant_id in participant_ids}

    for payload in round_results:
        results = payload.get("results")
        if not isinstance(results, list):
            continue

        for result in results:
            if not isinstance(result, dict):
                continue
            user_id = _normalize_user_id(result.get("userId"))
            if user_id not in scores:
                continue
            if bool(result.get("correct")):
                scores[user_id] += 1

    return scores


def resolve_match_winner_from_round_results(match: Match, round_results: list[dict]) -> int | None:
    participant_ids = [participant.user_id for participant in match.participants]
    if len(participant_ids) != 2:
        return None

    scores = _score_by_user_id_from_round_results(round_results, participant_ids)
    left_id, right_id = participant_ids
    left_score = scores.get(left_id, 0)
    right_score = scores.get(right_id, 0)

    if left_score == right_score:
        return None
    return left_id if left_score > right_score else right_id


def resolve_match_winner_from_submissions(db: Session, match_id: int) -> int | None:
    winner_submission = (
        db.query(Submission)
        .filter(
            Submission.match_id == match_id,
            Submission.auto_test_passed.is_(True),
        )
        .order_by(Submission.submitted_at.asc(), Submission.id.asc())
        .first()
    )
    return winner_submission.user_id if winner_submission is not None else None


def resolve_match_winner_user_id(db: Session, match: Match, r: redis.Redis | None = None) -> int | None:
    winner_user_id = resolve_match_winner_from_submissions(db, match.id)
    if winner_user_id is not None:
        return winner_user_id

    if r is None:
        return None

    round_results = get_match_round_results(r, match.id)
    return resolve_match_winner_from_round_results(match, round_results)


def complete_match_as_draw(db: Session, match: Match, *, reason: str) -> dict[str, object] | None:
    if match.status not in (MatchStatus.active, MatchStatus.pending):
        return None

    participants = list(match.participants)
    users = db.query(User).filter(User.id.in_([participant.user_id for participant in participants])).all()
    users_by_id = {user.id: user for user in users}

    for participant in participants:
        participant.placement = 1
        participant.pts_awarded = 0
        user_row = users_by_id.get(participant.user_id)
        if user_row is not None:
            user_row.pvp_win_streak = 0

    match.status = MatchStatus.completed
    db.commit()
    return {
        "match_id": match.id,
        "status": "completed",
        "reason": reason,
        "winner_user_id": None,
        "loser_user_id": None,
        "winner_pts_delta": 0,
        "loser_pts_delta": 0,
        "winner_streak": 0,
        "winner_streak_bonus": 0,
    }


def finalize_match_if_ready(db: Session, match: Match, r: redis.Redis | None = None) -> dict[str, object] | None:
    if match.status not in (MatchStatus.active, MatchStatus.pending):
        return None
    if not match.ends_at:
        return None

    now = datetime.now(timezone.utc)
    if now < match.ends_at:
        return None

    winner_user_id = resolve_match_winner_user_id(db, match, r)
    if winner_user_id is not None:
        result = complete_match_with_winner(db, match, winner_user_id)
        if result is None:
            return None
        return {
            "match_id": match.id,
            "status": "completed",
            "reason": "timeout",
            **result,
        }

    return complete_match_as_draw(db, match, reason="timeout_draw")


def complete_match_with_winner(db: Session, match: Match, winner_user_id: int) -> dict[str, int] | None:
    if match.status not in (MatchStatus.active, MatchStatus.pending):
        return None

    participants = list(match.participants)
    user_ids = [p.user_id for p in participants]
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    users_by_id = {u.id: u for u in users}

    winner_found = False
    winner_pts_delta = 0
    winner_streak = 0
    winner_streak_bonus = 0
    loser_user_id = 0
    loser_pts_delta = -10
    for participant in participants:
        if participant.user_id == winner_user_id:
            winner_user = users_by_id.get(participant.user_id)
            if winner_user is not None:
                winner_user.pvp_win_streak = int(winner_user.pvp_win_streak or 0) + 1
                winner_user.pvp_best_win_streak = max(
                    int(winner_user.pvp_best_win_streak or 0),
                    int(winner_user.pvp_win_streak or 0),
                )
                winner_streak = int(winner_user.pvp_win_streak or 0)
                winner_streak_bonus = _streak_bonus_for_win(winner_streak)
                winner_pts_delta = pts_for_match_win(winner_streak)
                winner_user.pts = apply_pts_delta(winner_user.pts, winner_pts_delta)
                winner_user.level = level_from_pts(winner_user.pts)
                add_rating_history(
                    db,
                    user_id=winner_user.id,
                    pts_delta=winner_pts_delta,
                    reason="match_result",
                    match_id=match.id,
                    task=match.task,
                )
            participant.placement = 1
            participant.pts_awarded = winner_pts_delta
            winner_found = True
        else:
            participant.placement = 2
            loser_user = users_by_id.get(participant.user_id)
            if loser_user is not None:
                loser_pts_delta = pts_for_match_loss(loser_user.pts)
                loser_user.pts = apply_pts_delta(loser_user.pts, loser_pts_delta)
                loser_user.level = level_from_pts(loser_user.pts)
                loser_user.pvp_win_streak = 0
                add_rating_history(
                    db,
                    user_id=loser_user.id,
                    pts_delta=loser_pts_delta,
                    reason="match_result",
                    match_id=match.id,
                    task=match.task,
                )
            participant.pts_awarded = loser_pts_delta
            loser_user_id = participant.user_id
    if not winner_found:
        return None

    match.status = MatchStatus.completed
    db.commit()
    return {
        "winner_user_id": winner_user_id,
        "loser_user_id": loser_user_id,
        "winner_pts_delta": winner_pts_delta,
        "loser_pts_delta": loser_pts_delta,
        "winner_streak": winner_streak,
        "winner_streak_bonus": winner_streak_bonus,
    }
