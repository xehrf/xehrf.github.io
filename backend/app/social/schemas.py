from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class FriendUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    nickname: str
    avatar_url: str | None = None
    pts: int = 0
    level: str = "beginner"


class FriendshipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    direction: str  # "incoming" | "outgoing" | "friend"
    created_at: datetime
    decided_at: datetime | None = None
    user: FriendUserOut


class FriendRequestIn(BaseModel):
    user_id: int = Field(gt=0)


class DMConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: FriendUserOut
    last_message: str | None = None
    last_at: datetime | None = None
    unread_count: int = 0


class DMMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sender_id: int
    recipient_id: int
    body: str
    created_at: datetime
    read_at: datetime | None = None


class DMSendIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class ActivityEventOut(BaseModel):
    kind: str  # "match_win" | "match_loss" | "rating_change" | "submission_accepted" | "friend_added"
    created_at: datetime
    actor: FriendUserOut
    payload: dict = {}


class FriendshipStatusOut(BaseModel):
    status: str  # "none" | "self" | "friend" | "pending_outgoing" | "pending_incoming"
    friendship_id: int | None = None
