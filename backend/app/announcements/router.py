from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.announcements.schemas import (
    ALLOWED_DURATION_HOURS,
    AnnouncementCreate,
    AnnouncementOut,
    AnnouncementStats,
    RateAnnouncementBody,
    SkillLevelBucket,
)
from app.auth.deps import get_current_user, get_optional_current_user
from app.db.models import (
    Announcement,
    AnnouncementCategory,
    AnnouncementRating,
    AnnouncementSave,
    AnnouncementSkillLevel,
    AnnouncementSource,
    User,
)

SOURCE_TYPE_FILTERS = {"manual", "telegram", "hh", "community"}
from app.db.session import get_db

router = APIRouter(prefix="/announcements", tags=["announcements"])


SKILL_KEYS: tuple[str, ...] = ("junior", "middle", "senior", "lead")
SKILL_SCORE: dict[str, int] = {"junior": 12, "middle": 38, "senior": 65, "lead": 88}
SCORE_TO_SKILL: tuple[tuple[int, str], ...] = (
    (25, "junior"),
    (50, "middle"),
    (75, "senior"),
    (100, "lead"),
)


def _enum_value(v: object) -> str:
    return v.value if hasattr(v, "value") else str(v)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _mask_phone(phone: str | None) -> str | None:
    """Hide trailing digits so casual viewers can't grab the number."""
    if not phone:
        return phone
    visible = phone[:-4] if len(phone) > 4 else phone[:1]
    return f"{visible}{'*' * max(0, len(phone) - len(visible))}"


def _serialize(
    row: Announcement,
    *,
    is_saved: bool = False,
    my_rating: int | None = None,
    rating_avg: float | None = None,
    rating_count: int | None = None,
    show_full_contacts: bool = False,
) -> AnnouncementOut:
    now = _utcnow()
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    ttl = max(0, int((expires - now).total_seconds()))
    avg = float(rating_avg) if rating_avg is not None else 0.0
    cnt = int(rating_count) if rating_count is not None else 0

    return AnnouncementOut(
        id=row.id,
        title=row.title,
        description=row.description,
        category=_enum_value(row.category),
        skill_level=_enum_value(row.skill_level) if row.skill_level else None,
        author_id=row.author_id,
        author_display_name=row.author.display_name if row.author else None,
        contact_handle=row.contact_handle,
        contact_link=row.contact_link,
        contact_phone=row.contact_phone if show_full_contacts else _mask_phone(row.contact_phone),
        contact_email=row.contact_email,
        tags=list(row.tags or []),
        source_type=_enum_value(row.source_type),
        telegram_channel=row.telegram_channel,
        message_link=row.message_link,
        external_id=row.external_id,
        external_url=row.external_url,
        salary_from=row.salary_from,
        salary_to=row.salary_to,
        salary_currency=row.salary_currency,
        employer_name=row.employer_name,
        area_name=row.area_name,
        view_count=row.view_count,
        click_count=row.click_count,
        save_count=row.save_count,
        rating_avg=round(avg, 2),
        rating_count=cnt,
        is_saved_by_me=is_saved,
        my_rating=my_rating,
        created_at=row.created_at,
        expires_at=expires,
        ttl_seconds=ttl,
        is_expired=ttl <= 0,
    )


