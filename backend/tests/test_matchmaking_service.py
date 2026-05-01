from types import SimpleNamespace

from app.matchmaking.service import resolve_match_winner_from_round_results


def _match_with_participants(*user_ids: int) -> SimpleNamespace:
    return SimpleNamespace(
        participants=[SimpleNamespace(user_id=user_id) for user_id in user_ids],
    )


def test_resolve_match_winner_from_round_results_returns_leader() -> None:
    match = _match_with_participants(10, 20)
    round_results = [
        {
            "roundIndex": 0,
            "results": [
                {"userId": 10, "correct": True},
                {"userId": 20, "correct": False},
            ],
        },
        {
            "roundIndex": 1,
            "results": [
                {"userId": 10, "correct": True},
                {"userId": 20, "correct": True},
            ],
        },
    ]

    assert resolve_match_winner_from_round_results(match, round_results) == 10


def test_resolve_match_winner_from_round_results_returns_none_for_tie() -> None:
    match = _match_with_participants(10, 20)
    round_results = [
        {
            "roundIndex": 0,
            "results": [
                {"userId": 10, "correct": True},
                {"userId": 20, "correct": False},
            ],
        },
        {
            "roundIndex": 1,
            "results": [
                {"userId": 10, "correct": False},
                {"userId": 20, "correct": True},
            ],
        },
    ]

    assert resolve_match_winner_from_round_results(match, round_results) is None
