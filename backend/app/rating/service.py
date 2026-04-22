from __future__ import annotations

from datetime import datetime, timedelta, timezone
import re

from sqlalchemy.orm import Session

from app.db.models import RatingHistory, Task


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def season_code_for(ts: datetime | None = None) -> str:
    ref = ts or now_utc()
    return f"{ref.year}-{ref.month:02d}"


def parse_season_code(season_code: str) -> tuple[datetime, datetime]:
    if not re.fullmatch(r"\d{4}-\d{2}", season_code):
        raise ValueError("Season must be in YYYY-MM format")
    year = int(season_code[:4])
    month = int(season_code[5:7])
    if month < 1 or month > 12:
        raise ValueError("Season month must be 01..12")
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    return start, end


def period_bounds(period: str, ref: datetime | None = None) -> tuple[datetime | None, datetime | None]:
    now = ref or now_utc()
    if period == "all_time":
        return None, None
    if period == "daily":
        start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        return start, start + timedelta(days=1)
    if period == "weekly":
        start_day = now - timedelta(days=now.weekday())
        start = datetime(start_day.year, start_day.month, start_day.day, tzinfo=timezone.utc)
        return start, start + timedelta(days=7)
    if period == "monthly":
        start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        if now.month == 12:
            end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end = datetime(now.year, now.month + 1, 1, tzinfo=timezone.utc)
        return start, end
    raise ValueError("Unsupported period")


def infer_topic_from_text(title: str | None, description: str | None = None) -> str:
    haystack = f"{title or ''} {description or ''}".lower()
    checks = [
        ("graphs", ["graph", "bfs", "dfs", "dijkstra", "topological"]),
        ("strings", ["string", "substring", "anagram", "palindrome", "kmp"]),
        ("arrays", ["array", "matrix", "two sum", "sum ", "rotate", "binary search"]),
        ("math", ["math", "factorial", "prime", "gcd", "digits"]),
    ]
    for topic, tokens in checks:
        if any(token in haystack for token in tokens):
            return topic
    return "algorithms"


def infer_topic_from_task(task: Task | None) -> str | None:
    if task is None:
        return None
    return infer_topic_from_text(task.title, task.description)


def infer_language_from_task(task: Task | None) -> str | None:
    # Current evaluator is Python-based, so all solved tasks map to python.
    if task is None:
        return None
    return "python"


def add_rating_history(
    db: Session,
    *,
    user_id: int,
    pts_delta: int,
    reason: str,
    match_id: int | None = None,
    task: Task | None = None,
    task_id: int | None = None,
    language_key: str | None = None,
    topic_key: str | None = None,
    season_code: str | None = None,
) -> RatingHistory:
    row = RatingHistory(
        user_id=user_id,
        match_id=match_id,
        task_id=task_id if task_id is not None else (task.id if task is not None else None),
        pts_delta=pts_delta,
        reason=reason,
        season_code=season_code or season_code_for(),
        language_key=language_key if language_key is not None else infer_language_from_task(task),
        topic_key=topic_key if topic_key is not None else infer_topic_from_task(task),
    )
    db.add(row)
    return row
