from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.models import (
    Match,
    MatchParticipant,
    MatchStatus,
    RatingHistory,
    User,
)
from app.db.session import get_db
from app.rating.pts import level_from_pts, pts_for_placement
from app.rating.schemas import FinalizeMatchBody

router = APIRouter(prefix="/rating", tags=["rating"])


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

    db_users = db.query(User).filter(User.id.in_(list(part_by_user.keys()))).all()
    by_id = {u.id: u for u in db_users}

    # Award PTS based on placement (no ELO changes anymore)
    for uid, p in part_by_user.items():
        u = by_id[uid]
        rank = incoming[uid]
        pts = pts_for_placement(rank, party_size)
        
        # Update user PTS and level
        u.pts = u.pts + pts
        u.level = level_from_pts(u.pts)
        
        # Record placement and PTS
        p.placement = rank
        p.pts_awarded = pts
        
        # Create rating history entry
        db.add(
            RatingHistory(
                user_id=uid,
                match_id=match_id,
                task_id=match.task_id,
                pts_delta=pts,
                reason="match_placement",
            )
        )

    match.status = MatchStatus.completed
    db.commit()
    return {"status": "ok", "match_id": match_id}
