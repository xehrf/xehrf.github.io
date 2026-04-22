from datetime import datetime

from pydantic import BaseModel, Field


class PlacementItem(BaseModel):
    user_id: int
    placement: int = Field(ge=1, le=16)


class FinalizeMatchBody(BaseModel):
    placements: list[PlacementItem]


class LeaderboardUserOut(BaseModel):
    rank: int
    user_id: int
    display_name: str
    nickname: str
    avatar_url: str | None
    level: str
    pts_total: int
    pts_period: int
    pvp_win_streak: int
    technologies: list[str]


class LeaderboardResponseOut(BaseModel):
    period: str
    season: str | None = None
    category_type: str | None = None
    category: str | None = None
    total: int
    items: list[LeaderboardUserOut]
    me: LeaderboardUserOut | None = None


class RatingHistoryItemOut(BaseModel):
    id: int
    created_at: datetime
    pts_delta: int
    reason: str
    season_code: str | None
    language_key: str | None
    topic_key: str | None
    match_id: int | None
    task_id: int | None
    cumulative_delta: int


class RatingHistoryPointOut(BaseModel):
    date: str
    total_delta: int


class RatingHistoryResponseOut(BaseModel):
    user_id: int
    period: str
    season: str | None = None
    category_type: str | None = None
    category: str | None = None
    current_pts: int
    total_delta: int
    items: list[RatingHistoryItemOut]
    chart: list[RatingHistoryPointOut]


class RatingSeasonOut(BaseModel):
    code: str
    title: str
    starts_at: datetime
    ends_at: datetime
    is_current: bool


class RatingSeasonsResponseOut(BaseModel):
    current: str
    periods: list[str]
    seasons: list[RatingSeasonOut]


class RatingCategoriesResponseOut(BaseModel):
    languages: list[str]
    topics: list[str]


class RatingPositionOut(BaseModel):
    period: str
    season: str | None = None
    category_type: str | None = None
    category: str | None = None
    rank: int
    total: int
    percentile: float
    pts_total: int
    pts_period: int


class RatingCompareUserOut(BaseModel):
    user_id: int
    display_name: str
    pts_total: int
    pts_period: int
    rank: int | None = None
    wins_streak: int


class RatingCompareOut(BaseModel):
    period: str
    season: str | None = None
    category_type: str | None = None
    category: str | None = None
    left: RatingCompareUserOut
    right: RatingCompareUserOut
    pts_total_diff: int
    pts_period_diff: int
