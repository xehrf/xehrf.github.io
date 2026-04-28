"""
app/matchmaking/match_ws.py

WebSocket endpoint for real-time collaboration inside a match:
  - chat messages
  - shared code editor (last-write-wins)
  - participant presence

This room transport is backed by Redis so players connected through
different API processes still receive the same room events.
"""

import asyncio
import json
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.auth.security import decode_token
from app.core.redis_client import get_async_redis
from app.db.models import Match, MatchParticipant, User
from app.db.session import get_db

match_ws_router = APIRouter(prefix="/matchmaking", tags=["matchmaking"])
GAME_EVENT_NAMES = {
    "game_start",
    "game_start_cancelled",
    "game_answer_submitted",
    "game_round_result",
    "game_next_round",
    "game_finished",
}


def _room_channel(match_id: int) -> str:
    return f"mm:match_room:{match_id}:events"


def _room_presence_key(match_id: int) -> str:
    return f"mm:match_room:{match_id}:presence"


def _room_ready_key(match_id: int) -> str:
    return f"mm:match_room:{match_id}:ready"


async def _publish_room_event(redis_client, match_id: int, payload: dict[str, Any]) -> None:
    await redis_client.publish(_room_channel(match_id), json.dumps(payload))


async def _get_online_user_ids(redis_client, match_id: int) -> list[int]:
    online_map = await redis_client.hgetall(_room_presence_key(match_id))
    online_ids: list[int] = []
    for raw_user_id, raw_count in online_map.items():
        try:
            if int(raw_count) > 0:
                online_ids.append(int(raw_user_id))
        except (TypeError, ValueError):
            continue

    online_ids.sort()
    return online_ids


async def _mark_online(redis_client, match_id: int, user_id: int) -> list[int]:
    await redis_client.hincrby(_room_presence_key(match_id), str(user_id), 1)
    return await _get_online_user_ids(redis_client, match_id)


async def _mark_offline(redis_client, match_id: int, user_id: int) -> list[int]:
    remaining = await redis_client.hincrby(_room_presence_key(match_id), str(user_id), -1)
    if remaining <= 0:
        await redis_client.hdel(_room_presence_key(match_id), str(user_id))
    return await _get_online_user_ids(redis_client, match_id)


async def _get_ready_state(redis_client, match_id: int, participants_info: list[dict[str, Any]]) -> dict[str, Any]:
    ready_map = await redis_client.hgetall(_room_ready_key(match_id))
    participants = []

    for participant in participants_info:
        user_id = participant["user_id"]
        participants.append({
            "user_id": user_id,
            "display_name": participant["display_name"],
            "nickname": participant["nickname"],
            "ready": ready_map.get(str(user_id)) == "1",
        })

    all_ready = len(participants) >= 2 and all(participant["ready"] for participant in participants)
    return {
        "participants": participants,
        "all_ready": all_ready,
    }


async def _relay_room_events(pubsub, websocket: WebSocket, user_id: int) -> None:
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

        excluded_user_id = payload.pop("_exclude_user_id", None)
        if excluded_user_id is not None and str(excluded_user_id) == str(user_id):
            continue

        await websocket.send_json(payload)


@match_ws_router.websocket("/match/{match_id}/ws")
async def match_room_socket(websocket: WebSocket, match_id: int) -> None:
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

        participants_q = (
            db.query(User)
            .join(MatchParticipant, MatchParticipant.user_id == User.id)
            .filter(MatchParticipant.match_id == match_id)
            .all()
        )
        participants_info = [
            {
                "user_id": participant.id,
                "display_name": participant.display_name or participant.nickname or participant.email,
                "nickname": participant.nickname or participant.email,
                "pts": participant.pts or 0,
                "avatar_url": participant.avatar_url,
                "level": participant.level or "beginner",
            }
            for participant in participants_q
        ]
    finally:
        db.close()

    redis_client = get_async_redis()
    pubsub = redis_client.pubsub()
    relay_task: asyncio.Task | None = None

    await websocket.accept()

    try:
        await pubsub.subscribe(_room_channel(match_id))
        relay_task = asyncio.create_task(_relay_room_events(pubsub, websocket, user.id))

        online_ids = await _mark_online(redis_client, match_id, user.id)
        readiness = await _get_ready_state(redis_client, match_id, participants_info)
        await websocket.send_json({
            "event": "room_state",
            "data": {
                "participants": participants_info,
                "online": online_ids,
                "readiness": readiness,
            },
        })

        await _publish_room_event(
            redis_client,
            match_id,
            {
                "event": "user_joined",
                "data": {
                    "user_id": user.id,
                    "online": online_ids,
                },
            },
        )

        while True:
            data = await websocket.receive_json()
            event = data.get("event")

            if event == "chat":
                raw_text = str(data.get("text", ""))
                text = raw_text if raw_text.startswith("__GAME__:") else raw_text[:1000]
                await _publish_room_event(
                    redis_client,
                    match_id,
                    {
                        "event": "chat",
                        "data": {
                            "user_id": user.id,
                            "nickname": user.nickname or user.email,
                            "display_name": user.display_name or user.nickname or user.email,
                            "text": text,
                        },
                    },
                )

            elif event in GAME_EVENT_NAMES:
                event_data = data.get("data", {})
                if not isinstance(event_data, dict):
                    event_data = {}

                if event == "game_start":
                    await redis_client.delete(_room_ready_key(match_id))

                await _publish_room_event(
                    redis_client,
                    match_id,
                    {
                        "event": event,
                        "data": event_data,
                    },
                )

            elif event == "ready_toggle":
                ready = bool(data.get("ready"))
                ready_key = _room_ready_key(match_id)
                if ready:
                    await redis_client.hset(ready_key, str(user.id), "1")
                    await redis_client.expire(ready_key, 3600)
                else:
                    await redis_client.hset(ready_key, str(user.id), "0")

                readiness = await _get_ready_state(redis_client, match_id, participants_info)
                await _publish_room_event(
                    redis_client,
                    match_id,
                    {
                        "event": "readiness_update",
                        "data": readiness,
                    },
                )

            elif event == "code_update":
                await _publish_room_event(
                    redis_client,
                    match_id,
                    {
                        "event": "code_update",
                        "_exclude_user_id": user.id,
                        "data": {
                            "user_id": user.id,
                            "code": data.get("code", ""),
                            "language": data.get("language", "python"),
                        },
                    },
                )

            elif event == "cursor":
                await _publish_room_event(
                    redis_client,
                    match_id,
                    {
                        "event": "cursor",
                        "_exclude_user_id": user.id,
                        "data": {
                            "user_id": user.id,
                            "line": data.get("line", 0),
                            "col": data.get("col", 0),
                        },
                    },
                )

    except WebSocketDisconnect:
        pass
    finally:
        try:
            online_ids = await _mark_offline(redis_client, match_id, user.id)
            await redis_client.hset(_room_ready_key(match_id), str(user.id), "0")
            readiness = await _get_ready_state(redis_client, match_id, participants_info)
            await _publish_room_event(
                redis_client,
                match_id,
                {
                    "event": "user_left",
                    "data": {
                        "user_id": user.id,
                        "online": online_ids,
                    },
                },
            )
            await _publish_room_event(
                redis_client,
                match_id,
                {
                    "event": "readiness_update",
                    "data": readiness,
                },
            )
        except Exception:
            pass

        if relay_task is not None:
            relay_task.cancel()
            try:
                await relay_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass

        try:
            await pubsub.unsubscribe(_room_channel(match_id))
        except Exception:
            pass

        try:
            await pubsub.close()
        except Exception:
            pass

        await redis_client.close()
