from datetime import datetime

from pydantic import BaseModel


class TeamMemberOut(BaseModel):
    user_id: int
    display_name: str
    nickname: str
    pts: int
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


class TeamMatchmakingJoinResponse(BaseModel):
    status: str
    team_id: int | None = None
    task_id: int | None = None
    queue_size: int | None = None
    members_found: int | None = None
    message: str | None = None
