import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    ARRAY,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from collections.abc import Sequence


class UserLevel(str, enum.Enum):
    beginner = "beginner"
    junior = "junior"
    strong_junior = "strong_junior"
    middle = "middle"


class TaskType(str, enum.Enum):
    match = "match"
    solo = "solo"


class MatchStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class SubmissionStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    auto_checked = "auto_checked"
    manual_review = "manual_review"
    accepted = "accepted"
    rejected = "rejected"


class AttemptStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    failed = "failed"


class FreelancePostStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    completed = "completed"


class ProposalStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"


class ContractStatus(str, enum.Enum):
    active = "active"
    submitted = "submitted"
    completed = "completed"


class ContractEventType(str, enum.Enum):
    contract_started = "contract_started"
    result_submitted = "result_submitted"
    revision_requested = "revision_requested"
    contract_completed = "contract_completed"
    message_sent = "message_sent"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    github_user_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    github_login: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(String(100))
    nickname: Mapped[str] = mapped_column(String(100), nullable=False, server_default="")
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    banner_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    pts: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[UserLevel] = mapped_column(Enum(UserLevel), default=UserLevel.beginner)
    role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    technologies: Mapped[list[str]] = mapped_column(ARRAY(String(100)), nullable=False, server_default="{}")
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    pvp_win_streak: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    pvp_best_win_streak: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    skills: Mapped[list["UserSkill"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="user")
    task_attempts: Mapped[list["TaskAttempt"]] = relationship(back_populates="user")


class UserSkill(Base):
    __tablename__ = "user_skills"
    __table_args__ = (UniqueConstraint("user_id", "skill_name", name="uq_user_skill"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    skill_name: Mapped[str] = mapped_column(String(64))
    proficiency: Mapped[int] = mapped_column(Integer, default=1)  # 1–5

    user: Mapped["User"] = relationship(back_populates="skills")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    task_type: Mapped[TaskType] = mapped_column(Enum(TaskType), index=True)
    difficulty: Mapped[int] = mapped_column(Integer, default=1)
    time_limit_minutes: Mapped[int] = mapped_column(Integer, default=120)
    tests_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    starter_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    created_by: Mapped["User | None"] = relationship(foreign_keys=[created_by_id])
    matches: Mapped[list["Match"]] = relationship(back_populates="task")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="task")
    task_attempts: Mapped[list["TaskAttempt"]] = relationship(back_populates="task")


class TaskAttempt(Base):
    __tablename__ = "task_attempts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[AttemptStatus] = mapped_column(Enum(AttemptStatus), default=AttemptStatus.active, index=True)
    score: Mapped[int] = mapped_column(Integer, default=0)

    user: Mapped["User"] = relationship(back_populates="task_attempts")
    task: Mapped["Task"] = relationship(back_populates="task_attempts")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="task_attempt")


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), index=True)
    status: Mapped[MatchStatus] = mapped_column(Enum(MatchStatus), default=MatchStatus.pending, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=120)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    task: Mapped["Task"] = relationship(back_populates="matches")
    participants: Mapped[list["MatchParticipant"]] = relationship(
        back_populates="match", cascade="all, delete-orphan"
    )
    submissions: Mapped[list["Submission"]] = relationship(back_populates="match")


