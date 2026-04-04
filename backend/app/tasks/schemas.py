from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import TaskType


class TaskCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10)
    task_type: TaskType
    difficulty: int = Field(default=1, ge=1, le=5)
    time_limit_minutes: int = Field(default=120, ge=10, le=600)
    tests_json: dict | None = None
    starter_code: str | None = None
    is_published: bool = True


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    task_type: TaskType
    difficulty: int
    time_limit_minutes: int
    tests_json: dict | None
    starter_code: str | None
    created_by_id: int | None
    is_published: bool


class TaskAttemptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    start_time: datetime
    deadline: datetime
    status: str
    score: int
    seconds_remaining: int | None = None


class TaskSubmitBody(BaseModel):
    code: str = Field(min_length=1)
    match_id: int | None = None


class TaskSubmitResultOut(BaseModel):
    submission_id: int
    task_id: int
    attempt_id: int
    verdict: str
    message: str
    passed_tests: int
    total_tests: int
    pts_delta: int
    updated_pts: int
    attempt_status: str
