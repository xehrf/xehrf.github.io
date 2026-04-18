from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class MatchmakingConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, list[WebSocket]] = defaultdict(list)

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        self._connections[user_id].append(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        conns = self._connections.get(user_id)
        if not conns:
            return
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._connections.pop(user_id, None)

    async def _send_many(self, user_id: int, payload: dict[str, Any]) -> None:
        conns = list(self._connections.get(user_id, []))
        for ws in conns:
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(user_id, ws)

    async def send_event(self, user_id: int, event: str, data: Any) -> None:
        await self._send_many(user_id, {"event": event, "data": data})


manager = MatchmakingConnectionManager()
