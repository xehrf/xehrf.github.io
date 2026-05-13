from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    bg_video_url: str | None
    bio: str | None
    pts: int
    level: str
    role: str | None
    technologies: list[str]
    onboarding_completed: bool
    pvp_win_streak: int
    pvp_best_win_streak: int
    skills: list[SkillOut]


class OnboardingIn(BaseModel):
    role: str = Field(min_length=2, max_length=100)
    technologies: list[str] = Field(min_length=1, max_length=20)

    @field_validator("role")
    @classmethod
    def clean_role(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Role is required")
        return cleaned

    @field_validator("technologies", mode="before")
    @classmethod
    def ensure_technologies_list(cls, value: object) -> object:
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        return value

    @field_validator("technologies")
    @classmethod
    def clean_technologies(cls, value: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for item in value:
            tech = item.strip()
            if not tech:
                continue
            if len(tech) > 100:
                raise ValueError("Technology names must be 100 chars or shorter")
            key = tech.lower()
            if key in seen:
                continue
            seen.add(key)
            cleaned.append(tech)
        if not cleaned:
            raise ValueError("Choose at least one technology")
        return cleaned
