from app.matchmaking.service import _difficulty_band_for_avg_pts, _streak_bonus_for_win


def test_difficulty_band_for_low_pts() -> None:
    assert _difficulty_band_for_avg_pts(150) == [1, 2]


def test_difficulty_band_for_mid_pts() -> None:
    assert _difficulty_band_for_avg_pts(700) == [3, 4]


def test_difficulty_band_for_high_pts() -> None:
    assert _difficulty_band_for_avg_pts(1300) == [4, 5]


def test_streak_bonus_grows_with_streak() -> None:
    assert _streak_bonus_for_win(1) == 0
    assert _streak_bonus_for_win(2) == 5
    assert _streak_bonus_for_win(7) == 30
