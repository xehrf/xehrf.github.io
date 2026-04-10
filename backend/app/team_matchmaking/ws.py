from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class TeamConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[int, list[WebSocket]] = defaultdict(list)
        self.connection_user: dict[WebSocket, int] = {}

    async def connect(self, team_id: int, user_id: int, websocket: WebSocket) -> None:
        self.active_connections[team_id].append(websocket)
        self.connection_user[websocket] = user_id

    def disconnect(self, team_id: int, websocket: WebSocket) -> None:
        if websocket in self.active_connections[team_id]:
            self.active_connections[team_id].remove(websocket)
        self.connection_user.pop(websocket, None)

    def get_online_members(self, team_id: int) -> set[int]:
        return {self.connection_user[ws] for ws in self.active_connections.get(team_id, []) if ws in self.connection_user}

    async def broadcast(self, team_id: int, event: str, data: Any) -> None:
        connections = list(self.active_connections.get(team_id, []))
        payload = {"event": event, "data": data}
        for websocket in connections:
            try:
                await websocket.send_json(payload)
            except Exception:
                self.disconnect(team_id, websocket)


manager = TeamConnectionManager()
