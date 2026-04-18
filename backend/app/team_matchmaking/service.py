from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import (
    Task,
    TaskType,
    Team,
    TeamInvitation,
    TeamInvitationStatus,
    TeamMatchHistory,
    TeamMatchResult,
    TeamMatchmakingQueue,
    TeamMember,
    TeamReadyVote,
    TeamTask,
    TeamTaskStatus,
    User,
)

TEAM_SIZE = 3
PTC_STEP = 50
MAX_PTC_DELTA = 300


def get_team_by_id(db: Session, team_id: int) -> Team | None:
    return (
        db.query(Team)
        .options(selectinload(Team.members).selectinload(TeamMember.user), selectinload(Team.tasks).selectinload(TeamTask.task))
        .filter(Team.id == team_id)
        .first()
    )


def get_team_captain_user_id(team: Team) -> int:
    member_ids = sorted([m.user_id for m in team.members])
    return member_ids[0] if member_ids else 0


def get_team_ready_votes(db: Session, team_id: int) -> dict[int, bool]:
    votes = db.query(TeamReadyVote).filter(TeamReadyVote.team_id == team_id).all()
    return {vote.user_id: vote.is_ready for vote in votes}


def set_ready_vote(db: Session, team_id: int, user_id: int, is_ready: bool) -> dict[int, bool]:
    vote = db.query(TeamReadyVote).filter(TeamReadyVote.team_id == team_id, TeamReadyVote.user_id == user_id).first()
    if vote is None:
        vote = TeamReadyVote(team_id=team_id, user_id=user_id, is_ready=is_ready, updated_at=datetime.now(timezone.utc))
        db.add(vote)
    else:
        vote.is_ready = is_ready
        vote.updated_at = datetime.now(timezone.utc)
    db.flush()
    return get_team_ready_votes(db, team_id)


def is_captain(team: Team, user_id: int) -> bool:
    return get_team_captain_user_id(team) == user_id


def _team_rating(team: Team) -> int:
    if not team.members:
        return 0
    return sum(member.user.pts for member in team.members) // len(team.members)


def list_teams(db: Session, query: str | None = None) -> list[Team]:
    q = db.query(Team).options(selectinload(Team.members).selectinload(TeamMember.user))
    if query:
        lowered = query.lower()
        q = q.filter(Team.name.ilike(f"%{lowered}%"))
    return q.order_by(Team.id.desc()).limit(100).all()


def create_team(db: Session, owner: User, name: str) -> Team:
    existing = get_current_team(db, owner.id)
    if existing is not None:
        return existing
    team = Team(created_at=datetime.now(timezone.utc), name=name.strip()[:120] or f"Team {owner.id}")
    db.add(team)
    db.flush()
    db.add(TeamMember(team_id=team.id, user_id=owner.id, joined_at=datetime.now(timezone.utc)))
    db.flush()
    db.refresh(team)
    return get_team_by_id(db, team.id) or team


def update_team_name(db: Session, team: Team, name: str) -> Team:
    team.name = name.strip()[:120] or team.name
    db.add(team)
    db.flush()
    return get_team_by_id(db, team.id) or team


def delete_team(db: Session, team: Team) -> None:
    db.delete(team)
    db.flush()


def create_invitation(db: Session, team: Team, inviter_user_id: int, invitee_user_id: int) -> TeamInvitation:
    inv = TeamInvitation(
        team_id=team.id,
        inviter_user_id=inviter_user_id,
        invitee_user_id=invitee_user_id,
        status=TeamInvitationStatus.pending,
        created_at=datetime.now(timezone.utc),
    )
    db.add(inv)
    db.flush()
    db.refresh(inv)
    return inv


def list_invitations_for_user(db: Session, user_id: int) -> list[TeamInvitation]:
    return (
        db.query(TeamInvitation)
        .filter(TeamInvitation.invitee_user_id == user_id, TeamInvitation.status == TeamInvitationStatus.pending)
        .order_by(TeamInvitation.id.desc())
        .all()
    )


def get_invitation_by_id(db: Session, invitation_id: int) -> TeamInvitation | None:
    return db.query(TeamInvitation).filter(TeamInvitation.id == invitation_id).first()


