import os
import sys
import re
import time
import shutil
import tempfile
import subprocess
from typing import Optional, Tuple
from backend.models.schema import RunResult

def get_java_binaries() -> Tuple[Optional[str], Optional[str]]:
    """
    Locates javac and java binaries, checking Homebrew openjdk first,
    then JAVA_HOME, then standard system PATH.
    """
    candidate_dirs = [
        "/opt/homebrew/opt/openjdk/bin",
        "/opt/homebrew/bin",
        "/usr/local/opt/openjdk/bin",
        "/usr/local/bin",
        "/usr/bin"
    ]
    java_home = os.environ.get("JAVA_HOME")
    if java_home:
        candidate_dirs.insert(0, os.path.join(java_home, "bin"))

    javac_path = None
    java_path = None

    for d in candidate_dirs:
        jc = os.path.join(d, "javac")
        if not javac_path and os.path.isfile(jc) and os.access(jc, os.X_OK):
            javac_path = jc
        jv = os.path.join(d, "java")
        if not java_path and os.path.isfile(jv) and os.access(jv, os.X_OK):
            java_path = jv

    if not javac_path:
        javac_path = shutil.which("javac")
    if not java_path:
        java_path = shutil.which("java")

    return javac_path, java_path

def detect_or_wrap_class(code: str) -> Tuple[str, str]:
    """
    Determines the main class name and ensures valid Java structure.
    If public class exists, class_name matches it.
    If regular class exists, uses that class name.
    If no class exists at all, wraps statements in public class Solution.
    """
    # Look for public class Foo
    public_match = re.search(r'\bpublic\s+(?:final\s+|abstract\s+)*class\s+([A-Za-z_$][A-Za-z0-9_$]*)', code)
    if public_match:
        return public_match.group(1), code

    # Look for class Foo
    class_match = re.search(r'\bclass\s+([A-Za-z_$][A-Za-z0-9_$]*)', code)
    if class_match:
        return class_match.group(1), code

    # Bare code: wrap in Solution class
    wrapped_code = f"""import java.util.*;
import java.io.*;

public class Solution {{
    public static void main(String[] args) throws Exception {{
{code}
    }}
}}
"""
    return "Solution", wrapped_code

def execute_java_sandboxed(
    code: str,
    stdin_data: str = "",
    timeout_seconds: float = 3.0,
    execution_mode: str = "stdin/stdout",
    function_name: Optional[str] = None,
    max_output_bytes: int = 65536
) -> RunResult:
    """
    Compiles and executes Java code in a sandboxed temporary directory.
    - Captures compilation errors as error_message='Compilation Error'
    - Enforces timeout on execution
    - Limits JVM memory allocation (-Xmx256m -Xss16m)
    - Truncates excessive output
    - Automatically cleans up artifacts
    """
    start_time = time.perf_counter()
    javac_path, java_path = get_java_binaries()

    if not javac_path or not java_path:
        return RunResult(
            stdout="",
            stderr="Java runtime environment error: 'javac' or 'java' compiler is not configured or installed on the system.",
            exit_code=1,
            duration_ms=0.0,
            timed_out=False,
            truncated=False,
            error_message="JavaCompilerNotFound"
        )

    class_name, final_code = detect_or_wrap_class(code)
    temp_dir = tempfile.mkdtemp(prefix="codementor_java_sandbox_")

    try:
        source_file = os.path.join(temp_dir, f"{class_name}.java")
        with open(source_file, "w", encoding="utf-8") as f:
            f.write(final_code)

        # Sanitized environment
        clean_env = {
            "PATH": os.path.dirname(javac_path) + ":" + os.environ.get("PATH", "/usr/bin:/bin:/usr/local/bin"),
            "LANG": "en_US.UTF-8",
            "LC_ALL": "en_US.UTF-8"
        }

        # Step 1: Compilation
        compile_cmd = [
            javac_path,
            "-encoding", "UTF-8",
            "-d", temp_dir,
            source_file
        ]

        try:
            compile_proc = subprocess.Popen(
                compile_cmd,
                cwd=temp_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.DEVNULL,
                env=clean_env,
                text=True
            )
            c_stdout, c_stderr = compile_proc.communicate(timeout=10.0)
            if compile_proc.returncode != 0:
                duration_ms = (time.perf_counter() - start_time) * 1000
                return RunResult(
                    stdout="",
                    stderr=c_stderr or c_stdout or "Compilation failed.",
                    exit_code=compile_proc.returncode or 1,
                    duration_ms=round(duration_ms, 2),
                    timed_out=False,
                    truncated=False,
                    error_message="Compilation Error"
                )
        except subprocess.TimeoutExpired:
            compile_proc.kill()
            duration_ms = (time.perf_counter() - start_time) * 1000
            return RunResult(
                stdout="",
                stderr="Compilation timed out.",
                exit_code=124,
                duration_ms=round(duration_ms, 2),
                timed_out=True,
                truncated=False,
                error_message="CompilationTimeout"
            )

        # Step 2: Execution
        exec_start = time.perf_counter()
        run_cmd = [
            java_path,
            "-Xmx256m",
            "-Xss16m",
            "-Dfile.encoding=UTF-8",
            "-cp", temp_dir,
            class_name
        ]

        try:
            proc = subprocess.Popen(
                run_cmd,
                cwd=temp_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.PIPE,
                env=clean_env,
                text=True
            )
            stdout_data, stderr_data = proc.communicate(
                input=stdin_data if stdin_data else "",
                timeout=timeout_seconds
            )
            duration_ms = (time.perf_counter() - exec_start) * 1000

            truncated = False
            if len(stdout_data.encode("utf-8")) > max_output_bytes:
                stdout_data = stdout_data[:max_output_bytes]
                truncated = True

            return RunResult(
                stdout=stdout_data,
                stderr=stderr_data,
                exit_code=proc.returncode if proc.returncode is not None else 0,
                duration_ms=round(duration_ms, 2),
                timed_out=False,
                truncated=truncated,
                error_message="Runtime Error" if proc.returncode != 0 else None
            )

        except subprocess.TimeoutExpired:
            proc.kill()
            try:
                proc.communicate(timeout=1.0)
            except Exception:
                pass
            duration_ms = (time.perf_counter() - exec_start) * 1000
            return RunResult(
                stdout="",
                stderr=f"TimeLimitExceeded: Program exceeded execution timeout of {timeout_seconds} seconds.",
                exit_code=124,
                duration_ms=round(duration_ms, 2),
                timed_out=True,
                truncated=False,
                error_message="TimeLimitExceeded"
            )

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
