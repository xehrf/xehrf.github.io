from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.limiter import limiter

from app.auth.deps import get_current_user
from app.db.models import Match, MatchParticipant, MatchStatus, Submission, SubmissionStatus, Task, User
from app.db.session import get_db
from app.rating.pts import apply_pts_delta, level_from_pts
from app.rating.service import add_rating_history
from app.submissions import anti_cheat
from app.submissions.evaluator import evaluate_python_function
from app.submissions.schemas import SubmissionCreate, SubmissionOut, SubmissionResultOut

router = APIRouter(prefix="/submissions", tags=["submissions"])


def _reward_points(difficulty: int) -> int:
    return {1: 10, 2: 20, 3: 40, 4: 70, 5: 110}.get(difficulty, 10)


def _penalty_points(difficulty: int) -> int:
    return {1: 2, 2: 5, 3: 10, 4: 15, 5: 20}.get(difficulty, 5)


@router.post("", response_model=SubmissionResultOut)
@limiter.limit("30/minute")
def submit(
    request: Request,
    body: SubmissionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubmissionResultOut:
    match: Match | None = None
    task = db.query(Task).filter(Task.id == body.task_id).first()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if body.match_id is not None:
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
        now = datetime.now(timezone.utc)
        if match.ends_at and now > match.ends_at:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Time is up for this match")

    verdict = evaluate_python_function(body.code, task.tests_json)

    others = (
        db.query(Submission.code)
        .filter(Submission.task_id == body.task_id, Submission.user_id != user.id)
        .order_by(Submission.id.desc())
        .limit(50)
        .all()
    )
    other_codes = [row[0] for row in others]
    sim = anti_cheat.max_similarity_to_others(body.code, other_codes)

    sub = Submission(
        user_id=user.id,
        task_id=body.task_id,
        match_id=body.match_id,
        code=body.code,
        status=SubmissionStatus.accepted if verdict.passed else SubmissionStatus.rejected,
        plagiarism_score=sim,
        auto_test_passed=verdict.passed,
    )

    pts_delta = 0
    if verdict.passed:
        pts_delta = _reward_points(task.difficulty)
    elif task.task_type.value == "match":
        pts_delta = -min(user.pts, _penalty_points(task.difficulty))

    user.pts = apply_pts_delta(user.pts, pts_delta)
    user.level = level_from_pts(user.pts)
    if pts_delta != 0:
        add_rating_history(
            db,
            user_id=user.id,
            pts_delta=pts_delta,
            reason="submission_result",
            match_id=body.match_id,
            task=task,
        )

    db.add(sub)
    db.commit()
    db.refresh(sub)
    db.refresh(user)
    return SubmissionResultOut(
        submission_id=sub.id,
        task_id=sub.task_id,
        match_id=sub.match_id,
        verdict="correct" if verdict.passed else "wrong",
        message=verdict.message,
        passed_tests=verdict.passed_tests,
        total_tests=verdict.total_tests,
        pts_delta=pts_delta,
        updated_pts=user.pts,
    )


@router.get("/me", response_model=list[SubmissionOut])
def my_submissions(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Submission]:
    return db.query(Submission).filter(Submission.user_id == user.id).order_by(Submission.id.desc()).limit(100).all()
