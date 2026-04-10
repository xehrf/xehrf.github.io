from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.team_matchmaking import service as tm_service
from app.team_matchmaking.schemas import TeamCurrentResponse, TeamMatchmakingJoinResponse
from app.team_matchmaking.ws import manager

router = APIRouter(prefix="/team-matchmaking", tags=["team-matchmaking"])
team_router = APIRouter(prefix="/team", tags=["team"])


@router.post("/join", response_model=TeamMatchmakingJoinResponse)
async def join_team(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> TeamMatchmakingJoinResponse:
    active_team = tm_service.get_current_team(db, user.id)
    if active_team is not None:
        return TeamMatchmakingJoinResponse(
            status="already_in_team",
            team_id=active_team.id,
            task_id=active_team.tasks[0].task_id if active_team.tasks else None,
            message="Вы уже в команде.",
        )

    result = tm_service.join_queue(db, user)
    if result["status"] == "matched":
        await manager.broadcast(
            result["team_id"],
            "team_formed",
            {
                "team_id": result["team_id"],
                "task_id": result["task_id"],
                "message": "Команда собрана!",
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

    return TeamMatchmakingJoinResponse(**result)


@router.post("/leave")
async def leave_team(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if tm_service.leave_queue(db, user.id):
        return {"status": "left_queue"}

    team_id = tm_service.leave_team(db, user.id)
    if team_id is not None:
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
        member_rows.append(
            {
                "user_id": member.user.id,
                "display_name": member.user.display_name,
                "nickname": member.user.nickname,
                "pts": member.user.pts,
                "online": member.user.id in online_members,
            }
        )

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
        created_at=team.created_at,
        task=task_payload,
        members=member_rows,
    )


@team_router.websocket("/ws/{team_id}")
async def team_socket(
    team_id: int,
    websocket: WebSocket,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
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
