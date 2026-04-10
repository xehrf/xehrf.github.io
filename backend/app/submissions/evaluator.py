from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class EvaluationResult:
    passed: bool
    message: str
    passed_tests: int
    total_tests: int


def _to_tuple(value: Any) -> tuple[Any, ...]:
    if isinstance(value, list):
        return tuple(value)
    if isinstance(value, tuple):
        return value
    return (value,)


def evaluate_python_function(code: str, tests_json: dict | None) -> EvaluationResult:
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

    function_name = tests_json.get("function_name")
    tests = tests_json.get("tests", [])
    if not function_name or not isinstance(tests, list) or len(tests) == 0:
        return EvaluationResult(
            passed=False,
            message="Task tests are invalid.",
            passed_tests=0,
            total_tests=0,
        )

    safe_builtins = {
        "abs": abs,
        "all": all,
        "any": any,
        "bool": bool,
        "dict": dict,
        "enumerate": enumerate,
        "float": float,
        "int": int,
        "len": len,
        "list": list,
        "max": max,
        "min": min,
        "pow": pow,
        "range": range,
        "reversed": reversed,
        "round": round,
        "set": set,
        "sorted": sorted,
        "str": str,
        "sum": sum,
        "tuple": tuple,
        "zip": zip,
    }
    globals_dict: dict[str, Any] = {"__builtins__": safe_builtins}
    locals_dict: dict[str, Any] = {}

    try:
        exec(code, globals_dict, locals_dict)
    except Exception as exc:  # noqa: BLE001
        return EvaluationResult(
            passed=False,
            message=f"Runtime error while loading solution: {exc}",
            passed_tests=0,
            total_tests=len(tests),
        )

    fn = locals_dict.get(function_name) or globals_dict.get(function_name)
    if not callable(fn):
        return EvaluationResult(
            passed=False,
            message=f"Function `{function_name}` not found.",
            passed_tests=0,
            total_tests=len(tests),
        )

    passed = 0
    total = len(tests)

    for idx, case in enumerate(tests, start=1):
        if not isinstance(case, dict) or "input" not in case or "expected" not in case:
            return EvaluationResult(
                passed=False,
                message=f"Invalid test case format at #{idx}.",
                passed_tests=passed,
                total_tests=total,
            )
        args = _to_tuple(case["input"])
        expected = case["expected"]
        try:
            actual = fn(*args)
        except Exception as exc:  # noqa: BLE001
            return EvaluationResult(
                passed=False,
                message=f"Test #{idx} crashed: {exc}",
                passed_tests=passed,
                total_tests=total,
            )
        if actual != expected:
            return EvaluationResult(
                passed=False,
                message=f"Test #{idx} failed: expected {expected!r}, got {actual!r}",
                passed_tests=passed,
                total_tests=total,
            )
        passed += 1

    return EvaluationResult(
        passed=True,
        message=f"All tests passed ({passed}/{total}).",
        passed_tests=passed,
        total_tests=total,
    )

