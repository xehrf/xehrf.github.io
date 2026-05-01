from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=2, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OAuthStartBody(BaseModel):
    mode: str = Field(default="login")
    next: str | None = None


class OAuthStartResponse(BaseModel):
    authorize_url: str


class OAuthProviderStatus(BaseModel):
    configured: bool


class OAuthProvidersResponse(BaseModel):
    google: OAuthProviderStatus
    github: OAuthProviderStatus


class AuthMeResponse(BaseModel):
    id: int
    email: EmailStr
    display_name: str
    avatar_url: str | None
    pts: int
    level: str
    role: str | None
    technologies: list[str]
    onboarding_completed: bool
    pvp_win_streak: int
    pvp_best_win_streak: int
    google_connected: bool
    github_connected: bool
    password_login_enabled: bool
