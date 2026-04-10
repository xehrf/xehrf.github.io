from pydantic import BaseModel, ConfigDict, Field


class SkillIn(BaseModel):
    skill_name: str = Field(min_length=1, max_length=64)
    proficiency: int = Field(default=1, ge=1, le=5)


class SkillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    skill_name: str
    proficiency: int


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    display_name: str
    nickname: str
    avatar_url: str | None
    banner_url: str | None
    bio: str | None
    elo: int
    pts: int
    level: str
    skills: list[SkillOut]
