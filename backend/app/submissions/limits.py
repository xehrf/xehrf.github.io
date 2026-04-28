from __future__ import annotations

import json
from typing import Any

MAX_CODE_SIZE_BYTES = 32 * 1024
MAX_TEST_CASES = 100
MAX_TESTS_JSON_BYTES = 64 * 1024
MAX_FUNCTION_NAME_LENGTH = 128

EVALUATION_TIMEOUT_SECONDS = 2.5
EVALUATION_CPU_SECONDS = 2
EVALUATION_MEMORY_LIMIT_BYTES = 128 * 1024 * 1024


def code_size_bytes(code: str) -> int:
    return len(code.encode("utf-8"))


def validate_code_size(code: str) -> None:
    size = code_size_bytes(code)
    if size > MAX_CODE_SIZE_BYTES:
        raise ValueError(f"Code size exceeds the {MAX_CODE_SIZE_BYTES} byte limit.")


def tests_json_size_bytes(tests_json: dict[str, Any] | None) -> int:
    if tests_json is None:
        return 0
    payload = json.dumps(tests_json, ensure_ascii=False, separators=(",", ":"), default=str)
    return len(payload.encode("utf-8"))


def validate_tests_json_limits(tests_json: dict[str, Any] | None) -> None:
    if tests_json is None:
        return

    size = tests_json_size_bytes(tests_json)
    if size > MAX_TESTS_JSON_BYTES:
        raise ValueError(f"Tests payload exceeds the {MAX_TESTS_JSON_BYTES} byte limit.")

    function_name = tests_json.get("function_name")
    if function_name is not None and len(str(function_name)) > MAX_FUNCTION_NAME_LENGTH:
        raise ValueError(f"Function name exceeds the {MAX_FUNCTION_NAME_LENGTH} character limit.")

    tests = tests_json.get("tests")
    if tests is None:
        return
    if not isinstance(tests, list):
        raise ValueError("Task tests must be provided as a list.")
    if len(tests) > MAX_TEST_CASES:
        raise ValueError(f"Test case count exceeds the limit of {MAX_TEST_CASES}.")
