from pydantic import BaseModel


class OpponentInfo(BaseModel):
    user_id: int
    display_name: str
    nickname: str
    pts: int
    # Avatar surface used by the frontend mini-profile hover card and the
    # opponent panel inside CodeRaceArena / MatchArena. Optional because
    # users without an uploaded image carry None here.
    avatar_url: str | None = None


class MatchmakingJoinRequest(BaseModel):
    # Optional mode hint. Server normalizes unknown values to the default
    # mode so older clients that don't send anything still work.
    mode: str | None = None


class MatchmakingJoinResponse(BaseModel):
    status: str
    match_id: int | None = None
    task_id: int | None = None
    ends_at: str | None = None
    opponent: OpponentInfo | None = None
    queue_size: int | None = None
    queue_position: int | None = None
    message: str | None = None
    # Echo the mode back so the client knows which matchmaking lane it landed
    # in (useful when the client and server fall out of sync about which mode
    # is the default).
    mode: str | None = None


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


class InterviewCompleteRequest(BaseModel):
    # Solo "interview" mode result submission. Grade picks the reward tier
    # and difficulty band; the actual question selection lives on the
    # frontend because the round is purely client-side (same model as the
    # "practice" mode — no per-round backend persistence).
    grade: str
    correct: int
    total: int


class InterviewCompleteResponse(BaseModel):
    verdict: str  # "offer" | "next_round" | "rejected"
    grade: str
    correct: int
    total: int
    accuracy: float
    reward_pts: int
    already_claimed_today: bool
    updated_pts: int
