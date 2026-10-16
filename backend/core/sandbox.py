import os
import sys
import json
import time
import shutil
import tempfile
import subprocess
from typing import Optional
from backend.models.schema import RunResult

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
WORKER_SCRIPT = os.path.join(CURRENT_DIR, "sandbox_worker.py")

def execute_code_sandboxed(
    code: str,
    stdin_data: str = "",
    timeout_seconds: float = 3.0,
    execution_mode: str = "stdin/stdout",
    function_name: Optional[str] = None,
    max_output_bytes: int = 65536
) -> RunResult:
    """
    Executes Python code in an isolated dedicated subprocess worker.
    - No network access
    - Timeout enforcement with SIGKILL
    - Cleaned-up temporary directory
    - Sanitized environment (no parent secrets/tokens exposed)
    - Captures stdout/stderr with truncation limits
    """
    start_time = time.perf_counter()
    temp_dir = tempfile.mkdtemp(prefix="codementor_sandbox_")

    try:
        payload = {
            "code": code,
            "stdin_data": stdin_data,
            "execution_mode": execution_mode,
            "function_name": function_name,
            "max_output_bytes": max_output_bytes,
            "cpu_limit_sec": max(1, int(timeout_seconds + 1))
        }

        payload_path = os.path.join(temp_dir, "payload.json")
        with open(payload_path, "w", encoding="utf-8") as f:
            json.dump(payload, f)

        # Sanitized environment
        clean_env = {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin:/usr/local/bin"),
            "PYTHONPATH": "",
            "PYTHONUNBUFFERED": "1",
            "PYTHONDONTWRITEBYTECODE": "1"
        }

        cmd = [sys.executable, WORKER_SCRIPT, payload_path]

        try:
            proc = subprocess.Popen(
                cmd,
                cwd=temp_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.DEVNULL,
                env=clean_env,
                text=True
            )

            stdout_data, stderr_data = proc.communicate(timeout=timeout_seconds)
            duration_ms = (time.perf_counter() - start_time) * 1000

            # Try parsing worker JSON output
            try:
                worker_result = json.loads(stdout_data.strip())
                return RunResult(
                    stdout=worker_result.get("stdout", ""),
                    stderr=worker_result.get("stderr", "") or stderr_data,
                    exit_code=worker_result.get("exit_code", 0),
                    duration_ms=worker_result.get("duration_ms", round(duration_ms, 2)),
                    timed_out=False,
                    truncated=worker_result.get("truncated", False),
                    error_message=worker_result.get("error_type")
                )
            except Exception:
                # If worker failed to output valid JSON
                return RunResult(
                    stdout=stdout_data,
                    stderr=stderr_data,
                    exit_code=proc.returncode if proc.returncode is not None else 1,
                    duration_ms=round(duration_ms, 2),
                    timed_out=False,
                    truncated=False,
                    error_message="Worker output error" if proc.returncode != 0 else None
                )

        except subprocess.TimeoutExpired:
            proc.kill()
            try:
                proc.communicate(timeout=1.0)
            except Exception:
                pass
            duration_ms = (time.perf_counter() - start_time) * 1000
            return RunResult(
                stdout="",
                stderr=f"TimeLimitExceeded: Program exceeded execution timeout of {timeout_seconds} seconds.",
                exit_code=124,  # Standard timeout exit code
                duration_ms=round(duration_ms, 2),
                timed_out=True,
                truncated=False,
                error_message="TimeLimitExceeded"
            )

    finally:
        # Guarantee cleanup of temporary sandbox directory
        shutil.rmtree(temp_dir, ignore_errors=True)
