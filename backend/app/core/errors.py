from __future__ import annotations

from typing import Any


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        *,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def build_error_body(code: str, message: str, *, details: Any = None) -> dict[str, Any]:
    error = {
        "code": code,
        "message": message,
    }
    if details is not None:
        error["details"] = details
    return {"error": error}
