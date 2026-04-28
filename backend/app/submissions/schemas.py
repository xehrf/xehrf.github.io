from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.submissions.limits import validate_code_size


class SubmissionCreate(BaseModel):
    task_id: int
    match_id: int | None = None
    code: str = Field(min_length=1)

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        validate_code_size(value)
        return value


class SubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    match_id: int | None
    task_attempt_id: int | None
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
