from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import (
    Task,
    TaskType,
    Team,
    TeamMatchmakingQueue,
    TeamMember,
    TeamTask,
    TeamTaskStatus,
    User,
)

TEAM_SIZE = 3
PTC_STEP = 50
MAX_PTC_DELTA = 300


def get_current_team(db: Session, user_id: int) -> Team | None:
    return (
        db.query(Team)
        .join(TeamMember)
        .join(TeamTask)
        .options(selectinload(Team.members).selectinload(TeamMember.user), selectinload(Team.tasks).selectinload(TeamTask.task))
        .filter(TeamMember.user_id == user_id, TeamTask.status == TeamTaskStatus.active)
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
    db.commit()
    return True


def leave_team(db: Session, user_id: int) -> int | None:
    team = get_current_team(db, user_id)
    if team is None:
        return None
    membership = db.query(TeamMember).filter(TeamMember.team_id == team.id, TeamMember.user_id == user_id).first()
    if membership is None:
        return None
    db.delete(membership)
    db.commit()
    active_members = db.query(TeamMember).filter(TeamMember.team_id == team.id).count()
    if active_members == 0:
        active_task = next((task for task in team.tasks if task.status == TeamTaskStatus.active), None)
        if active_task is not None:
            active_task.status = TeamTaskStatus.completed
            db.add(active_task)
            db.commit()
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
    active_team = get_current_team(db, user.id)
    if active_team is not None:
        return {
            "status": "already_in_team",
            "team_id": active_team.id,
            "task_id": active_team.tasks[0].task_id if active_team.tasks else None,
        }

    queued = get_queue_entry(db, user.id)
    if queued is not None:
        return {
            "status": "already_queued",
            "queue_size": _queue_size(db),
            "members_found": min(_queue_size(db), TEAM_SIZE),
        }

    with db.begin():
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
        task = _select_task_by_ptc(db, average_ptc)
        if task is None:
            return {
                "status": "queued",
                "queue_size": len(queue_items),
                "members_found": len(queue_items),
                "message": "Нет доступных командных заданий.",
            }

        for item in selected:
            db.delete(item)

        team = Team(created_at=datetime.now(timezone.utc))
        db.add(team)
        db.flush()

        for item in selected:
            db.add(TeamMember(team_id=team.id, user_id=item.user_id, joined_at=datetime.now(timezone.utc)))

        db.add(
            TeamTask(
                team_id=team.id,
                task_id=task.id,
                status=TeamTaskStatus.active,
                assigned_at=datetime.now(timezone.utc),
            )
        )
        db.flush()

        return {
            "status": "matched",
            "team_id": team.id,
            "task_id": task.id,
        }


def get_team_queue_status(db: Session) -> dict:
    size = _queue_size(db)
    return {"queue_size": size, "members_found": min(size, TEAM_SIZE)}
