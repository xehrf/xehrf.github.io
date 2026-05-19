from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SkillLevelLiteral = Literal["junior", "middle", "senior", "lead"]
CategoryLiteral = Literal["work_search", "job_offer"]


# ---- Inputs ----------------------------------------------------------------

ALLOWED_DURATION_HOURS = (6, 12, 24, 48, 72, 168)  # 6h … 7d


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=10)
    category: CategoryLiteral
    skill_level: SkillLevelLiteral | None = None
    duration_hours: int = Field(
        default=24,
        description="How long the announcement stays live (6, 12, 24, 48, 72, or 168).",
    )
    contact_handle: str | None = Field(default=None, max_length=255)
    contact_link: str | None = Field(default=None, max_length=500)
    contact_phone: str | None = Field(default=None, max_length=50)
    contact_email: str | None = Field(default=None, max_length=255)
    tags: list[str] = Field(default_factory=list, max_length=20)


class RateAnnouncementBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    user_skill_level: SkillLevelLiteral | None = None


# ---- Outputs ---------------------------------------------------------------


class SkillLevelBucket(BaseModel):
    count: int
    average: float


class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    category: str
    skill_level: str | None
    author_id: int | None = None
    author_display_name: str | None = None
    contact_handle: str | None = None
    contact_link: str | None = None
    contact_phone: str | None = None  # masked in service for non-owner
    contact_email: str | None = None
    tags: list[str] = Field(default_factory=list)
    source_type: str
    telegram_channel: str | None = None
    message_link: str | None = None
    external_id: str | None = None
    external_url: str | None = None
    salary_from: int | None = None
    salary_to: int | None = None
    salary_currency: str | None = None
    employer_name: str | None = None
    area_name: str | None = None
    view_count: int
    click_count: int
    save_count: int
    rating_avg: float
    rating_count: int
    is_saved_by_me: bool = False
    my_rating: int | None = None
    created_at: datetime
    expires_at: datetime
    ttl_seconds: int  # seconds remaining until expires_at (>=0)
    is_expired: bool


class AnnouncementStats(BaseModel):
    announcement_id: int
    view_count: int
    click_count: int
    save_count: int
    rating_avg: float
    rating_count: int
    rating_by_skill_level: dict[str, SkillLevelBucket]
    recommended_skill_level: str | None = None
    recommended_score: int  # 0..100
