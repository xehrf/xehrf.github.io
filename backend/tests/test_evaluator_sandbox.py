import pytest
from pydantic import ValidationError

from app.submissions.evaluator import evaluate_python_function
from app.submissions.limits import MAX_CODE_SIZE_BYTES, MAX_TEST_CASES
from app.submissions.schemas import SubmissionCreate
from app.tasks.schemas import TaskCreate, TaskSubmitBody


def _tests_payload() -> dict:
    return {
        "type": "python_function",
        "function_name": "sum_two",
        "tests": [
            {"input": [1, 2], "expected": 3},
            {"input": [5, 7], "expected": 12},
        ],
    }


def test_evaluate_python_function_runs_in_worker_successfully() -> None:
    result = evaluate_python_function(
        "def sum_two(a, b):\n    return a + b\n",
        _tests_payload(),
    )

    assert result.passed is True
    assert result.passed_tests == 2
    assert result.total_tests == 2


def test_evaluate_python_function_times_out_infinite_loop() -> None:
    result = evaluate_python_function(
        "def sum_two(a, b):\n    while True:\n        pass\n",
        _tests_payload(),
    )

    assert result.passed is False
    assert "timed out" in result.message.lower()


def test_evaluate_python_function_rejects_too_many_test_cases() -> None:
    tests_json = {
        "type": "python_function",
        "function_name": "sum_two",
        "tests": [{"input": [1, 2], "expected": 3}] * (MAX_TEST_CASES + 1),
    }

    result = evaluate_python_function("def sum_two(a, b):\n    return a + b\n", tests_json)

    assert result.passed is False
    assert "test case count exceeds" in result.message.lower()


def test_task_submit_body_rejects_oversized_code() -> None:
    with pytest.raises(ValidationError):
        TaskSubmitBody(code="x" * (MAX_CODE_SIZE_BYTES + 1))


def test_submission_create_rejects_oversized_code() -> None:
    with pytest.raises(ValidationError):
        SubmissionCreate(task_id=1, code="x" * (MAX_CODE_SIZE_BYTES + 1))


def test_task_create_rejects_too_many_tests() -> None:
    with pytest.raises(ValidationError):
        TaskCreate(
            title="Task title",
            description="Long enough description for validation.",
            task_type="solo",
            tests_json={
                "type": "python_function",
                "function_name": "sum_two",
                "tests": [{"input": [1, 2], "expected": 3}] * (MAX_TEST_CASES + 1),
            },
        )