def accept_invitation(db: Session, invitation: TeamInvitation, user_id: int) -> Team | None:
    if invitation.invitee_user_id != user_id:
        return None
    if invitation.status != TeamInvitationStatus.pending:
        return None
    team = get_team_by_id(db, invitation.team_id)
    if team is None:
        return None
    already_member = any(m.user_id == user_id for m in team.members)
    if not already_member:
        db.add(TeamMember(team_id=team.id, user_id=user_id, joined_at=datetime.now(timezone.utc)))
    invitation.status = TeamInvitationStatus.accepted
    invitation.decided_at = datetime.now(timezone.utc)
    db.flush()
    return get_team_by_id(db, team.id)


def decline_invitation(db: Session, invitation: TeamInvitation, user_id: int) -> bool:
    if invitation.invitee_user_id != user_id:
        return False
    invitation.status = TeamInvitationStatus.declined
    invitation.decided_at = datetime.now(timezone.utc)
    db.flush()
    return True


def cancel_invitation(db: Session, invitation: TeamInvitation, user_id: int) -> bool:
    if invitation.inviter_user_id != user_id:
        return False
    invitation.status = TeamInvitationStatus.cancelled
    invitation.decided_at = datetime.now(timezone.utc)
    db.flush()
    return True


def get_team_stats(db: Session, team_id: int) -> dict:
    rows = db.query(TeamMatchHistory).filter(TeamMatchHistory.team_id == team_id).all()
    wins = sum(1 for row in rows if row.result == TeamMatchResult.win)
    losses = sum(1 for row in rows if row.result == TeamMatchResult.lose)
    draws = sum(1 for row in rows if row.result == TeamMatchResult.draw)
    total = len(rows)
    team = get_team_by_id(db, team_id)
    return {
        "team_id": team_id,
        "total_matches": total,
        "wins": wins,
        "losses": losses,
        "draws": draws,
        "win_rate": (wins / total) if total else 0.0,
        "rating": _team_rating(team) if team else 0,
    }


def get_team_match_history(db: Session, team_id: int) -> list[TeamMatchHistory]:
    return db.query(TeamMatchHistory).filter(TeamMatchHistory.team_id == team_id).order_by(TeamMatchHistory.id.desc()).limit(50).all()


def get_current_team(db: Session, user_id: int) -> Team | None:
    return (
        db.query(Team)
        .join(TeamMember)
        .join(TeamTask, isouter=True)
        .options(selectinload(Team.members).selectinload(TeamMember.user), selectinload(Team.tasks).selectinload(TeamTask.task))
        .filter(TeamMember.user_id == user_id)
        .order_by(Team.id.desc())
        .first()
    )


def get_queue_entry(db: Session, user_id: int) -> TeamMatchmakingQueue | None:
    return db.query(TeamMatchmakingQueue).filter(TeamMatchmakingQueue.user_id == user_id).first()


def leave_queue(db: Session, user_id: int) -> bool:
    entry = get_queue_entry(db, user_id)
    if entry is None:
        return False
    db.delete(entry)
    db.flush()
    return True


def leave_team(db: Session, user_id: int) -> int | None:
    team = get_current_team(db, user_id)
    if team is None:
        return None
    membership = db.query(TeamMember).filter(TeamMember.team_id == team.id, TeamMember.user_id == user_id).first()
    if membership is None:
        return None
    db.delete(membership)
    db.flush()
    active_members = db.query(TeamMember).filter(TeamMember.team_id == team.id).count()
    if active_members == 0:
        active_task = next((task for task in team.tasks if task.status == TeamTaskStatus.active), None)
        if active_task is not None:
            active_task.status = TeamTaskStatus.completed
            db.add(active_task)
            db.flush()
    return team.id


def _select_task_by_ptc(db: Session, average_ptc: int) -> Task | None:
    if average_ptc < 500:
        difficulties = [1, 2]
    elif average_ptc <= 1000:
        difficulties = [3, 4]
    else:
        difficulties = [4, 5]

    task = (
        db.query(Task)
        .filter(Task.task_type == TaskType.match, Task.is_published.is_(True), Task.difficulty.in_(difficulties))
        .order_by(Task.id)
        .first()
    )
    if task is not None:
        return task

    return (
        db.query(Task)
        .filter(Task.task_type == TaskType.match, Task.is_published.is_(True))
        .order_by(Task.id)
        .first()
    )