class MatchParticipant(Base):
    __tablename__ = "match_participants"
    __table_args__ = (UniqueConstraint("match_id", "user_id", name="uq_match_user"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    placement: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pts_awarded: Mapped[int] = mapped_column(Integer, default=0)

    match: Mapped["Match"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship()


class TeamMatchmakingQueue(Base):
    __tablename__ = "team_matchmaking_queue"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    ptc: Mapped[int] = mapped_column(Integer, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship()


class TeamMemberRole(str, enum.Enum):
    captain = "captain"
    member = "member"


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), default="Team")
    description: Mapped[str] = mapped_column(String(256), default="")
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    banner_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    rating: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    members: Mapped[list["TeamMember"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    tasks: Mapped[list["TeamTask"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    owner: Mapped["User | None"] = relationship(foreign_keys=[owner_id])


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_team_user"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[TeamMemberRole] = mapped_column(Enum(TeamMemberRole), default=TeamMemberRole.member, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    team: Mapped["Team"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()


class TeamInvitationStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    cancelled = "cancelled"


class TeamInvitation(Base):
    __tablename__ = "team_invitations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), index=True)
    inviter_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    invitee_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[TeamInvitationStatus] = mapped_column(
        Enum(TeamInvitationStatus), default=TeamInvitationStatus.pending, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    team: Mapped["Team"] = relationship()
    inviter: Mapped["User"] = relationship(foreign_keys=[inviter_user_id])
    invitee: Mapped["User"] = relationship(foreign_keys=[invitee_user_id])


class TeamReadyVote(Base):
    __tablename__ = "team_ready_votes"
    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_team_ready_vote"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    is_ready: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    team: Mapped["Team"] = relationship()
    user: Mapped["User"] = relationship()


class TeamMatchResult(str, enum.Enum):
    win = "win"
    lose = "lose"
    draw = "draw"


class TeamMatchHistory(Base):
    __tablename__ = "team_match_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), index=True)
    match_id: Mapped[int | None] = mapped_column(ForeignKey("matches.id"), nullable=True, index=True)
    result: Mapped[TeamMatchResult] = mapped_column(Enum(TeamMatchResult), index=True)
    rating_delta: Mapped[int] = mapped_column(Integer, default=0)
    ptc_earned: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    team: Mapped["Team"] = relationship()
    match: Mapped["Match | None"] = relationship()


class TeamTaskStatus(str, enum.Enum):
    active = "active"
    completed = "completed"


class TeamTask(Base):
    __tablename__ = "team_tasks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    status: Mapped[TeamTaskStatus] = mapped_column(Enum(TeamTaskStatus), default=TeamTaskStatus.active, index=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    team: Mapped["Team"] = relationship(back_populates="tasks")
    task: Mapped["Task"] = relationship()


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), index=True)
    match_id: Mapped[int | None] = mapped_column(ForeignKey("matches.id"), nullable=True)
    code: Mapped[str] = mapped_column(Text)
    status: Mapped[SubmissionStatus] = mapped_column(
        Enum(SubmissionStatus), default=SubmissionStatus.submitted, index=True
    )
    plagiarism_score: Mapped[float | None] = mapped_column(nullable=True)
    auto_test_passed: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="submissions")
    task: Mapped["Task"] = relationship(back_populates="submissions")
    match: Mapped["Match | None"] = relationship(back_populates="submissions")
    task_attempt_id: Mapped[int | None] = mapped_column(ForeignKey("task_attempts.id"), nullable=True, index=True)
    task_attempt: Mapped["TaskAttempt | None"] = relationship(back_populates="submissions")


class RatingHistory(Base):
    __tablename__ = "rating_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    match_id: Mapped[int | None] = mapped_column(ForeignKey("matches.id"), nullable=True)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    pts_delta: Mapped[int] = mapped_column(Integer, default=0)
    reason: Mapped[str] = mapped_column(String(64))
    season_code: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    language_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    topic_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SoloTaskReview(Base):
    __tablename__ = "solo_task_reviews"
    __table_args__ = (UniqueConstraint("task_id", "author_id", "target_user_id", name="uq_solo_review"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    target_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FreelancePost(Base):
    __tablename__ = "freelance_posts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    tech_stack: Mapped[str] = mapped_column(String(255))
    budget: Mapped[int] = mapped_column(Integer)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[FreelancePostStatus] = mapped_column(
        Enum(FreelancePostStatus), default=FreelancePostStatus.open, index=True
    )
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    client: Mapped["User"] = relationship(foreign_keys=[client_id])
    proposals: Mapped[list["Proposal"]] = relationship(back_populates="post", cascade="all, delete-orphan")
    contracts: Mapped[list["Contract"]] = relationship(back_populates="post", cascade="all, delete-orphan")


class Proposal(Base):
    __tablename__ = "proposals"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("freelance_posts.id", ondelete="CASCADE"), index=True)
    developer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    message: Mapped[str] = mapped_column(Text)
    portfolio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[ProposalStatus] = mapped_column(Enum(ProposalStatus), default=ProposalStatus.pending, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    post: Mapped["FreelancePost"] = relationship(back_populates="proposals")
    developer: Mapped["User"] = relationship(foreign_keys=[developer_id])


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("freelance_posts.id", ondelete="CASCADE"), index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    developer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[ContractStatus] = mapped_column(Enum(ContractStatus), default=ContractStatus.active, index=True)
    result_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    post: Mapped["FreelancePost"] = relationship(back_populates="contracts")
    client: Mapped["User"] = relationship(foreign_keys=[client_id])
    developer: Mapped["User"] = relationship(foreign_keys=[developer_id])
    reviews: Mapped[list["Review"]] = relationship(back_populates="contract", cascade="all, delete-orphan")
    messages: Mapped[list["ContractMessage"]] = relationship(back_populates="contract", cascade="all, delete-orphan")
    events: Mapped[list["ContractEvent"]] = relationship(back_populates="contract", cascade="all, delete-orphan")


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id", ondelete="CASCADE"), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    contract: Mapped["Contract"] = relationship(back_populates="reviews")


class ContractMessage(Base):
    __tablename__ = "contract_messages"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    message: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    contract: Mapped["Contract"] = relationship(back_populates="messages")
    sender: Mapped["User"] = relationship(foreign_keys=[sender_id])


class ContractEvent(Base):
    __tablename__ = "contract_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id", ondelete="CASCADE"), index=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    event_type: Mapped[ContractEventType] = mapped_column(Enum(ContractEventType), index=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    contract: Mapped["Contract"] = relationship(back_populates="events")
    actor: Mapped["User | None"] = relationship(foreign_keys=[actor_id])
