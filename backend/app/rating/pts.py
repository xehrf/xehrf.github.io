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


def pts_for_solo_task(difficulty: int) -> int:
    """PTS reward for successful solo task submission."""
    if difficulty <= 2:
        return 10
    if difficulty == 3:
        return 25
    return 50


def pts_for_match_win(streak: int = 1, base_win: int = 30) -> int:
    """PTS reward for PvP win with streak bonus."""
    bonus = max(0, min(30, (streak - 1) * 5))
    return base_win + bonus


def pts_for_match_loss(current_pts: int, base_loss: int = 10) -> int:
    """PTS penalty for PvP loss."""
    return -min(max(0, current_pts), max(0, base_loss))


def apply_pts_delta(current_pts: int, delta: int) -> int:
    """Apply PTS delta with lower bound at zero."""
    return max(0, int(current_pts) + int(delta))