def _choose_team_members(queue_items: list[TeamMatchmakingQueue], user: User) -> list[TeamMatchmakingQueue]:
    own = next((item for item in queue_items if item.user_id == user.id), None)
    if own is None:
        return []

    for delta in range(PTC_STEP, MAX_PTC_DELTA + PTC_STEP, PTC_STEP):
        candidates = [item for item in queue_items if abs(item.ptc - user.pts) <= delta]
        if len(candidates) >= TEAM_SIZE:
            sorted_candidates = sorted(candidates, key=lambda item: abs(item.ptc - user.pts))
            group = sorted_candidates[:TEAM_SIZE]
            if any(item.user_id == user.id for item in group):
                return group

    sorted_by_distance = sorted(queue_items, key=lambda item: abs(item.ptc - user.pts))
    if len(sorted_by_distance) < TEAM_SIZE:
        return []

    if any(item.user_id == user.id for item in sorted_by_distance[:TEAM_SIZE]):
        return sorted_by_distance[:TEAM_SIZE]

    others = [item for item in sorted_by_distance if item.user_id != user.id]
    if len(others) >= TEAM_SIZE - 1:
        return [own, *others[: TEAM_SIZE - 1]]
    return []


def _queue_size(db: Session) -> int:
    return db.query(TeamMatchmakingQueue).count()


def join_queue(db: Session, user: User) -> dict:
    try:
        active_team = get_current_team(db, user.id)
        if active_team is not None:
            return {
                "status": "already_in_team",
                "team_id": active_team.id,
                "task_id": active_team.tasks[0].task_id if active_team.tasks else None,
            }
    except Exception as e:
        print(f"Error getting current team: {e}")
        return {
            "status": "error",
            "message": "Database error occurred",
        }

    queued = get_queue_entry(db, user.id)
    if queued is not None:
        return {
            "status": "already_queued",
            "queue_size": _queue_size(db),
            "members_found": min(_queue_size(db), TEAM_SIZE),
        }

    queue_items = db.query(TeamMatchmakingQueue).with_for_update().order_by(TeamMatchmakingQueue.ptc).all()
    if get_queue_entry(db, user.id) is None:
        entry = TeamMatchmakingQueue(user_id=user.id, ptc=user.pts)
        db.add(entry)
        db.flush()
        queue_items.append(entry)

    if len(queue_items) < TEAM_SIZE:
        return {
            "status": "queued",
            "queue_size": len(queue_items),
            "members_found": len(queue_items),
        }

    selected = _choose_team_members(queue_items, user)
    if len(selected) < TEAM_SIZE:
        return {
            "status": "queued",
            "queue_size": len(queue_items),
            "members_found": len(queue_items),
        }

    average_ptc = sum(item.ptc for item in selected) // TEAM_SIZE
    try:
        task = _select_task_by_ptc(db, average_ptc)
    except Exception as e:
        # Log error but don't crash
        print(f"Error selecting task: {e}")
        task = None

    if task is None:
        return {
            "status": "queued",
            "queue_size": len(queue_items),
            "members_found": len(queue_items),
            "message": "No available team tasks.",
        }

    for item in selected:
        db.delete(item)

    team = Team(created_at=datetime.now(timezone.utc))
    db.add(team)
    db.flush()

    for item in selected:
        member = TeamMember(team_id=team.id, user_id=item.user_id, joined_at=datetime.now(timezone.utc))
        db.add(member)

    team_task = TeamTask(team_id=team.id, task_id=task.id, status=TeamTaskStatus.active, assigned_at=datetime.now(timezone.utc))
    db.add(team_task)

    for item in selected:
        vote = TeamReadyVote(team_id=team.id, user_id=item.user_id, is_ready=False)
        db.add(vote)

    return {
        "status": "matched",
        "team_id": team.id,
        "task_id": task.id,
    }


def get_team_queue_status(db: Session) -> dict:
    size = _queue_size(db)
    return {"queue_size": size, "members_found": min(size, TEAM_SIZE)}
