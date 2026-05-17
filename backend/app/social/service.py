from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, desc, or_, select
from sqlalchemy.orm import Session

from app.db.models import (
    DirectMessage,
    Friendship,
    FriendshipStatus,
    Match,
    MatchParticipant,
    MatchStatus,
    RatingHistory,
    Submission,
    SubmissionStatus,
    User,
)


def _find_friendship(db: Session, user_a: int, user_b: int) -> Friendship | None:
    return db.query(Friendship).filter(
        or_(
            and_(Friendship.requester_id == user_a, Friendship.addressee_id == user_b),
            and_(Friendship.requester_id == user_b, Friendship.addressee_id == user_a),
        )
    ).first()


def list_friends(db: Session, me_id: int) -> list[dict]:
    rows = db.query(Friendship).filter(
        Friendship.status == FriendshipStatus.accepted,
        or_(Friendship.requester_id == me_id, Friendship.addressee_id == me_id),
    ).all()
    out = []
    for row in rows:
        other_id = row.addressee_id if row.requester_id == me_id else row.requester_id
        other = db.query(User).filter(User.id == other_id).first()
        if other is None:
            continue
        out.append({
            "id": row.id,
            "status": row.status.value,
            "direction": "friend",
            "created_at": row.created_at,
            "decided_at": row.decided_at,
            "user": other,
        })
    return out


def list_pending(db: Session, me_id: int) -> list[dict]:
    rows = db.query(Friendship).filter(
        Friendship.status == FriendshipStatus.pending,
        or_(Friendship.requester_id == me_id, Friendship.addressee_id == me_id),
    ).all()
    out = []
    for row in rows:
        is_incoming = row.addressee_id == me_id
        other_id = row.requester_id if is_incoming else row.addressee_id
        other = db.query(User).filter(User.id == other_id).first()
        if other is None:
            continue
        out.append({
            "id": row.id,
            "status": row.status.value,
            "direction": "incoming" if is_incoming else "outgoing",
            "created_at": row.created_at,
            "decided_at": row.decided_at,
            "user": other,
        })
    return out


