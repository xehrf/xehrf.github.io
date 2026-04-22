from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.models import (
    Match,
    MatchParticipant,
    MatchStatus,
    RatingHistory,
    Task,
    User,
)
from app.db.session import get_db
from app.rating.pts import level_from_pts, pts_for_placement
from app.rating.schemas import (
    FinalizeMatchBody,
    LeaderboardResponseOut,
    LeaderboardUserOut,
    RatingCategoriesResponseOut,
    RatingCompareOut,
    RatingCompareUserOut,
    RatingHistoryItemOut,
    RatingHistoryPointOut,
    RatingHistoryResponseOut,
    RatingPositionOut,
    RatingSeasonOut,
    RatingSeasonsResponseOut,
)
from app.rating.service import add_rating_history, now_utc, parse_season_code, period_bounds, season_code_for
from app.users.service import normalize_technologies

router = APIRouter(prefix="/rating", tags=["rating"])

VALID_PERIODS = {"all_time", "daily", "weekly", "monthly"}
VALID_CATEGORY_TYPES = {"language", "topic"}


def _resolve_window(period: str, season: str | None) -> tuple[datetime | None, datetime | None]:
    if season:
        return parse_season_code(season)
    return period_bounds(period)


def _apply_window(query, column, starts_at: datetime | None, ends_at: datetime | None):
    if starts_at is not None:
        query = query.filter(column >= starts_at)
    if ends_at is not None:
        query = query.filter(column < ends_at)
    return query


def _apply_category(query, *, category_type: str | None, category: str | None):
    if category_type is None:
        return query
    if category_type == "language":
        if category:
            return query.filter(RatingHistory.language_key == category)
        return query.filter(RatingHistory.language_key.is_not(None))
    if category_type == "topic":
        if category:
            return query.filter(RatingHistory.topic_key == category)
        return query.filter(RatingHistory.topic_key.is_not(None))
    return query


def _build_leaderboard_user(
    *,
    rank: int,
    user: User,
    pts_period: int,
) -> LeaderboardUserOut:
    technologies = normalize_technologies(user.technologies)
    return LeaderboardUserOut(
        rank=rank,
        user_id=user.id,
        display_name=user.display_name,
        nickname=user.nickname or user.display_name,
        avatar_url=user.avatar_url,
        level=user.level.value,
        pts_total=int(user.pts or 0),
        pts_period=int(pts_period),
        pvp_win_streak=int(user.pvp_win_streak or 0),
        technologies=technologies,
    )


def _history_base_query(
    db: Session,
    *,
    period: str,
    season: str | None,
    category_type: str | None,
    category: str | None,
):
    starts_at, ends_at = _resolve_window(period, season)
    query = db.query(RatingHistory)
    query = _apply_window(query, RatingHistory.created_at, starts_at, ends_at)
    query = _apply_category(query, category_type=category_type, category=category)
    return query, starts_at, ends_at


