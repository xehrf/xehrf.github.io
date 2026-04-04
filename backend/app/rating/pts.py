"""PTC (Points) system for rating and leveling."""

from __future__ import annotations

from app.db.models import UserLevel


def level_from_pts(pts: int) -> UserLevel:
    """Determine user level based on PTS (points).
    
    Level progression:
    - beginner: 0-99 PTS
    - junior: 100-299 PTS
    - strong_junior: 300-599 PTS
    - middle: 600+ PTS
    """
    if pts < 100:
        return UserLevel.beginner
    if pts < 300:
        return UserLevel.junior
    if pts < 600:
        return UserLevel.strong_junior
    return UserLevel.middle


def pts_for_placement(rank: int, party_size: int, base: int = 25) -> int:
    """Calculate PTS awarded for placement in a match.
    
    Formula: base * (party_size - rank + 1) / party_size
    Example (party_size=4): rank 1 = 25, rank 2 = 19, rank 3 = 12, rank 4 = 6
    """
    if rank <= 0 or rank > party_size:
        return 0
    tiers = [base * (party_size - r + 1) // party_size for r in range(1, party_size + 1)]
    return tiers[rank - 1]
