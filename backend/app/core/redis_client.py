import redis
import redis.asyncio as redis_async

from app.core.config import get_settings


def get_redis() -> redis.Redis:
    settings = get_settings()
    return redis.from_url(settings.redis_url, decode_responses=True)


def get_async_redis() -> redis_async.Redis:
    settings = get_settings()
    return redis_async.from_url(settings.redis_url, decode_responses=True)
