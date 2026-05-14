"""Public arena stats endpoint.

Returns aggregate numbers used on HomePage hero, social-proof block, and
MatchmakingPage ArenaStats. All values come from real DB/Redis state — no
fake numbers. Endpoint is intentionally unauthenticated so the landing
page can call it for visitors.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from app.core.limiter import limiter
from app.core.redis_client import get_redis
from app.db.models import Match, MatchParticipant, MatchStatus, User
from app.db.session import get_db
from app.matchmaking.service import QUEUE_KEY
from app.matchmaking.ws import manager as matchmaking_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/stats", tags=["stats"])


# Recent matches window used for "average wait" and "PTS spread" calculations.
RECENT_MATCHES_LIMIT = 50

# How far back to look when computing PTS spread (avoid stale early-season data).
RECENT_MATCH_DAYS = 30


def _today_start_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return datetime(now.year, now.month, now.day, tzinfo=timezone.utc)


def _count_online_users(db: Session) -> int:
    """Best-effort online estimate.

    Combines three signals:
    1. Active WebSocket connections to matchmaking (in-process).
    2. Users currently in the Redis matchmaking queue.
    3. Distinct users currently in pending/active matches (DB).

    De-duplicates by user id where possible. On multi-worker deployments
    WebSocket count is per-process, so this is a lower bound.
    """
    online_ids: set[int] = set()

    try:
        online_ids.update(matchmaking_manager._connections.keys())
    except Exception:
        logger.exception("Failed to read live matchmaking connections")

    try:
        r = get_redis()
        try:
            queue_members = r.zrange(QUEUE_KEY, 0, -1)
            for raw in queue_members or []:
                try:
                    online_ids.add(int(raw))
                except (TypeError, ValueError):
                    continue
        finally:
            r.close()
    except Exception:
        logger.exception("Failed to read matchmaking queue from Redis")

    try:
        active_match_users = (
            db.query(distinct(MatchParticipant.user_id))
            .join(Match, Match.id == MatchParticipant.match_id)
            .filter(Match.status.in_([MatchStatus.pending, MatchStatus.active]))
            .all()
        )
        for (uid,) in active_match_users:
            if uid is not None:
                online_ids.add(int(uid))
    except Exception:
        logger.exception("Failed to read active match participants")

    return len(online_ids)


def _count_matches_today(db: Session) -> int:
    return int(
        db.query(func.count(Match.id))
        .filter(Match.created_at >= _today_start_utc())
        .scalar()
        or 0
    )


def _count_matches_total(db: Session) -> int:
    return int(
        db.query(func.count(Match.id))
        .filter(Match.status == MatchStatus.completed)
        .scalar()
        or 0
    )


def _count_active_users(db: Session) -> int:
    return int(
        db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar() or 0
    )


def _average_wait_seconds(db: Session) -> int | None:
    """Average seconds between match creation and start, over recent matches.

    Uses only matches where started_at is set and is after created_at. Returns
    None if there's not enough data.
    """
    rows = (
        db.query(Match.created_at, Match.started_at)
        .filter(
            Match.status == MatchStatus.completed,
            Match.started_at.is_not(None),
        )
        .order_by(Match.id.desc())
        .limit(RECENT_MATCHES_LIMIT)
        .all()
    )
    deltas: list[float] = []
    for created_at, started_at in rows:
        if created_at is None or started_at is None:
            continue
        diff = (started_at - created_at).total_seconds()
        if 0 <= diff <= 600:  # ignore garbage / very long pre-match delays
            deltas.append(diff)
    if not deltas:
        return None
    return int(round(sum(deltas) / len(deltas)))


def _average_pts_spread(db: Session) -> int | None:
    """Average absolute PTS difference between matched players.

    For each recent 2-player completed match, compute |p1.pts - p2.pts| at
    the time of match (we approximate with current user pts, since we don't
    snapshot pts per participant). Returns None if not enough data.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=RECENT_MATCH_DAYS)
    match_ids = [
        mid
        for (mid,) in (
            db.query(Match.id)
            .filter(Match.status == MatchStatus.completed, Match.created_at >= cutoff)
            .order_by(Match.id.desc())
            .limit(RECENT_MATCHES_LIMIT)
            .all()
        )
    ]
    if not match_ids:
        return None

    # For each match, fetch participant user pts in one query.
    rows = (
        db.query(MatchParticipant.match_id, User.pts)
        .join(User, User.id == MatchParticipant.user_id)
        .filter(MatchParticipant.match_id.in_(match_ids))
        .all()
    )
    pts_by_match: dict[int, list[int]] = {}
    for match_id, pts in rows:
        pts_by_match.setdefault(int(match_id), []).append(int(pts or 0))

    spreads: list[int] = []
    for pts_list in pts_by_match.values():
        if len(pts_list) >= 2:
            spreads.append(max(pts_list) - min(pts_list))

    if not spreads:
        return None
    return int(round(sum(spreads) / len(spreads)))


@router.get("/arena")
@limiter.limit("60/minute")
def get_arena_stats(request: Request, db: Session = Depends(get_db)) -> dict:
    """Public arena statistics for marketing surfaces.

    All numbers are real — derived from DB and Redis. Safe to call from the
    landing page (no auth required). Rate-limited to 60/min per IP so the
    endpoint can't be turned into a cheap DoS against Postgres aggregates.
    """
    try:
        online = _count_online_users(db)
    except Exception:
        logger.exception("Failed to count online users")
        online = 0

    try:
        matches_today = _count_matches_today(db)
    except Exception:
        logger.exception("Failed to count matches today")
        matches_today = 0

    try:
        matches_total = _count_matches_total(db)
    except Exception:
        logger.exception("Failed to count total matches")
        matches_total = 0

    try:
        users_total = _count_active_users(db)
    except Exception:
        logger.exception("Failed to count active users")
        users_total = 0

    try:
        avg_wait = _average_wait_seconds(db)
    except Exception:
        logger.exception("Failed to compute average wait")
        avg_wait = None

    try:
        pts_spread = _average_pts_spread(db)
    except Exception:
        logger.exception("Failed to compute PTS spread")
        pts_spread = None

    return {
        "online": online,
        "matches_today": matches_today,
        "matches_total": matches_total,
        "users_total": users_total,
        "avg_wait_seconds": avg_wait,
        "pts_spread": pts_spread,
    }