def send_friend_request(db: Session, me_id: int, target_id: int) -> Friendship:
    if me_id == target_id:
        raise HTTPException(status_code=400, detail="Нельзя добавить самого себя")
    target = db.query(User).filter(User.id == target_id, User.is_active == True).first()  # noqa: E712
    if target is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    existing = _find_friendship(db, me_id, target_id)
    if existing is not None:
        if existing.status == FriendshipStatus.accepted:
            raise HTTPException(status_code=400, detail="Уже в друзьях")
        if existing.status == FriendshipStatus.pending:
            # If the other side sent a request and I re-send — auto-accept.
            if existing.addressee_id == me_id:
                existing.status = FriendshipStatus.accepted
                existing.decided_at = datetime.now(timezone.utc)
                db.commit()
                db.refresh(existing)
                return existing
            raise HTTPException(status_code=400, detail="Заявка уже отправлена")
        # declined/blocked — allow re-sending by resetting
        existing.status = FriendshipStatus.pending
        existing.requester_id = me_id
        existing.addressee_id = target_id
        existing.created_at = datetime.now(timezone.utc)
        existing.decided_at = None
        db.commit()
        db.refresh(existing)
        return existing

    row = Friendship(requester_id=me_id, addressee_id=target_id, status=FriendshipStatus.pending)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def respond_friend_request(db: Session, me_id: int, friendship_id: int, accept: bool) -> Friendship:
    row = db.query(Friendship).filter(Friendship.id == friendship_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if row.addressee_id != me_id:
        raise HTTPException(status_code=403, detail="Это не ваша заявка")
    if row.status != FriendshipStatus.pending:
        raise HTTPException(status_code=400, detail="Заявка уже обработана")
    row.status = FriendshipStatus.accepted if accept else FriendshipStatus.declined
    row.decided_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return row


def remove_friend(db: Session, me_id: int, target_id: int) -> None:
    row = _find_friendship(db, me_id, target_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Дружба не найдена")
    db.delete(row)
    db.commit()


def is_friend(db: Session, me_id: int, other_id: int) -> bool:
    row = _find_friendship(db, me_id, other_id)
    return row is not None and row.status == FriendshipStatus.accepted


# ----- DMs -----

def list_dm_conversations(db: Session, me_id: int) -> list[dict]:
    # Get latest message per conversation partner. SQLAlchemy doesn't make this
    # elegant — fetch all and group in Python for simplicity (DM volume is low).
    rows = db.query(DirectMessage).filter(
        or_(DirectMessage.sender_id == me_id, DirectMessage.recipient_id == me_id)
    ).order_by(desc(DirectMessage.created_at)).limit(500).all()

    seen_partners: dict[int, dict] = {}
    for msg in rows:
        partner_id = msg.recipient_id if msg.sender_id == me_id else msg.sender_id
        if partner_id in seen_partners:
            continue
        seen_partners[partner_id] = {
            "partner_id": partner_id,
            "last_message": msg.body,
            "last_at": msg.created_at,
        }

    out = []
    for partner_id, info in seen_partners.items():
        partner = db.query(User).filter(User.id == partner_id).first()
        if partner is None:
            continue
        unread = db.query(DirectMessage).filter(
            DirectMessage.sender_id == partner_id,
            DirectMessage.recipient_id == me_id,
            DirectMessage.read_at.is_(None),
        ).count()
        out.append({
            "user": partner,
            "last_message": info["last_message"],
            "last_at": info["last_at"],
            "unread_count": unread,
        })
    out.sort(key=lambda x: x["last_at"] or datetime.min, reverse=True)
    return out


def list_dm_thread(db: Session, me_id: int, partner_id: int, limit: int = 100) -> list[DirectMessage]:
    rows = db.query(DirectMessage).filter(
        or_(
            and_(DirectMessage.sender_id == me_id, DirectMessage.recipient_id == partner_id),
            and_(DirectMessage.sender_id == partner_id, DirectMessage.recipient_id == me_id),
        )
    ).order_by(desc(DirectMessage.created_at)).limit(limit).all()
    # Return chronological order (oldest first) for UI
    return list(reversed(rows))


def send_dm(db: Session, me_id: int, partner_id: int, body: str) -> DirectMessage:
    body = body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Сообщение не может быть пустым")
    if me_id == partner_id:
        raise HTTPException(status_code=400, detail="Нельзя писать самому себе")
    partner = db.query(User).filter(User.id == partner_id, User.is_active == True).first()  # noqa: E712
    if partner is None:
        raise HTTPException(status_code=404, detail="Получатель не найден")
    msg = DirectMessage(sender_id=me_id, recipient_id=partner_id, body=body)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def mark_thread_read(db: Session, me_id: int, partner_id: int) -> int:
    rows = db.query(DirectMessage).filter(
        DirectMessage.sender_id == partner_id,
        DirectMessage.recipient_id == me_id,
        DirectMessage.read_at.is_(None),
    ).all()
    now = datetime.now(timezone.utc)
    for row in rows:
        row.read_at = now
    db.commit()
    return len(rows)


# ----- Activity feed -----

def build_activity_feed(db: Session, me_id: int, limit: int = 30) -> list[dict]:
    """Aggregate activity feed from existing event sources.

    Includes events from the user and their friends; falls back to global top
    events when the user has no friends.
    """
    friend_ids = []
    friend_rows = db.query(Friendship).filter(
        Friendship.status == FriendshipStatus.accepted,
        or_(Friendship.requester_id == me_id, Friendship.addressee_id == me_id),
    ).all()
    for row in friend_rows:
        other_id = row.addressee_id if row.requester_id == me_id else row.requester_id
        friend_ids.append(other_id)

    actor_ids = list({me_id, *friend_ids})

    events: list[dict] = []

    # Rating history events (PTS gains/losses)
    rating_events = db.query(RatingHistory).filter(
        RatingHistory.user_id.in_(actor_ids),
        RatingHistory.pts_delta != 0,
    ).order_by(desc(RatingHistory.created_at)).limit(limit).all()
    for ev in rating_events:
        user = db.query(User).filter(User.id == ev.user_id).first()
        if user is None:
            continue
        events.append({
            "kind": "rating_change",
            "created_at": ev.created_at,
            "actor": user,
            "payload": {
                "pts_delta": ev.pts_delta,
                "reason": ev.reason,
                "match_id": ev.match_id,
            },
        })

    # Accepted submissions (completed tasks)
    submission_events = db.query(Submission).filter(
        Submission.user_id.in_(actor_ids),
        Submission.status == SubmissionStatus.accepted,
    ).order_by(desc(Submission.submitted_at)).limit(limit).all()
    for sub in submission_events:
        user = db.query(User).filter(User.id == sub.user_id).first()
        if user is None:
            continue
        events.append({
            "kind": "submission_accepted",
            "created_at": sub.submitted_at,
            "actor": user,
            "payload": {
                "task_id": sub.task_id,
                "match_id": sub.match_id,
            },
        })

    # Match wins (placement == 1)
    match_part_events = db.query(MatchParticipant).join(Match, Match.id == MatchParticipant.match_id).filter(
        MatchParticipant.user_id.in_(actor_ids),
        MatchParticipant.placement == 1,
        Match.status == MatchStatus.completed,
    ).order_by(desc(Match.started_at)).limit(limit).all()
    for part in match_part_events:
        user = db.query(User).filter(User.id == part.user_id).first()
        if user is None:
            continue
        events.append({
            "kind": "match_win",
            "created_at": part.match.started_at or part.match.created_at,
            "actor": user,
            "payload": {
                "match_id": part.match_id,
                "pts_awarded": part.pts_awarded,
            },
        })

    events.sort(key=lambda e: e["created_at"] or datetime.min, reverse=True)
    return events[:limit]


def search_users(db: Session, me_id: int, query: str, limit: int = 15) -> list[User]:
    query = (query or "").strip()
    if not query:
        return []
    needle = f"%{query.lower()}%"
    stmt = select(User).where(
        User.id != me_id,
        User.is_active == True,  # noqa: E712
        or_(
            User.nickname.ilike(needle),
            User.display_name.ilike(needle),
        ),
    ).limit(limit)
    return list(db.scalars(stmt).all())
