"""
app/matchmaking/match_ws.py
 
WebSocket endpoint for real-time collaboration inside a match:
  - chat messages
  - shared code editor (last-write-wins)
  - participant presence
"""
 
from collections import defaultdict
from typing import Any
 
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
 
from app.auth.security import decode_token
from app.db.models import Match, MatchParticipant, MatchStatus, User
from app.db.session import get_db
 
match_ws_router = APIRouter(prefix="/matchmaking", tags=["matchmaking"])
 
 
class MatchRoomManager:
    def __init__(self) -> None:
        # match_id -> list of (user_id, websocket)
        self._rooms: dict[int, list[tuple[int, WebSocket]]] = defaultdict(list)
 
    def _room(self, match_id: int) -> list[tuple[int, WebSocket]]:
        return self._rooms[match_id]
 
    async def join(self, match_id: int, user_id: int, ws: WebSocket) -> None:
        self._rooms[match_id].append((user_id, ws))
 
    def leave(self, match_id: int, user_id: int, ws: WebSocket) -> None:
        room = self._rooms.get(match_id, [])
        self._rooms[match_id] = [(uid, w) for uid, w in room if w is not ws]
        if not self._rooms[match_id]:
            self._rooms.pop(match_id, None)
 
    def participants(self, match_id: int) -> list[int]:
        return [uid for uid, _ in self._rooms.get(match_id, [])]
 
    async def broadcast(self, match_id: int, payload: dict[str, Any], exclude_ws: WebSocket | None = None) -> None:
        for uid, ws in list(self._rooms.get(match_id, [])):
            if ws is exclude_ws:
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                self.leave(match_id, uid, ws)
 
    async def send_to(self, match_id: int, user_id: int, payload: dict[str, Any]) -> None:
        for uid, ws in list(self._rooms.get(match_id, [])):
            if uid == user_id:
                try:
                    await ws.send_json(payload)
                except Exception:
                    self.leave(match_id, uid, ws)
 
 
match_room_manager = MatchRoomManager()
 
 
@match_ws_router.websocket("/match/{match_id}/ws")
async def match_room_socket(websocket: WebSocket, match_id: int) -> None:
    # Auth via query token
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
 
    sub = decode_token(token)
    if not sub:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
 
    db = next(get_db())
    try:
        user = db.query(User).filter(User.email == sub, User.is_active.is_(True)).first()
        if user is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
 
        match = db.query(Match).filter(Match.id == match_id).first()
        if match is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
 
        # Verify user is a participant
        is_participant = (
            db.query(MatchParticipant)
            .filter(
                MatchParticipant.match_id == match_id,
                MatchParticipant.user_id == user.id,
            )
            .first()
        )
        if is_participant is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
 
        # Load all participants info
        participants_q = (
            db.query(User)
            .join(MatchParticipant, MatchParticipant.user_id == User.id)
            .filter(MatchParticipant.match_id == match_id)
            .all()
        )
        participants_info = [
            {
                "user_id": p.id,
                "display_name": p.display_name or p.nickname or p.email,
                "nickname": p.nickname or p.email,
                "pts": p.pts or 0,
                "avatar_url": p.avatar_url,
                "level": p.level or "beginner",
            }
            for p in participants_q
        ]
    finally:
        db.close()
 
    await websocket.accept()
    await match_room_manager.join(match_id, user.id, websocket)
 
    # Send initial state to the joining user
    await websocket.send_json({
        "event": "room_state",
        "data": {
            "participants": participants_info,
            "online": match_room_manager.participants(match_id),
        },
    })
 
    # Notify others that user joined
    await match_room_manager.broadcast(
        match_id,
        {
            "event": "user_joined",
            "data": {
                "user_id": user.id,
                "online": match_room_manager.participants(match_id),
            },
        },
        exclude_ws=websocket,
    )
 
    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event")
 
            if event == "chat":
                # Broadcast chat message to everyone including sender
                await match_room_manager.broadcast(
                    match_id,
                    {
                        "event": "chat",
                        "data": {
                            "user_id": user.id,
                            "nickname": user.nickname or user.email,
                            "display_name": user.display_name or user.nickname or user.email,
                            "text": str(data.get("text", ""))[:1000],
                        },
                    },
                )
 
            elif event == "code_update":
                # Broadcast code change to all OTHER participants (not sender)
                await match_room_manager.broadcast(
                    match_id,
                    {
                        "event": "code_update",
                        "data": {
                            "user_id": user.id,
                            "code": data.get("code", ""),
                            "language": data.get("language", "python"),
                        },
                    },
                    exclude_ws=websocket,
                )
 
            elif event == "cursor":
                # Broadcast cursor position
                await match_room_manager.broadcast(
                    match_id,
                    {
                        "event": "cursor",
                        "data": {
                            "user_id": user.id,
                            "line": data.get("line", 0),
                            "col": data.get("col", 0),
                        },
                    },
                    exclude_ws=websocket,
                )
 
    except WebSocketDisconnect:
        match_room_manager.leave(match_id, user.id, websocket)
        await match_room_manager.broadcast(
            match_id,
            {
                "event": "user_left",
                "data": {
                    "user_id": user.id,
                    "online": match_room_manager.participants(match_id),
                },
            },
        )
 