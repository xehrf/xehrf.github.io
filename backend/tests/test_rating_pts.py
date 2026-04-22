from datetime import datetime, timezone

from app.db.models import UserLevel
from app.rating.pts import (
    apply_pts_delta,
    level_from_pts,
    pts_for_match_loss,
    pts_for_match_win,
    pts_for_placement,
    pts_for_solo_task,
)
from app.rating.service import infer_topic_from_text, parse_season_code, season_code_for


def test_level_from_pts_boundaries() -> None:
    assert level_from_pts(0) == UserLevel.beginner
    assert level_from_pts(150) == UserLevel.junior
    assert level_from_pts(350) == UserLevel.strong_junior
    assert level_from_pts(900) == UserLevel.middle


def test_pts_for_solo_task() -> None:
    assert pts_for_solo_task(1) == 10
    assert pts_for_solo_task(3) == 25
    assert pts_for_solo_task(5) == 50


def test_pts_for_match_win_and_loss() -> None:
    assert pts_for_match_win(1) == 30
    assert pts_for_match_win(4) == 45
    assert pts_for_match_loss(8) == -8
    assert pts_for_match_loss(80) == -10


def test_apply_pts_delta_has_zero_floor() -> None:
    assert apply_pts_delta(20, -5) == 15
    assert apply_pts_delta(3, -10) == 0


def test_pts_for_placement_keeps_previous_behavior() -> None:
    assert pts_for_placement(1, 4) == 25
    assert pts_for_placement(2, 4) == 18
    assert pts_for_placement(4, 4) == 6


def test_season_code_helpers() -> None:
    dt = datetime(2026, 4, 22, tzinfo=timezone.utc)
    assert season_code_for(dt) == "2026-04"
    starts, ends = parse_season_code("2026-04")
    assert starts.isoformat() == "2026-04-01T00:00:00+00:00"
    assert ends.isoformat() == "2026-05-01T00:00:00+00:00"


def test_topic_inference() -> None:
    assert infer_topic_from_text("BFS shortest path", "") == "graphs"
    assert infer_topic_from_text("KMP substring", "") == "strings"
