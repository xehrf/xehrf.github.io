import logging
from datetime import datetime, timedelta, timezone

import bcrypt as _bcrypt
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# passlib 1.7.4 accesses bcrypt.__about__.__version__; bcrypt 4.x removed __about__.
if not hasattr(_bcrypt, "__about__"):
    _bcrypt.__about__ = type("_About", (), {"__version__": _bcrypt.__version__})()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain[:72], hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password[:72])


def create_access_token(subject: str) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(subject), "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> str | None:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        sub = payload.get("sub")
        token_type = payload.get("type")
        if token_type not in (None, "access"):
            return None
        if sub is None:
            return None
        return str(sub)
    except JWTError as e:
        logger.warning("decode_token JWTError: %s: %s", type(e).__name__, e)
        return None


def create_oauth_state(payload: dict[str, object]) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.oauth_state_expire_minutes)
    token_payload = {**payload, "exp": expire, "type": "oauth_state"}
    return jwt.encode(token_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_oauth_state(token: str) -> dict[str, object] | None:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("type") != "oauth_state":
            return None
        return payload
    except JWTError as e:
        logger.warning("decode_oauth_state JWTError: %s: %s", type(e).__name__, e)
        return None