def _get_or_404(ann_id: int, db: Session) -> Announcement:
    row = (
        db.query(Announcement)
        .options(selectinload(Announcement.author))
        .filter(Announcement.id == ann_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    return row


def _rating_aggregates(db: Session, ids: list[int]) -> dict[int, tuple[float, int]]:
    if not ids:
        return {}
    rows = (
        db.query(
            AnnouncementRating.announcement_id,
            func.avg(AnnouncementRating.rating).label("avg"),
            func.count(AnnouncementRating.id).label("cnt"),
        )
        .filter(AnnouncementRating.announcement_id.in_(ids))
        .group_by(AnnouncementRating.announcement_id)
        .all()
    )
    return {int(r.announcement_id): (float(r.avg or 0), int(r.cnt or 0)) for r in rows}


def _saves_for_user(db: Session, ids: list[int], user_id: int | None) -> set[int]:
    if not ids or user_id is None:
        return set()
    rows = (
        db.query(AnnouncementSave.announcement_id)
        .filter(
            AnnouncementSave.announcement_id.in_(ids),
            AnnouncementSave.user_id == user_id,
        )
        .all()
    )
    return {int(r[0]) for r in rows}


def _my_ratings(db: Session, ids: list[int], user_id: int | None) -> dict[int, int]:
    if not ids or user_id is None:
        return {}
    rows = (
        db.query(AnnouncementRating.announcement_id, AnnouncementRating.rating)
        .filter(
            AnnouncementRating.announcement_id.in_(ids),
            AnnouncementRating.user_id == user_id,
        )
        .all()
    )
    return {int(r[0]): int(r[1]) for r in rows}


# ---------------------------------------------------------------------------
# List + create
# ---------------------------------------------------------------------------


@router.get("", response_model=list[AnnouncementOut])
def list_announcements(
    q: str | None = Query(default=None),
    category: AnnouncementCategory | None = Query(default=None),
    skill_level: AnnouncementSkillLevel | None = Query(default=None),
    source: str | None = Query(default=None, description="manual|telegram|hh|community"),
    min_rating: float | None = Query(default=None, ge=0, le=5),
    tag: str | None = Query(default=None),
    fresh_hours: int | None = Query(default=None, ge=1, le=168),
    expiring_in_hours: int | None = Query(default=None, ge=1, le=72),
    saved_only: bool = Query(default=False),
    sort: str = Query(default="recent"),  # recent | rating | views | expiring
    limit: int = Query(default=100, ge=1, le=200),
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> list[AnnouncementOut]:
    now = _utcnow()
    query = (
        db.query(Announcement)
        .options(selectinload(Announcement.author))
        .filter(Announcement.expires_at > now)
    )
    if q:
        like = f"%{q.strip()}%"
        query = query.filter((Announcement.title.ilike(like)) | (Announcement.description.ilike(like)))
    if category is not None:
        query = query.filter(Announcement.category == category)
    if skill_level is not None:
        query = query.filter(Announcement.skill_level == skill_level)
    if source and source in SOURCE_TYPE_FILTERS:
        if source == "community":
            # "Community" = anything the users themselves created (manual/telegram).
            query = query.filter(Announcement.source_type != AnnouncementSource.hh)
        else:
            query = query.filter(Announcement.source_type == AnnouncementSource(source))
    if tag:
        query = query.filter(Announcement.tags.any(tag))
    if fresh_hours is not None:
        query = query.filter(Announcement.created_at >= now - timedelta(hours=fresh_hours))
    if expiring_in_hours is not None:
        query = query.filter(Announcement.expires_at <= now + timedelta(hours=expiring_in_hours))
    if saved_only and user is not None:
        query = query.join(
            AnnouncementSave,
            (AnnouncementSave.announcement_id == Announcement.id) & (AnnouncementSave.user_id == user.id),
        )

    rows = query.limit(limit * 2).all()
    if not rows:
        return []

    ids = [r.id for r in rows]
    aggs = _rating_aggregates(db, ids)
    save_ids = _saves_for_user(db, ids, user.id if user else None)
    my_ratings = _my_ratings(db, ids, user.id if user else None)

    serialized: list[AnnouncementOut] = []
    for row in rows:
        avg, cnt = aggs.get(row.id, (0.0, 0))
        if min_rating is not None and avg < min_rating:
            continue
        serialized.append(
            _serialize(
                row,
                is_saved=row.id in save_ids,
                my_rating=my_ratings.get(row.id),
                rating_avg=avg,
                rating_count=cnt,
                show_full_contacts=user is not None and row.author_id == user.id,
            )
        )

    if sort == "rating":
        serialized.sort(key=lambda a: (a.rating_avg, a.rating_count), reverse=True)
    elif sort == "views":
        serialized.sort(key=lambda a: a.view_count, reverse=True)
    elif sort == "expiring":
        serialized.sort(key=lambda a: a.ttl_seconds)
    else:  # recent
        serialized.sort(key=lambda a: a.created_at, reverse=True)

    return serialized[:limit]


@router.post("", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
def create_announcement(
    body: AnnouncementCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnnouncementOut:
    if body.duration_hours not in ALLOWED_DURATION_HOURS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"duration_hours must be one of {ALLOWED_DURATION_HOURS}",
        )
    now = _utcnow()
    row = Announcement(
        title=body.title.strip(),
        description=body.description.strip(),
        category=AnnouncementCategory(body.category),
        skill_level=AnnouncementSkillLevel(body.skill_level) if body.skill_level else None,
        author_id=user.id,
        contact_handle=(body.contact_handle or "").strip() or None,
        contact_link=(body.contact_link or "").strip() or None,
        contact_phone=(body.contact_phone or "").strip() or None,
        contact_email=(body.contact_email or "").strip() or None,
        tags=[t.strip() for t in (body.tags or []) if t and t.strip()],
        source_type=AnnouncementSource.manual,
        expires_at=now + timedelta(hours=body.duration_hours),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    row.author = user
    return _serialize(row, show_full_contacts=True, rating_avg=0.0, rating_count=0)


@router.get("/mine", response_model=list[AnnouncementOut])
def my_announcements(
    include_expired: bool = Query(default=False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AnnouncementOut]:
    query = (
        db.query(Announcement)
        .options(selectinload(Announcement.author))
        .filter(Announcement.author_id == user.id)
    )
    if not include_expired:
        query = query.filter(Announcement.expires_at > _utcnow())
    rows = query.order_by(Announcement.created_at.desc()).all()
    if not rows:
        return []
    ids = [r.id for r in rows]
    aggs = _rating_aggregates(db, ids)
    save_ids = _saves_for_user(db, ids, user.id)
    return [
        _serialize(
            r,
            is_saved=r.id in save_ids,
            rating_avg=aggs.get(r.id, (0.0, 0))[0],
            rating_count=aggs.get(r.id, (0.0, 0))[1],
            show_full_contacts=True,
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Detail + delete
# ---------------------------------------------------------------------------


@router.get("/{ann_id}", response_model=AnnouncementOut)
def get_announcement(
    ann_id: int,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> AnnouncementOut:
    row = _get_or_404(ann_id, db)
    aggs = _rating_aggregates(db, [row.id])
    save_ids = _saves_for_user(db, [row.id], user.id if user else None)
    my_ratings = _my_ratings(db, [row.id], user.id if user else None)
    avg, cnt = aggs.get(row.id, (0.0, 0))
    return _serialize(
        row,
        is_saved=row.id in save_ids,
        my_rating=my_ratings.get(row.id),
        rating_avg=avg,
        rating_count=cnt,
        show_full_contacts=user is not None and row.author_id == user.id,
    )


@router.delete("/{ann_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(
    ann_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    row = _get_or_404(ann_id, db)
    if row.author_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only author can delete")
    db.delete(row)
    db.commit()


# ---------------------------------------------------------------------------
# Engagement: view, click, save, rate
# ---------------------------------------------------------------------------


@router.post("/{ann_id}/view", status_code=status.HTTP_204_NO_CONTENT)
def increment_view(ann_id: int, db: Session = Depends(get_db)) -> None:
    affected = (
        db.query(Announcement)
        .filter(Announcement.id == ann_id)
        .update({Announcement.view_count: Announcement.view_count + 1}, synchronize_session=False)
    )
    if affected == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    db.commit()


@router.post("/{ann_id}/click", status_code=status.HTTP_204_NO_CONTENT)
def increment_click(ann_id: int, db: Session = Depends(get_db)) -> None:
    affected = (
        db.query(Announcement)
        .filter(Announcement.id == ann_id)
        .update({Announcement.click_count: Announcement.click_count + 1}, synchronize_session=False)
    )
    if affected == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found")
    db.commit()


@router.post("/{ann_id}/save")
def toggle_save(
    ann_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    row = _get_or_404(ann_id, db)
    existing = (
        db.query(AnnouncementSave)
        .filter(AnnouncementSave.announcement_id == row.id, AnnouncementSave.user_id == user.id)
        .first()
    )
    if existing is not None:
        db.delete(existing)
        row.save_count = max(0, row.save_count - 1)
        db.commit()
        return {"saved": False, "save_count": row.save_count}

    db.add(AnnouncementSave(announcement_id=row.id, user_id=user.id))
    row.save_count = row.save_count + 1
    db.commit()
    return {"saved": True, "save_count": row.save_count}


@router.post("/{ann_id}/rate", response_model=AnnouncementOut)
def rate_announcement(
    ann_id: int,
    body: RateAnnouncementBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnnouncementOut:
    row = _get_or_404(ann_id, db)
    if row.source_type == AnnouncementSource.hh:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="External (hh.ru) announcements cannot be rated",
        )
    if row.author_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot rate your own announcement")

    skill = AnnouncementSkillLevel(body.user_skill_level) if body.user_skill_level else None
    existing = (
        db.query(AnnouncementRating)
        .filter(AnnouncementRating.announcement_id == row.id, AnnouncementRating.user_id == user.id)
        .first()
    )
    if existing is None:
        db.add(
            AnnouncementRating(
                announcement_id=row.id,
                user_id=user.id,
                rating=body.rating,
                user_skill_level=skill,
            )
        )
    else:
        existing.rating = body.rating
        existing.user_skill_level = skill
    db.commit()

    aggs = _rating_aggregates(db, [row.id])
    avg, cnt = aggs.get(row.id, (0.0, 0))
    save_ids = _saves_for_user(db, [row.id], user.id)
    return _serialize(
        row,
        is_saved=row.id in save_ids,
        my_rating=body.rating,
        rating_avg=avg,
        rating_count=cnt,
        show_full_contacts=row.author_id == user.id,
    )


# ---------------------------------------------------------------------------
# Stats: per-skill-level breakdown + recommended level
# ---------------------------------------------------------------------------


def _score_to_skill(score: int) -> str:
    for ceiling, label in SCORE_TO_SKILL:
        if score < ceiling:
            return label
    return "lead"


@router.get("/{ann_id}/stats", response_model=AnnouncementStats)
def announcement_stats(ann_id: int, db: Session = Depends(get_db)) -> AnnouncementStats:
    row = _get_or_404(ann_id, db)
    buckets_raw = (
        db.query(
            AnnouncementRating.user_skill_level,
            func.count(AnnouncementRating.id).label("cnt"),
            func.avg(AnnouncementRating.rating).label("avg"),
        )
        .filter(AnnouncementRating.announcement_id == row.id)
        .group_by(AnnouncementRating.user_skill_level)
        .all()
    )
    buckets: dict[str, SkillLevelBucket] = {
        k: SkillLevelBucket(count=0, average=0.0) for k in SKILL_KEYS
    }
    total_cnt = 0
    total_sum = 0.0
    for row_b in buckets_raw:
        if row_b.user_skill_level is None:
            continue
        key = _enum_value(row_b.user_skill_level)
        buckets[key] = SkillLevelBucket(count=int(row_b.cnt or 0), average=round(float(row_b.avg or 0.0), 2))
        total_cnt += int(row_b.cnt or 0)
        total_sum += float(row_b.avg or 0.0) * int(row_b.cnt or 0)
    avg_total = round(total_sum / total_cnt, 2) if total_cnt else 0.0

    # Recommended level: start from declared level (if any), nudge by user
    # ratings — buckets with high average pull the score towards their own
    # skill level. With no ratings we just trust the declared level.
    base_skill = _enum_value(row.skill_level) if row.skill_level else None
    score = float(SKILL_SCORE[base_skill]) if base_skill in SKILL_SCORE else 50.0
    weight_total = 1.0
    for key in SKILL_KEYS:
        bucket = buckets[key]
        if bucket.count <= 0:
            continue
        # Higher avg rating from a bucket = signal that the announcement
        # genuinely targets that level.
        weight = bucket.count * (bucket.average / 5.0)
        if weight <= 0:
            continue
        score += SKILL_SCORE[key] * weight
        weight_total += weight
    final_score = max(0, min(100, int(round(score / weight_total))))
    recommended = _score_to_skill(final_score) if (base_skill or total_cnt) else None

    return AnnouncementStats(
        announcement_id=row.id,
        view_count=row.view_count,
        click_count=row.click_count,
        save_count=row.save_count,
        rating_avg=avg_total,
        rating_count=total_cnt,
        rating_by_skill_level=buckets,
        recommended_skill_level=recommended,
        recommended_score=final_score,
    )
