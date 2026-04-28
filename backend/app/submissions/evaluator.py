from __future__ import annotations

from dataclasses import dataclass
from app.submissions.limits import validate_code_size, validate_tests_json_limits
from app.submissions.sandbox import run_python_function_in_sandbox


@dataclass
class EvaluationResult:
    passed: bool
    message: str
    passed_tests: int
    total_tests: int


def evaluate_python_function(code: str, tests_json: dict | None) -> EvaluationResult:
    try:
        validate_code_size(code)
    except ValueError as exc:
        return EvaluationResult(
            passed=False,
            message=str(exc),
            passed_tests=0,
            total_tests=0,
        )

    try:
        validate_tests_json_limits(tests_json)
    except ValueError as exc:
        return EvaluationResult(
            passed=False,
            message=str(exc),
            passed_tests=0,
            total_tests=0,
        )

    if not tests_json:
        return EvaluationResult(
            passed=False,
            message="No tests configured for this task.",
            passed_tests=0,
            total_tests=0,
        )

    if tests_json.get("type") != "python_function":
        return EvaluationResult(
            passed=False,
            message="Unsupported tests format.",
            passed_tests=0,
            total_tests=0,
        )

    return run_python_function_in_sandbox(code, tests_json)
