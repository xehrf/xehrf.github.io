from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.core.config import get_settings
from app.db.models import (
    Match,
    MatchParticipant,
    MatchStatus,
    RatingHistory,
    User,
)
from app.db.session import get_db
from app.rating.elo import compute_elo_delta, level_from_elo, pts_for_placement
from app.rating.schemas import FinalizeMatchBody

router = APIRouter(prefix="/rating", tags=["rating"])


@router.post("/matches/{match_id}/finalize")
def finalize_match(
    match_id: int,
    body: FinalizeMatchBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    settings = get_settings()
    match = db.query(Match).filter(Match.id == match_id).first()
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    if match.status == MatchStatus.completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already finalized")

    parts = db.query(MatchParticipant).filter(MatchParticipant.match_id == match_id).all()
    part_by_user = {p.user_id: p for p in parts}
    if len(part_by_user) != settings.matchmaking_party_size:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid participants")
    if user.id not in part_by_user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only participants can finalize")

    incoming = {item.user_id: item.placement for item in body.placements}
    if set(incoming.keys()) != set(part_by_user.keys()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Placements must cover all players")

    placements = list(incoming.values())
    if sorted(placements) != list(range(1, settings.matchmaking_party_size + 1)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Placements must be 1..N unique")

    db_users = db.query(User).filter(User.id.in_(list(part_by_user.keys()))).all()
    by_id = {u.id: u for u in db_users}
    party_size = settings.matchmaking_party_size

    for uid, p in part_by_user.items():
        opp_elos = [by_id[o].elo for o in part_by_user if o != uid]
        u = by_id[uid]
        rank = incoming[uid]
        delta = compute_elo_delta(u.elo, opp_elos, rank, party_size=party_size)
        pts = pts_for_placement(rank, party_size)
        elo_before = u.elo
        u.elo = max(100, u.elo + delta)
        u.pts = u.pts + pts
        u.level = level_from_elo(u.elo)
        p.placement = rank
        p.elo_before = elo_before
        p.elo_after = u.elo
        p.pts_awarded = pts
        db.add(
            RatingHistory(
                user_id=uid,
                match_id=match_id,
                task_id=match.task_id,
                elo_before=elo_before,
                elo_after=u.elo,
                pts_delta=pts,
                reason="match_finalize",
            )
        )

    match.status = MatchStatus.completed
    db.commit()
    return {"status": "ok", "match_id": match_id}
