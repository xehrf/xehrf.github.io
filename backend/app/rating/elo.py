"""ELO updates for free-for-all placement (4 players). Extend to Glicko-2 later."""

from __future__ import annotations

from app.db.models import UserLevel


def elo_bucket(elo: int, step: int = 50) -> int:
    return max(0, elo // step) * step


def level_from_elo(elo: int) -> UserLevel:
    if elo < 900:
        return UserLevel.beginner
    if elo < 1100:
        return UserLevel.junior
    if elo < 1300:
        return UserLevel.strong_junior
    return UserLevel.middle


def expected_score(player_elo: int, opponent_avg_elo: int) -> float:
    return 1.0 / (1.0 + 10 ** ((opponent_avg_elo - player_elo) / 400.0))


def placement_actual_score(rank: int, party_size: int) -> float:
    if party_size <= 1:
        return 0.5
    return (party_size - rank) / (party_size - 1)


def compute_elo_delta(
    player_elo: int,
    opponents_elos: list[int],
    placement_rank: int,
    *,
    k_factor: int = 32,
    party_size: int = 4,
) -> int:
    if not opponents_elos:
        return 0
    avg_opp = sum(opponents_elos) // len(opponents_elos)
    exp = expected_score(player_elo, avg_opp)
    actual = placement_actual_score(placement_rank, party_size)
    return round(k_factor * (actual - exp))


def pts_for_placement(rank: int, party_size: int, base: int = 25) -> int:
    if rank <= 0 or rank > party_size:
        return 0
    tiers = [base * (party_size - r + 1) // party_size for r in range(1, party_size + 1)]
    return tiers[rank - 1]
