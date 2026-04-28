from __future__ import annotations

import ctypes
import json
import os
from pathlib import Path
import subprocess
import sys
from typing import Any
from typing import TYPE_CHECKING

from app.submissions.limits import (
    EVALUATION_CPU_SECONDS,
    EVALUATION_MEMORY_LIMIT_BYTES,
    EVALUATION_TIMEOUT_SECONDS,
)

if TYPE_CHECKING:
    from app.submissions.evaluator import EvaluationResult


def run_python_function_in_sandbox(code: str, tests_json: dict[str, Any]) -> EvaluationResult:
    from app.submissions.evaluator import EvaluationResult

    payload = {
        "code": code,
        "tests_json": tests_json,
    }

    proc, job_handle = _spawn_worker()
    try:
        stdout, stderr = proc.communicate(
            json.dumps(payload, ensure_ascii=False),
            timeout=EVALUATION_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.communicate()
        return EvaluationResult(
            passed=False,
            message=f"Evaluation timed out after {EVALUATION_TIMEOUT_SECONDS:.1f}s.",
            passed_tests=0,
            total_tests=_count_tests(tests_json),
        )
    finally:
        if job_handle is not None:
            ctypes.windll.kernel32.CloseHandle(job_handle)

    if proc.returncode != 0:
        return EvaluationResult(
            passed=False,
            message="Sandbox worker terminated unexpectedly.",
            passed_tests=0,
            total_tests=_count_tests(tests_json),
        )

    try:
        result = json.loads(stdout)
    except json.JSONDecodeError:
        return EvaluationResult(
            passed=False,
            message="Sandbox worker returned an invalid response.",
            passed_tests=0,
            total_tests=_count_tests(tests_json),
        )

    return EvaluationResult(
        passed=bool(result.get("passed", False)),
        message=str(result.get("message", "Sandbox worker returned no message.")),
        passed_tests=int(result.get("passed_tests", 0) or 0),
        total_tests=int(result.get("total_tests", _count_tests(tests_json)) or 0),
    )


def _count_tests(tests_json: dict[str, Any] | None) -> int:
    tests = tests_json.get("tests") if isinstance(tests_json, dict) else None
    return len(tests) if isinstance(tests, list) else 0


def _spawn_worker() -> tuple[subprocess.Popen[str], int | None]:
    backend_root = Path(__file__).resolve().parents[2]
    command = [sys.executable, "-m", "app.submissions.sandbox_worker"]
    creationflags = 0
    preexec_fn = None

    if os.name == "posix":
        preexec_fn = _configure_posix_limits
    elif os.name == "nt":
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)

    proc = subprocess.Popen(
        command,
        cwd=str(backend_root),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        preexec_fn=preexec_fn,
        creationflags=creationflags,
    )

    job_handle = _apply_windows_job_limits(proc) if os.name == "nt" else None
    return proc, job_handle


def _configure_posix_limits() -> None:
    import resource

    resource.setrlimit(resource.RLIMIT_CPU, (EVALUATION_CPU_SECONDS, EVALUATION_CPU_SECONDS))
    resource.setrlimit(
        resource.RLIMIT_AS,
        (EVALUATION_MEMORY_LIMIT_BYTES, EVALUATION_MEMORY_LIMIT_BYTES),
    )
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))


def _apply_windows_job_limits(proc: subprocess.Popen[str]) -> int | None:
    try:
        kernel32 = ctypes.windll.kernel32
    except AttributeError:
        return None

    class IO_COUNTERS(ctypes.Structure):
        _fields_ = [
            ("ReadOperationCount", ctypes.c_ulonglong),
            ("WriteOperationCount", ctypes.c_ulonglong),
            ("OtherOperationCount", ctypes.c_ulonglong),
            ("ReadTransferCount", ctypes.c_ulonglong),
            ("WriteTransferCount", ctypes.c_ulonglong),
            ("OtherTransferCount", ctypes.c_ulonglong),
        ]

    class JOBOBJECT_BASIC_LIMIT_INFORMATION(ctypes.Structure):
        _fields_ = [
            ("PerProcessUserTimeLimit", ctypes.c_longlong),
            ("PerJobUserTimeLimit", ctypes.c_longlong),
            ("LimitFlags", ctypes.c_uint32),
            ("MinimumWorkingSetSize", ctypes.c_size_t),
            ("MaximumWorkingSetSize", ctypes.c_size_t),
            ("ActiveProcessLimit", ctypes.c_uint32),
            ("Affinity", ctypes.c_void_p),
            ("PriorityClass", ctypes.c_uint32),
            ("SchedulingClass", ctypes.c_uint32),
        ]

    class JOBOBJECT_EXTENDED_LIMIT_INFORMATION(ctypes.Structure):
        _fields_ = [
            ("BasicLimitInformation", JOBOBJECT_BASIC_LIMIT_INFORMATION),
            ("IoInfo", IO_COUNTERS),
            ("ProcessMemoryLimit", ctypes.c_size_t),
            ("JobMemoryLimit", ctypes.c_size_t),
            ("PeakProcessMemoryUsed", ctypes.c_size_t),
            ("PeakJobMemoryUsed", ctypes.c_size_t),
        ]

    job = kernel32.CreateJobObjectW(None, None)
    if not job:
        return None

    info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION()
    info.BasicLimitInformation.LimitFlags = 0x00000002 | 0x00000100 | 0x00002000
    info.BasicLimitInformation.PerProcessUserTimeLimit = int(EVALUATION_CPU_SECONDS * 10_000_000)
    info.ProcessMemoryLimit = EVALUATION_MEMORY_LIMIT_BYTES

    result = kernel32.SetInformationJobObject(job, 9, ctypes.byref(info), ctypes.sizeof(info))
    if not result:
        kernel32.CloseHandle(job)
        return None

    assigned = kernel32.AssignProcessToJobObject(job, ctypes.c_void_p(int(proc._handle)))
    if not assigned:
        kernel32.CloseHandle(job)
        return None

    return int(job)