@router.post("/matches/{match_id}/finalize")
def finalize_match(
    match_id: int,
    body: FinalizeMatchBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    match = db.query(Match).filter(Match.id == match_id).first()
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    if match.status == MatchStatus.completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already finalized")

    parts = db.query(MatchParticipant).filter(MatchParticipant.match_id == match_id).all()
    part_by_user = {p.user_id: p for p in parts}
    party_size = len(part_by_user)
    if party_size == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No participants in match")
    if user.id not in part_by_user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only participants can finalize")

    incoming = {item.user_id: item.placement for item in body.placements}
    if set(incoming.keys()) != set(part_by_user.keys()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Placements must cover all players")
    placements = list(incoming.values())
    if sorted(placements) != list(range(1, party_size + 1)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Placements must be 1..N unique")

    users = db.query(User).filter(User.id.in_(list(part_by_user.keys()))).all()
    by_id = {u.id: u for u in users}
    task = db.query(Task).filter(Task.id == match.task_id).first()

    for uid, participant in part_by_user.items():
        row = by_id[uid]
        rank = incoming[uid]
        pts = pts_for_placement(rank, party_size)
        row.pts = row.pts + pts
        row.level = level_from_pts(row.pts)
        participant.placement = rank
        participant.pts_awarded = pts
        add_rating_history(
            db,
            user_id=uid,
            pts_delta=pts,
            reason="match_placement",
            match_id=match_id,
            task=task,
        )

    match.status = MatchStatus.completed
    db.commit()
    return {"status": "ok", "match_id": match_id}


@router.get("/leaderboard", response_model=LeaderboardResponseOut)
def get_leaderboard(
    period: str = Query(default="all_time"),
    season: str | None = Query(default=None),
    category_type: str | None = Query(default=None),
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LeaderboardResponseOut:
    period = period.strip().lower()
    if period not in VALID_PERIODS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported period")
    if category_type is not None:
        category_type = category_type.strip().lower()
        if category_type not in VALID_CATEGORY_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported category_type")
    if category is not None:
        category = category.strip().lower() or None

    if season:
        season = season.strip()
        try:
            parse_season_code(season)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    starts_at, ends_at = _resolve_window(period, season)
    search_value = search.strip() if search else None

    # all_time leaderboard without category uses current total PTS
    if period == "all_time" and season is None and category_type is None:
        base = db.query(User).filter(User.is_active.is_(True))
        if search_value:
            base = base.filter(User.display_name.ilike(f"%{search_value}%"))
        total = base.count()
        rows = base.order_by(User.pts.desc(), User.id.asc()).offset(offset).limit(limit).all()
        row_ids = [u.id for u in rows]
        period_delta = {
            uid: int(delta or 0)
            for uid, delta in (
                db.query(RatingHistory.user_id, func.coalesce(func.sum(RatingHistory.pts_delta), 0))
                .filter(RatingHistory.user_id.in_(row_ids))
                .group_by(RatingHistory.user_id)
                .all()
            )
        }
        items = [
            _build_leaderboard_user(rank=offset + idx, user=row, pts_period=period_delta.get(row.id, 0))
            for idx, row in enumerate(rows, start=1)
        ]
        me_period = (
            db.query(func.coalesce(func.sum(RatingHistory.pts_delta), 0))
            .filter(RatingHistory.user_id == user.id)
            .scalar()
        )
        me_rank = (
            db.query(func.count(User.id))
            .filter(User.is_active.is_(True), User.pts > user.pts)
            .scalar()
        )
        me = _build_leaderboard_user(
            rank=int(me_rank or 0) + 1,
            user=user,
            pts_period=int(me_period or 0),
        )
        return LeaderboardResponseOut(
            period=period,
            season=season,
            category_type=category_type,
            category=category,
            total=total,
            items=items,
            me=me,
        )

    # filtered leaderboard: score by history deltas
    history = db.query(
        RatingHistory.user_id.label("user_id"),
        func.coalesce(func.sum(RatingHistory.pts_delta), 0).label("score"),
    ).join(User, User.id == RatingHistory.user_id)
    history = history.filter(User.is_active.is_(True))
    history = _apply_window(history, RatingHistory.created_at, starts_at, ends_at)
    history = _apply_category(history, category_type=category_type, category=category)
    if search_value:
        history = history.filter(User.display_name.ilike(f"%{search_value}%"))
    grouped = history.group_by(RatingHistory.user_id).subquery()

    total = db.query(func.count()).select_from(grouped).scalar() or 0
    rows = (
        db.query(User, grouped.c.score)
        .join(grouped, grouped.c.user_id == User.id)
        .order_by(grouped.c.score.desc(), User.id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    score_rows = (
        db.query(grouped.c.user_id, grouped.c.score)
        .order_by(grouped.c.score.desc(), grouped.c.user_id.asc())
        .all()
    )
    rank_by_user = {int(uid): idx for idx, (uid, _) in enumerate(score_rows, start=1)}
    score_by_user = {int(uid): int(score or 0) for uid, score in score_rows}
    items: list[LeaderboardUserOut] = []
    for idx, (row_user, row_score) in enumerate(rows, start=1):
        items.append(
            _build_leaderboard_user(
                rank=rank_by_user.get(row_user.id, offset + idx),
                user=row_user,
                pts_period=int(row_score or 0),
            )
        )

    my_rank = rank_by_user.get(user.id)
    me = None
    if my_rank is not None:
        me = _build_leaderboard_user(
            rank=my_rank,
            user=user,
            pts_period=score_by_user.get(user.id, 0),
        )

    return LeaderboardResponseOut(
        period=period,
        season=season,
        category_type=category_type,
        category=category,
        total=int(total),
        items=items,
        me=me,
    )


@router.get("/history/me", response_model=RatingHistoryResponseOut)
def get_my_history(
    period: str = Query(default="all_time"),
    season: str | None = Query(default=None),
    category_type: str | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=300, ge=1, le=1000),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RatingHistoryResponseOut:
    return _get_user_history(
        target_user=user,
        period=period,
        season=season,
        category_type=category_type,
        category=category,
        limit=limit,
        db=db,
    )


@router.get("/history/{user_id}", response_model=RatingHistoryResponseOut)
def get_user_history(
    user_id: int,
    period: str = Query(default="all_time"),
    season: str | None = Query(default=None),
    category_type: str | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=300, ge=1, le=1000),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RatingHistoryResponseOut:
    target_user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _get_user_history(
        target_user=target_user,
        period=period,
        season=season,
        category_type=category_type,
        category=category,
        limit=limit,
        db=db,
    )


def _get_user_history(
    *,
    target_user: User,
    period: str,
    season: str | None,
    category_type: str | None,
    category: str | None,
    limit: int,
    db: Session,
) -> RatingHistoryResponseOut:
    period = period.strip().lower()
    if period not in VALID_PERIODS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported period")
    if category_type is not None:
        category_type = category_type.strip().lower()
        if category_type not in VALID_CATEGORY_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported category_type")
    if category is not None:
        category = category.strip().lower() or None
    if season:
        season = season.strip()
        try:
            parse_season_code(season)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    query, _, _ = _history_base_query(
        db,
        period=period,
        season=season,
        category_type=category_type,
        category=category,
    )
    rows = (
        query.filter(RatingHistory.user_id == target_user.id)
        .order_by(RatingHistory.created_at.asc(), RatingHistory.id.asc())
        .limit(limit)
        .all()
    )

    cumulative = 0
    chart_map: dict[str, int] = {}
    items: list[RatingHistoryItemOut] = []
    for row in rows:
        cumulative += int(row.pts_delta or 0)
        date_key = row.created_at.astimezone(timezone.utc).date().isoformat()
        chart_map[date_key] = chart_map.get(date_key, 0) + int(row.pts_delta or 0)
        items.append(
            RatingHistoryItemOut(
                id=row.id,
                created_at=row.created_at,
                pts_delta=int(row.pts_delta or 0),
                reason=row.reason,
                season_code=row.season_code,
                language_key=row.language_key,
                topic_key=row.topic_key,
                match_id=row.match_id,
                task_id=row.task_id,
                cumulative_delta=cumulative,
            )
        )
    chart = [RatingHistoryPointOut(date=key, total_delta=value) for key, value in sorted(chart_map.items())]
    return RatingHistoryResponseOut(
        user_id=target_user.id,
        period=period,
        season=season,
        category_type=category_type,
        category=category,
        current_pts=int(target_user.pts or 0),
        total_delta=cumulative,
        items=items,
        chart=chart,
    )


@router.get("/seasons", response_model=RatingSeasonsResponseOut)
def get_rating_seasons(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RatingSeasonsResponseOut:
    rows = (
        db.query(RatingHistory.season_code)
        .filter(RatingHistory.season_code.is_not(None))
        .group_by(RatingHistory.season_code)
        .order_by(RatingHistory.season_code.desc())
        .all()
    )
    season_codes = [row[0] for row in rows if row[0]]
    current = season_code_for(now_utc())
    if current not in season_codes:
        season_codes.insert(0, current)
    season_codes = season_codes[:24]

    seasons: list[RatingSeasonOut] = []
    for code in season_codes:
        starts_at, ends_at = parse_season_code(code)
        title = starts_at.strftime("%B %Y")
        seasons.append(
            RatingSeasonOut(
                code=code,
                title=title,
                starts_at=starts_at,
                ends_at=ends_at,
                is_current=(code == current),
            )
        )
    return RatingSeasonsResponseOut(
        current=current,
        periods=["all_time", "daily", "weekly", "monthly"],
        seasons=seasons,
    )


@router.get("/categories", response_model=RatingCategoriesResponseOut)
def get_rating_categories(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RatingCategoriesResponseOut:
    language_rows = (
        db.query(RatingHistory.language_key)
        .filter(RatingHistory.language_key.is_not(None))
        .group_by(RatingHistory.language_key)
        .order_by(RatingHistory.language_key.asc())
        .all()
    )
    topic_rows = (
        db.query(RatingHistory.topic_key)
        .filter(RatingHistory.topic_key.is_not(None))
        .group_by(RatingHistory.topic_key)
        .order_by(RatingHistory.topic_key.asc())
        .all()
    )
    languages = [row[0] for row in language_rows if row[0]]
    topics = [row[0] for row in topic_rows if row[0]]
    return RatingCategoriesResponseOut(languages=languages, topics=topics)


@router.get("/position/me", response_model=RatingPositionOut)
def get_my_position(
    period: str = Query(default="all_time"),
    season: str | None = Query(default=None),
    category_type: str | None = Query(default=None),
    category: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RatingPositionOut:
    leaderboard = get_leaderboard(
        period=period,
        season=season,
        category_type=category_type,
        category=category,
        search=None,
        limit=200,
        offset=0,
        user=user,
        db=db,
    )
    me = leaderboard.me
    if me is None:
        return RatingPositionOut(
            period=period,
            season=season,
            category_type=category_type,
            category=category,
            rank=leaderboard.total + 1,
            total=leaderboard.total,
            percentile=0.0,
            pts_total=int(user.pts or 0),
            pts_period=0,
        )
    percentile = 100.0 if leaderboard.total <= 1 else (1 - (me.rank - 1) / leaderboard.total) * 100
    return RatingPositionOut(
        period=period,
        season=season,
        category_type=category_type,
        category=category,
        rank=me.rank,
        total=leaderboard.total,
        percentile=round(max(0.0, percentile), 2),
        pts_total=me.pts_total,
        pts_period=me.pts_period,
    )


@router.get("/compare", response_model=RatingCompareOut)
def compare_with_other(
    other_user_id: int = Query(ge=1),
    period: str = Query(default="all_time"),
    season: str | None = Query(default=None),
    category_type: str | None = Query(default=None),
    category: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RatingCompareOut:
    other = db.query(User).filter(User.id == other_user_id, User.is_active.is_(True)).first()
    if other is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    left_history = _get_user_history(
        target_user=user,
        period=period,
        season=season,
        category_type=category_type,
        category=category,
        limit=1000,
        db=db,
    )
    right_history = _get_user_history(
        target_user=other,
        period=period,
        season=season,
        category_type=category_type,
        category=category,
        limit=1000,
        db=db,
    )

    rank_map = {}
    leaderboard = get_leaderboard(
        period=period,
        season=season,
        category_type=category_type,
        category=category,
        search=None,
        limit=500,
        offset=0,
        user=user,
        db=db,
    )
    for item in leaderboard.items:
        rank_map[item.user_id] = item.rank

    left = RatingCompareUserOut(
        user_id=user.id,
        display_name=user.display_name,
        pts_total=int(user.pts or 0),
        pts_period=int(left_history.total_delta),
        rank=rank_map.get(user.id),
        wins_streak=int(user.pvp_win_streak or 0),
    )
    right = RatingCompareUserOut(
        user_id=other.id,
        display_name=other.display_name,
        pts_total=int(other.pts or 0),
        pts_period=int(right_history.total_delta),
        rank=rank_map.get(other.id),
        wins_streak=int(other.pvp_win_streak or 0),
    )
    return RatingCompareOut(
        period=period,
        season=season,
        category_type=category_type,
        category=category,
        left=left,
        right=right,
        pts_total_diff=left.pts_total - right.pts_total,
        pts_period_diff=left.pts_period - right.pts_period,
    )
