import asyncio
import json
from dataclasses import dataclass
from typing import Any

from fastapi import WebSocket

from app.core.redis_client import get_async_redis


def _user_channel(user_id: int) -> str:
    return f"mm:user:{user_id}:events"


@dataclass
class _SocketSubscription:
    redis_client: Any
    pubsub: Any
    relay_task: asyncio.Task


class MatchmakingConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, dict[int, _SocketSubscription]] = {}

    async def _relay(self, pubsub, websocket: WebSocket) -> None:
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue

            raw_data = message.get("data")
            if raw_data is None:
                continue

            try:
                payload = json.loads(raw_data)
            except json.JSONDecodeError:
                continue

            await websocket.send_json(payload)

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        redis_client = get_async_redis()
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(_user_channel(user_id))
        relay_task = asyncio.create_task(self._relay(pubsub, websocket))

        user_connections = self._connections.setdefault(user_id, {})
        user_connections[id(websocket)] = _SocketSubscription(
            redis_client=redis_client,
            pubsub=pubsub,
            relay_task=relay_task,
        )

    async def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        user_connections = self._connections.get(user_id)
        if not user_connections:
            return

        subscription = user_connections.pop(id(websocket), None)
        if not user_connections:
            self._connections.pop(user_id, None)

        if subscription is None:
            return

        subscription.relay_task.cancel()
        try:
            await subscription.relay_task
        except asyncio.CancelledError:
            pass
        except Exception:
            pass

        try:
            await subscription.pubsub.unsubscribe(_user_channel(user_id))
        except Exception:
            pass

        try:
            await subscription.pubsub.close()
        except Exception:
            pass

        try:
            await subscription.redis_client.close()
        except Exception:
            pass

    async def send_event(self, user_id: int, event: str, data: Any) -> None:
        redis_client = get_async_redis()
        try:
            await redis_client.publish(
                _user_channel(user_id),
                json.dumps({"event": event, "data": data}),
            )
        finally:
            await redis_client.close()


manager = MatchmakingConnectionManager()
