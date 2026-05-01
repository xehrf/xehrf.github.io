from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.service import get_user_from_access_token
from app.db.models import User
from app.db.session import get_db
from app.team_matchmaking import service as tm_service
from app.team_matchmaking.schemas import (
    TeamCreateBody,
    TeamCurrentResponse,
    TeamDetailOut,
    TeamHistoryItemOut,
    TeamInviteCreateBody,
    TeamInviteOut,
    TeamMatchmakingJoinResponse,
    TeamMemberOut,
    TeamOut,
    TeamReadyVoteBody,
    TeamStatsOut,
    TeamUpdateBody,
)
from app.team_matchmaking.ws import manager

router = APIRouter(prefix="/team-matchmaking", tags=["team-matchmaking"])
team_router = APIRouter(prefix="/teams", tags=["teams"])

logger = logging.getLogger(__name__)


def _team_member_payload(member, *, online: bool) -> TeamMemberOut:
    return TeamMemberOut(
        user_id=member.user_id,
        display_name=member.user.display_name or member.user.nickname,
        nickname=member.user.nickname,
        avatar_url=member.user.avatar_url,
        pts=member.user.pts,
        role=member.role.value,
        online=online,
    )


def _team_payload(team) -> TeamOut:
    return TeamOut(
        team_id=team.id,
        name=team.name,
        description=team.description or "",
        avatar_url=team.avatar_url,
        banner_url=team.banner_url,
        created_at=team.created_at,
        captain_user_id=tm_service.get_team_captain_user_id(team),
        member_count=len(team.members),
        team_rating=(sum(member.user.pts for member in team.members) // len(team.members)) if team.members else 0,
    )


@router.post("/join", response_model=TeamMatchmakingJoinResponse)
async def join_team(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> TeamMatchmakingJoinResponse:
    active_team = tm_service.get_current_team(db, user.id)
    if active_team is not None:
        return TeamMatchmakingJoinResponse(
            status="already_in_team",
            team_id=active_team.id,
            task_id=active_team.tasks[0].task_id if active_team.tasks else None,
            message="You are already in a team.",
        )

    result = tm_service.join_queue(db, user)
    db.commit()

    if result.get("status") == "matched":
        await manager.broadcast(
            result["team_id"],
            "team_formed",
            {
                "team_id": result["team_id"],
                "task_id": result["task_id"],
                "message": "Team formed.",
            },
        )
        await manager.broadcast(
            result["team_id"],
            "task_assigned",
            {
                "team_id": result["team_id"],
                "task_id": result["task_id"],
                "status": "active",
                "assigned_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    response_data = {
        "status": result.get("status", "unknown"),
        "team_id": result.get("team_id"),
        "task_id": result.get("task_id"),
        "members_found": result.get("members_found"),
        "message": result.get("message", ""),
    }

    logger.debug("Team matchmaking join result for user_id=%s: %s", user.id, response_data)
    return TeamMatchmakingJoinResponse(**response_data)


@router.post("/leave")
async def leave_team(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if tm_service.leave_queue(db, user.id):
        db.commit()
        return {"status": "left_queue"}

    team_id = tm_service.leave_team(db, user.id)
    if team_id is not None:
        db.commit()
        await manager.broadcast(
            team_id,
            "user_left",
            {
                "user_id": user.id,
                "display_name": user.display_name,
                "nickname": user.nickname,
            },
        )
        return {"status": "left_team", "team_id": team_id}

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not in queue or team.")


@team_router.get("/current", response_model=TeamCurrentResponse | None)
def current_team(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> TeamCurrentResponse | None:
    team = tm_service.get_current_team(db, user.id)
    if team is None:
        return None

    online_members = manager.get_online_members(team.id)
    member_rows = []
    for member in team.members:
        member_rows.append(_team_member_payload(member, online=member.user.id in online_members))

    active_task = next((task for task in team.tasks if task.status == "active"), None)
    task_payload = None
    if active_task is not None:
        task_payload = {
            "task_id": active_task.task_id,
            "status": active_task.status.value,
            "assigned_at": active_task.assigned_at,
        }

    return TeamCurrentResponse(
        team_id=team.id,
        name=team.name,
        description=team.description or "",
        avatar_url=team.avatar_url,
        banner_url=team.banner_url,
        created_at=team.created_at,
        task=task_payload,
        members=member_rows,
        captain_user_id=tm_service.get_team_captain_user_id(team),
        ready_votes=tm_service.get_team_ready_votes(db, team.id),
    )


@team_router.get("", response_model=list[TeamOut])
def list_teams(search: str | None = None, db: Session = Depends(get_db)) -> list[TeamOut]:
    teams = tm_service.list_teams(db, search)
    return [_team_payload(team) for team in teams]


@team_router.post("", response_model=TeamOut)
def create_team(body: TeamCreateBody, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> TeamOut:
    team = tm_service.create_team(db, user, body.name, body.description or "")
    db.commit()
    return _team_payload(team)


@team_router.get("/invites", response_model=list[TeamInviteOut])
def my_invites(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[TeamInviteOut]:
    invites = tm_service.list_invitations_for_user(db, user.id)
    return [
        TeamInviteOut(
            invitation_id=inv.id,
            team_id=inv.team_id,
            inviter_user_id=inv.inviter_user_id,
            invitee_user_id=inv.invitee_user_id,
            status=inv.status.value,
            created_at=inv.created_at,
        )
        for inv in invites
    ]


@team_router.post("/invites/{invitation_id}/accept")
async def accept_invite(
    invitation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    invitation = tm_service.get_invitation_by_id(db, invitation_id)
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    team = tm_service.accept_invitation(db, invitation, user.id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to accept invitation")
    db.commit()
    await manager.broadcast(
        team.id,
        "invitation_accepted",
        {"user_id": user.id, "invitation_id": invitation_id},
    )
    return {"status": "accepted", "team_id": team.id}


@team_router.post("/invites/{invitation_id}/decline")
async def decline_invite(
    invitation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    invitation = tm_service.get_invitation_by_id(db, invitation_id)
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    ok = tm_service.decline_invitation(db, invitation, user.id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    db.commit()
    return {"status": "declined"}


@team_router.get("/{team_id}", response_model=TeamDetailOut)
def get_team(team_id: int, db: Session = Depends(get_db)) -> TeamDetailOut:
    team = tm_service.get_team_by_id(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return TeamDetailOut(
        team_id=team.id,
        name=team.name,
        description=team.description or "",
        avatar_url=team.avatar_url,
        banner_url=team.banner_url,
        created_at=team.created_at,
        owner_id=team.owner_id,
        captain_user_id=tm_service.get_team_captain_user_id(team),
        member_count=len(team.members),
        team_rating=(sum(member.user.pts for member in team.members) // len(team.members)) if team.members else 0,
        members=[_team_member_payload(member, online=False) for member in team.members],
    )


@team_router.get("/{team_id}/members", response_model=list[TeamMemberOut])
def get_team_members(team_id: int, db: Session = Depends(get_db)) -> list[TeamMemberOut]:
    members = tm_service.get_team_members(db, team_id)
    if members is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return [_team_member_payload(member, online=False) for member in members]


@team_router.patch("/{team_id}", response_model=TeamOut)
def update_team(
    team_id: int,
    body: TeamUpdateBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TeamOut:
    team = tm_service.get_team_by_id(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if not tm_service.is_captain(team, user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only captain can update team")
    team = tm_service.update_team(db, team, body.name, body.description)
    db.commit()
    return _team_payload(team)


@team_router.post("/{team_id}/avatar", response_model=TeamOut)
def upload_team_avatar(
    team_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TeamOut:
    team = tm_service.get_team_by_id(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if not tm_service.is_captain(team, user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only captain can update team")
    team = tm_service.update_team(db, team, avatar=file)
    db.commit()
    return _team_payload(team)


@team_router.post("/{team_id}/banner", response_model=TeamOut)
def upload_team_banner(
    team_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TeamOut:
    team = tm_service.get_team_by_id(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if not tm_service.is_captain(team, user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only captain can update team")
    team = tm_service.update_team(db, team, banner=file)
    db.commit()
    return _team_payload(team)


@team_router.delete("/{team_id}")
def delete_team(team_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    team = tm_service.get_team_by_id(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if not tm_service.is_captain(team, user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only captain can delete team")
    tm_service.delete_team(db, team)
    db.commit()
    return {"status": "deleted"}


@team_router.post("/{team_id}/leave")
def leave_team(team_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    team = tm_service.get_team_by_id(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if tm_service.get_current_team(db, user.id) is None or not any(m.user_id == user.id for m in team.members):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this team")
    tm_service.leave_team(db, user.id)
    db.commit()
    return {"status": "left"}


@team_router.post("/{team_id}/kick/{user_id}")
def kick_member(team_id: int, user_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    team = tm_service.get_team_by_id(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if not tm_service.is_captain(team, user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only captain can kick members")
    if user.id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot kick yourself")
    if not tm_service.kick_team_member(db, team, user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to kick member")
    db.commit()
    return {"status": "kicked", "user_id": user_id}


@team_router.get("/{team_id}/stats", response_model=TeamStatsOut)
def team_stats(team_id: int, db: Session = Depends(get_db)) -> TeamStatsOut:
    stats = tm_service.get_team_stats(db, team_id)
    return TeamStatsOut(**stats)


@team_router.get("/{team_id}/matches", response_model=list[TeamHistoryItemOut])
def team_matches(team_id: int, db: Session = Depends(get_db)) -> list[TeamHistoryItemOut]:
    rows = tm_service.get_team_match_history(db, team_id)
    return [
        TeamHistoryItemOut(
            id=row.id,
            result=row.result.value,
            rating_delta=row.rating_delta,
            created_at=row.created_at,
            match_id=row.match_id,
        )
        for row in rows
    ]


@team_router.post("/{team_id}/invite", response_model=TeamInviteOut)
async def create_invite(
    team_id: int,
    body: TeamInviteCreateBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TeamInviteOut:
    team = tm_service.get_team_by_id(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if not tm_service.is_captain(team, user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only captain can invite")
    try:
        inv = tm_service.create_invitation(db, team, user.id, body.invitee_user_id)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))
    db.commit()
    await manager.broadcast(
        team_id,
        "team_invite_created",
        {
            "invitation_id": inv.id,
            "invitee_user_id": inv.invitee_user_id,
            "inviter_user_id": inv.inviter_user_id,
        },
    )
    return TeamInviteOut(
        invitation_id=inv.id,
        team_id=inv.team_id,
        inviter_user_id=inv.inviter_user_id,
        invitee_user_id=inv.invitee_user_id,
        status=inv.status.value,
        created_at=inv.created_at,
    )


@team_router.post("/{team_id}/ready")
async def ready_vote(
    team_id: int,
    body: TeamReadyVoteBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    team = tm_service.get_team_by_id(db, team_id)
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    if not any(member.user_id == user.id for member in team.members):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a team member")
    votes = tm_service.set_ready_vote(db, team_id, user.id, body.is_ready)
    db.commit()
    await manager.broadcast(team_id, "team_ready_update", {"team_id": team_id, "votes": votes})
    return {"status": "ok", "votes": votes}


@team_router.websocket("/ws/{team_id}")
async def team_socket(
    team_id: int,
    websocket: WebSocket,
    db: Session = Depends(get_db),
) -> None:
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    user = get_user_from_access_token(db, token)
    if user is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    team = tm_service.get_current_team(db, user.id)
    if team is None or team.id != team_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    await manager.connect(team_id, user.id, websocket)
    await manager.broadcast(
        team_id,
        "user_joined_team",
        {
            "user_id": user.id,
            "display_name": user.display_name,
            "nickname": user.nickname,
        },
    )

    try:
        while True:
            payload = await websocket.receive_json()
            event = payload.get("event")
            if event == "chat_message":
                message = str(payload.get("message", "")).strip()
                if not message:
                    continue
                await manager.broadcast(
                    team_id,
                    "chat_message",
                    {
                        "user_id": user.id,
                        "display_name": user.display_name,
                        "nickname": user.nickname,
                        "message": message,
                        "sent_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
            if event == "ready_vote":
                is_ready = bool(payload.get("is_ready", False))
                votes = tm_service.set_ready_vote(db, team_id, user.id, is_ready)
                db.commit()
                await manager.broadcast(team_id, "team_ready_update", {"team_id": team_id, "votes": votes})
    except WebSocketDisconnect:
        manager.disconnect(team_id, websocket)
        await manager.broadcast(
            team_id,
            "user_left",
            {
                "user_id": user.id,
                "display_name": user.display_name,
                "nickname": user.nickname,
            },
        )
