from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.models import (
    AttemptStatus,
    Match,
    MatchParticipant,
    MatchStatus,
    Submission,
    SubmissionStatus,
    Task,
    TaskAttempt,
    TaskType,
    User,
)
from app.db.session import get_db
from app.matchmaking import service as mm_service
from app.submissions import anti_cheat
from app.submissions.evaluator import evaluate_python_function
from app.tasks.schemas import (
    TaskAttemptOut,
    TaskCreate,
    TaskOut,
    TaskSubmitBody,
    TaskSubmitResultOut,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _pts_for_difficulty(difficulty: int) -> int:
    """easy 1–2 → 10, medium 3 → 25, hard 4–5 → 50."""
    if difficulty <= 2:
        return 10
    if difficulty == 3:
        return 25
    return 50


def _attempt_to_out(attempt: TaskAttempt) -> TaskAttemptOut:
    now = _now_utc()
    rem: int | None = None
    if attempt.status == AttemptStatus.active:
        if now <= attempt.deadline:
            rem = max(0, int((attempt.deadline - now).total_seconds()))
        else:
            rem = 0
    return TaskAttemptOut(
        id=attempt.id,
        task_id=attempt.task_id,
        start_time=attempt.start_time,
        deadline=attempt.deadline,
        status=attempt.status.value,
        score=attempt.score,
        seconds_remaining=rem,
    )


def _expire_attempt_if_overdue(db: Session, attempt: TaskAttempt) -> None:
    if attempt.status != AttemptStatus.active:
        return
    if _now_utc() > attempt.deadline:
        attempt.status = AttemptStatus.failed
        attempt.score = 0


@router.post("", response_model=TaskOut)
def create_task(
    body: TaskCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Task:
    task = Task(
        title=body.title,
        description=body.description,
        task_type=body.task_type,
        difficulty=body.difficulty,
        time_limit_minutes=body.time_limit_minutes,
        tests_json=body.tests_json,
        starter_code=body.starter_code,
        created_by_id=user.id,
        is_published=body.is_published,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("", response_model=list[TaskOut])
def list_tasks(
    task_type: TaskType | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[Task]:
    q = db.query(Task).filter(Task.is_published.is_(True))
    if task_type is not None:
        q = q.filter(Task.task_type == task_type)
    # Порядок в списке: от лёгкого к легендарному.
    return q.order_by(Task.difficulty.asc(), Task.id.asc()).limit(200).all()


@router.post("/{task_id}/start", response_model=TaskAttemptOut)
def start_task(
    task_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskAttemptOut:
    task = db.query(Task).filter(Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    already_done = (
        db.query(TaskAttempt)
        .filter(
            TaskAttempt.user_id == user.id,
            TaskAttempt.task_id == task_id,
            TaskAttempt.status == AttemptStatus.completed,
        )
        .first()
    )
    if already_done is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task already completed successfully",
        )

    existing = (
        db.query(TaskAttempt)
        .filter(
            TaskAttempt.user_id == user.id,
            TaskAttempt.task_id == task_id,
            TaskAttempt.status == AttemptStatus.active,
        )
        .first()
    )
    if existing is not None:
        if _now_utc() <= existing.deadline:
            return _attempt_to_out(existing)
        existing.status = AttemptStatus.failed
        existing.score = 0
        db.commit()

    start = _now_utc()
    deadline = start + timedelta(minutes=task.time_limit_minutes)
    attempt = TaskAttempt(
        user_id=user.id,
        task_id=task_id,
        start_time=start,
        deadline=deadline,
        status=AttemptStatus.active,
        score=0,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return _attempt_to_out(attempt)


@router.get("/{task_id}/attempt", response_model=TaskAttemptOut | None)
def get_active_attempt(
    task_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskAttemptOut | None:
    task = db.query(Task).filter(Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    attempt = (
        db.query(TaskAttempt)
        .filter(
            TaskAttempt.user_id == user.id,
            TaskAttempt.task_id == task_id,
            TaskAttempt.status == AttemptStatus.active,
        )
        .first()
    )
    if attempt is None:
        return None
    _expire_attempt_if_overdue(db, attempt)
    if attempt.status != AttemptStatus.active:
        db.commit()
        return None
    return _attempt_to_out(attempt)


@router.post("/{task_id}/submit", response_model=TaskSubmitResultOut)
def submit_task_solution(
    task_id: int,
    body: TaskSubmitBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskSubmitResultOut:
    task = db.query(Task).filter(Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    attempt = (
        db.query(TaskAttempt)
        .filter(
            TaskAttempt.user_id == user.id,
            TaskAttempt.task_id == task_id,
            TaskAttempt.status == AttemptStatus.active,
        )
        .first()
    )
    if attempt is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active attempt. Use POST /tasks/{id}/start first.",
        )

    _expire_attempt_if_overdue(db, attempt)
    if attempt.status != AttemptStatus.active:
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Time is up for this attempt")

    now = _now_utc()
    if now > attempt.deadline:
        attempt.status = AttemptStatus.failed
        attempt.score = 0
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Time is up for this attempt")

    match: Match | None = None
    if task.task_type == TaskType.match:
        if body.match_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="match_id is required for match tasks",
            )
        match = db.query(Match).filter(Match.id == body.match_id).first()
        if match is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
        if match.status not in (MatchStatus.active, MatchStatus.pending):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Match is not active")
        part = (
            db.query(MatchParticipant)
            .filter(
                MatchParticipant.match_id == body.match_id,
                MatchParticipant.user_id == user.id,
            )
            .first()
        )
        if part is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant")
        if match.ends_at and now > match.ends_at:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Time is up for this match")

    verdict = evaluate_python_function(body.code, task.tests_json)

    others = (
        db.query(Submission.code)
        .filter(Submission.task_id == task_id, Submission.user_id != user.id)
        .order_by(Submission.id.desc())
        .limit(50)
        .all()
    )
    other_codes = [row[0] for row in others]
    sim = anti_cheat.max_similarity_to_others(body.code, other_codes)

    sub = Submission(
        user_id=user.id,
        task_id=task_id,
        match_id=body.match_id,
        code=body.code,
        status=SubmissionStatus.accepted if verdict.passed else SubmissionStatus.rejected,
        plagiarism_score=sim,
        auto_test_passed=verdict.passed,
        task_attempt_id=attempt.id,
    )

    pts_delta = 0
    attempt_status = AttemptStatus.failed

    if verdict.passed:
        pts_delta = _pts_for_difficulty(task.difficulty)
        attempt.status = AttemptStatus.completed
        attempt.score = pts_delta
        attempt_status = AttemptStatus.completed
        user.pts = user.pts + pts_delta
    else:
        attempt.status = AttemptStatus.failed
        attempt.score = 0
        attempt_status = AttemptStatus.failed

    db.add(sub)
    db.commit()
    if match is not None and verdict.passed:
        db.refresh(match)
        mm_service.complete_match_with_winner(db, match, user.id)
        db.refresh(user)
    db.refresh(sub)
    db.refresh(attempt)
    db.refresh(user)

    return TaskSubmitResultOut(
        submission_id=sub.id,
        task_id=sub.task_id,
        attempt_id=attempt.id,
        verdict="correct" if verdict.passed else "wrong",
        message=verdict.message,
        passed_tests=verdict.passed_tests,
        total_tests=verdict.total_tests,
        pts_delta=pts_delta,
        updated_pts=user.pts,
        attempt_status=attempt_status.value,
    )


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)) -> Task:
    task = db.query(Task).filter(Task.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task
