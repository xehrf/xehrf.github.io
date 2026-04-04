from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.models import Match, MatchParticipant, MatchStatus, Submission, SubmissionStatus, Task, User
from app.db.session import get_db
from app.submissions import anti_cheat
from app.submissions.evaluator import evaluate_python_function
from app.submissions.schemas import SubmissionCreate, SubmissionOut, SubmissionResultOut

router = APIRouter(prefix="/submissions", tags=["submissions"])


def _reward_points(difficulty: int) -> int:
    return {1: 10, 2: 20, 3: 40, 4: 70, 5: 110}.get(difficulty, 10)


def _penalty_points(difficulty: int) -> int:
    return {1: 2, 2: 5, 3: 10, 4: 15, 5: 20}.get(difficulty, 5)


def _generate_explanation(task: Task, verdict) -> tuple[str | None, str | None, str | None]:
    """Generate detailed educational explanation for wrong answers.
    
    Returns: (explanation, common_mistakes, correct_answer_hint)
    """
    if verdict.passed or not verdict.failed_test_case:
        return None, None, None
    
    test_case = verdict.failed_test_case
    correct_ans = verdict.correct_answer
    user_ans = verdict.user_answer
    
    # Build detailed step-by-step explanation
    explanation = f"""📘 Пошаговое объяснение решения:

Тест #{test_case.get('test_num', '?')}:
• Входные данные (input): {test_case.get('input', '?')}
• Ожидаемый результат: {correct_ans}
• Ваш результат: {user_ans}

Как решить:
1️⃣ Внимательно прочитайте условие задачи
2️⃣ Разберите пример:
   - Что именно нужно сделать с входными данными?
   - Какие преобразования применять?
   - Какой должен быть результат?
3️⃣ Проверьте логику вашего кода:
   - Все ли переменные инициализированы правильно?
   - Правильно ли обрабатываются граничные случаи?
   - Верна ли последовательность операций?
4️⃣ Проверьте типы данных:
   - Возвращаете ли вы правильный тип (int, str, list и т.д.)?
   - Нет ли случайных преобразований типов?
5️⃣ Запустите код ментыально шаг за шагом на примере"""
    
    common_mistakes = """⚠️ Частые ошибки:
• Забыли обработать пустые входные данные (None, пустые списки)
• Неправильный порядок операций
• Используете неинициализированную переменную
• Забыли вернуть результат
• Опечатка в названии переменной или функции
• Неправильная логика сравнения или условия"""
    
    return explanation, common_mistakes, correct_ans


@router.post("", response_model=SubmissionResultOut)
def submit(
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

    user.pts = max(0, user.pts + pts_delta)

    db.add(sub)
    db.commit()
    db.refresh(sub)
    db.refresh(user)
    
    # Generate explanation for failed solutions
    explanation, common_mistakes, correct_answer_hint = None, None, None
    if not verdict.passed:
        explanation, common_mistakes, correct_answer_hint = _generate_explanation(task, verdict)
    
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
        correct_answer=correct_answer_hint,
        explanation=explanation,
        common_mistakes=common_mistakes,
    )


@router.get("/me", response_model=list[SubmissionOut])
def my_submissions(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Submission]:
    return db.query(Submission).filter(Submission.user_id == user.id).order_by(Submission.id.desc()).limit(100).all()
