from pydantic import BaseModel


class OpponentInfo(BaseModel):
    user_id: int
    display_name: str
    nickname: str
    pts: int


class MatchmakingJoinResponse(BaseModel):
    status: str
    match_id: int | None = None
    task_id: int | None = None
    ends_at: str | None = None
    opponent: OpponentInfo | None = None
    queue_size: int | None = None
    queue_position: int | None = None
    message: str | None = None


class ActiveMatchResponse(BaseModel):
    match_id: int
    task_id: int
    status: str
    started_at: str | None
    ends_at: str | None
    seconds_remaining: int | None
    opponent: OpponentInfo | None = None


class RematchRequestIn(BaseModel):
    match_id: int
