from datetime import datetime

from pydantic import BaseModel, Field


class TeamMemberOut(BaseModel):
    user_id: int
    display_name: str
    nickname: str
    pts: int
    role: str
    online: bool


class TeamTaskOut(BaseModel):
    task_id: int
    status: str
    assigned_at: datetime


class TeamCurrentResponse(BaseModel):
    team_id: int
    created_at: datetime
    task: TeamTaskOut | None
    members: list[TeamMemberOut]
    captain_user_id: int
    ready_votes: dict[int, bool] = Field(default_factory=dict)


class TeamMatchmakingJoinResponse(BaseModel):
    status: str
    team_id: int | None = None
    task_id: int | None = None
    queue_size: int | None = None
    members_found: int | None = None
    message: str | None = None


class TeamCreateBody(BaseModel):
    name: str
    description: str | None = None


class TeamUpdateBody(BaseModel):
    name: str | None = None
    description: str | None = None


class TeamOut(BaseModel):
    team_id: int
    name: str
    created_at: datetime
    captain_user_id: int
    member_count: int
    team_rating: int


class TeamDetailOut(TeamOut):
    description: str
    owner_id: int | None
    members: list[TeamMemberOut]


class TeamStatsOut(BaseModel):
    team_id: int
    total_matches: int
    wins: int
    losses: int
    draws: int
    win_rate: float
    total_ptc: int
    average_ptc: float
    rating: int


class TeamHistoryItemOut(BaseModel):
    id: int
    result: str
    rating_delta: int
    created_at: datetime
    match_id: int | None


class TeamInviteCreateBody(BaseModel):
    invitee_user_id: int


class TeamInviteActionBody(BaseModel):
    action: str  # accept | decline | cancel


class TeamInviteOut(BaseModel):
    invitation_id: int
    team_id: int
    inviter_user_id: int
    invitee_user_id: int
    status: str
    created_at: datetime


class TeamReadyVoteBody(BaseModel):
    is_ready: bool
