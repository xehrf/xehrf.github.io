from pydantic import BaseModel, ConfigDict, Field


class SubmissionCreate(BaseModel):
    task_id: int
    match_id: int | None = None
    code: str = Field(min_length=1)


class SubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    match_id: int | None
    status: str
    plagiarism_score: float | None
    auto_test_passed: bool | None


class SubmissionResultOut(BaseModel):
    submission_id: int
    task_id: int
    match_id: int | None
    verdict: str
    message: str
    passed_tests: int
    total_tests: int
    pts_delta: int
    updated_pts: int
    # For wrong answers: detailed explanation
    correct_answer: str | None = None
    explanation: str | None = None
    common_mistakes: str | None = None
