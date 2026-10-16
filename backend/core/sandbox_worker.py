import sys
import os
import io
import time
import json
import traceback

# Enforce network restriction
def block_network():
    try:
        import socket
        def blocked_socket(*args, **kwargs):
            raise PermissionError("Network access is disabled in the CodeMentor sandbox.")
        socket.socket = blocked_socket
    except Exception:
        pass

# Set resource limits where available
def set_limits(cpu_limit_sec=5):
    try:
        import resource
        # Limit CPU time
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_limit_sec, cpu_limit_sec + 1))
        # Limit process creation if supported
        if hasattr(resource, 'RLIMIT_NPROC'):
            try:
                resource.setrlimit(resource.RLIMIT_NPROC, (30, 30))
            except Exception:
                pass
    except Exception:
        pass

def run():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No payload file provided."}))
        sys.exit(1)

    payload_file = sys.argv[1]
    with open(payload_file, "r", encoding="utf-8") as f:
        payload = json.load(f)

    code = payload.get("code", "")
    stdin_data = payload.get("stdin_data", "")
    exec_mode = payload.get("execution_mode", "stdin/stdout")
    func_name = payload.get("function_name", None)
    max_output_bytes = payload.get("max_output_bytes", 65536)
    cpu_limit = payload.get("cpu_limit_sec", 4)

    block_network()
    set_limits(cpu_limit)

    # Prepare standard IO redirect
    real_stdout = sys.stdout
    real_stderr = sys.stderr

    captured_stdout = io.StringIO()
    captured_stderr = io.StringIO()

    sys.stdin = io.StringIO(stdin_data)
    sys.stdout = captured_stdout
    sys.stderr = captured_stderr

    start_time = time.perf_counter()
    exit_code = 0
    error_type = None

    # Global and local scope for execution
    user_globals = {
        "__name__": "__main__",
        "__doc__": None,
        "__package__": None,
    }

    try:
        compiled = compile(code, "<submitted_code>", "exec")
        exec(compiled, user_globals)

        # If Mode B (function-based) is explicitly requested and function_name is provided:
        if exec_mode.startswith("function") and func_name:
            if func_name in user_globals and callable(user_globals[func_name]):
                fn = user_globals[func_name]
                if stdin_data is not None and stdin_data != "":
                    lines = stdin_data.splitlines() if stdin_data else [""]
                    outputs = []
                    is_in_place = "in_place" in exec_mode
                    detailed_exc = "detailed_exc" in exec_mode
                    with_cause = "with_cause" in exec_mode

                    def format_exc(e):
                        if not detailed_exc:
                            return type(e).__name__
                        cause_str = f" [cause: {type(e.__cause__).__name__}]" if (with_cause and e.__cause__) else ""
                        msg = str(e)
                        if msg:
                            return f"{type(e).__name__}: {msg}{cause_str}"
                        return f"{type(e).__name__}{cause_str}"

                    for line in lines:
                        line = line.strip()
                        try:
                            if is_in_place:
                                args = list(eval(f"({line},)", user_globals))
                                try:
                                    fn(*args)
                                    outputs.append(repr(args[0]))
                                except Exception as e:
                                    if detailed_exc:
                                        outputs.append(f"{repr(args[0])}\n{format_exc(e)}")
                                    else:
                                        outputs.append(format_exc(e))
                            else:
                                call_expr = f"{func_name}({line})"
                                val = eval(call_expr, user_globals)
                                if isinstance(val, (set, frozenset)):
                                    try:
                                        val = sorted(val)
                                    except Exception:
                                        pass
                                outputs.append(repr(val))
                        except Exception as e:
                            outputs.append(format_exc(e))
                    captured_stdout.write("\n".join(outputs))
            else:
                captured_stderr.write(f"Function '{func_name}' was not defined in submitted code.\n")
                exit_code = 1
    except SyntaxError as e:
        exit_code = 1
        error_type = "SyntaxError"
        traceback.print_exc(file=captured_stderr)
    except Exception as e:
        exit_code = 1
        error_type = type(e).__name__
        traceback.print_exc(file=captured_stderr)
    finally:
        duration_ms = (time.perf_counter() - start_time) * 1000

    raw_stdout = captured_stdout.getvalue()
    raw_stderr = captured_stderr.getvalue()

    truncated = False
    if len(raw_stdout.encode("utf-8")) > max_output_bytes:
        raw_stdout = raw_stdout[:max_output_bytes] + "\n[Output truncated: Exceeded 64KB limit]"
        truncated = True

    if len(raw_stderr.encode("utf-8")) > max_output_bytes:
        raw_stderr = raw_stderr[:max_output_bytes] + "\n[Stderr truncated: Exceeded 64KB limit]"
        truncated = True

    output_result = {
        "stdout": raw_stdout,
        "stderr": raw_stderr,
        "exit_code": exit_code,
        "duration_ms": round(duration_ms, 2),
        "timed_out": False,
        "truncated": truncated,
        "error_type": error_type
    }

    sys.stdout = real_stdout
    sys.stderr = real_stderr
    print(json.dumps(output_result))

if __name__ == "__main__":
    run()
