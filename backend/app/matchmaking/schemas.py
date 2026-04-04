from pydantic import BaseModel


class MatchmakingJoinResponse(BaseModel):
    status: str
    match_id: int | None = None
    task_id: int | None = None
    ends_at: str | None = None
    message: str | None = None


class ActiveMatchResponse(BaseModel):
    match_id: int
    task_id: int
    status: str
    started_at: str | None
    ends_at: str | None
    seconds_remaining: int | None
