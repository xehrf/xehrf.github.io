from __future__ import annotations

import ast
import json
import sys
from typing import Any

# Attributes reachable via MRO / introspection that enable sandbox escapes.
_BLOCKED_ATTRS = frozenset({
    "__class__", "__bases__", "__mro__", "__subclasses__",
    "__globals__", "__builtins__", "__dict__", "__code__",
    "__func__", "__self__", "__wrapped__", "__closure__",
    "__init_subclass__", "__reduce__", "__reduce_ex__",
    "__getattribute__", "__init__", "__new__", "__del__",
    "mro",
})

# Names that are not in _safe_builtins but could be accessed via exotic paths.
_BLOCKED_NAMES = frozenset({
    "__import__", "open", "eval", "exec", "compile", "input",
    "breakpoint", "exit", "quit", "help",
    "globals", "locals", "vars", "dir",
    "getattr", "setattr", "delattr", "hasattr",
    "__builtins__",
})


def _validate_ast(code: str) -> str | None:
    try:
        tree = ast.parse(code, mode="exec")
    except SyntaxError as exc:
        return f"Syntax error: {exc}"

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            return "Import statements are not allowed in solutions."
        if isinstance(node, ast.Attribute) and node.attr in _BLOCKED_ATTRS:
            return f"Access to '{node.attr}' is not allowed."
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load) and node.id in _BLOCKED_NAMES:
            return f"Use of '{node.id}' is not allowed."

    return None


def _to_tuple(value: Any) -> tuple[Any, ...]:
    if isinstance(value, list):
        return tuple(value)
    if isinstance(value, tuple):
        return value
    return (value,)


def _safe_builtins() -> dict[str, Any]:
    return {
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


def _result(passed: bool, message: str, passed_tests: int, total_tests: int) -> dict[str, Any]:
    return {
        "passed": passed,
        "message": message,
        "passed_tests": passed_tests,
        "total_tests": total_tests,
    }


def _evaluate_python_function(code: str, tests_json: dict[str, Any] | None) -> dict[str, Any]:
    if not tests_json:
        return _result(False, "No tests configured for this task.", 0, 0)

    if tests_json.get("type") != "python_function":
        return _result(False, "Unsupported tests format.", 0, 0)

    function_name = tests_json.get("function_name")
    tests = tests_json.get("tests", [])
    if not function_name or not isinstance(tests, list) or len(tests) == 0:
        return _result(False, "Task tests are invalid.", 0, 0)

    ast_error = _validate_ast(code)
    if ast_error:
        return _result(False, ast_error, 0, len(tests))

    globals_dict: dict[str, Any] = {"__builtins__": _safe_builtins()}
    locals_dict: dict[str, Any] = {}

    try:
        exec(code, globals_dict, locals_dict)  # noqa: S102
    except Exception as exc:  # noqa: BLE001
        return _result(False, f"Runtime error while loading solution: {exc}", 0, len(tests))

    fn = locals_dict.get(function_name) or globals_dict.get(function_name)
    if not callable(fn):
        return _result(False, f"Function `{function_name}` not found.", 0, len(tests))

    passed = 0
    total = len(tests)

    for idx, case in enumerate(tests, start=1):
        if not isinstance(case, dict) or "input" not in case or "expected" not in case:
            return _result(False, f"Invalid test case format at #{idx}.", passed, total)
        args = _to_tuple(case["input"])
        expected = case["expected"]
        try:
            actual = fn(*args)
        except Exception as exc:  # noqa: BLE001
            return _result(False, f"Test #{idx} crashed: {exc}", passed, total)
        if actual != expected:
            return _result(False, f"Test #{idx} failed: expected {expected!r}, got {actual!r}", passed, total)
        passed += 1

    return _result(True, f"All tests passed ({passed}/{total}).", passed, total)


def main() -> int:
    sys.setrecursionlimit(500)
    payload = json.load(sys.stdin)
    result = _evaluate_python_function(payload.get("code", ""), payload.get("tests_json"))
    json.dump(result, sys.stdout, ensure_ascii=False)
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
