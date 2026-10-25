from datetime import datetime
from typing import List, Optional
from backend.models.schema import (
    Question,
    TestCase,
    TestCaseResult,
    SubmitResult
)
from backend.core.sandbox import execute_code_sandboxed
from backend.core.comparator import compare_output, to_visible_whitespace

def run_tests_for_question(
    question: Question,
    code: str,
    bank_id: str,
    run_all: bool = False,
    is_owner: bool = False,
    comparison_mode: str = "judge",
    normalize_crlf: bool = True,
    strict_newline_policy: Optional[str] = None,
    timeout_per_test: float = 3.0,
    language: Optional[str] = None
) -> SubmitResult:
    """
    Runs test cases against the user's submitted code (Python or Java).
    Enforces comparison mode:
    - "judge": Judge-compatible mode allowing at most 1 final newline difference
    - "exact": Exact byte/character match
    Enforces privacy: if is_owner is False, hidden test inputs & expected outputs are NOT returned.
    """
    # Determine programming language
    effective_lang = (language or getattr(question, "language", "python") or "python").lower()

    # Handle backward compatibility
    if strict_newline_policy == "exact":
        effective_mode = "exact"
    elif strict_newline_policy == "strip_single_terminal_newline":
        effective_mode = "judge"
    else:
        effective_mode = comparison_mode or "judge"

    allow_one_final_newline = (effective_mode == "judge")

    test_cases = question.test_cases
    # Filter tests to run: if run_all is False, run only visible tests
    tests_to_run = [tc for tc in test_cases if run_all or not tc.is_hidden]

    results: List[TestCaseResult] = []
    passed_count = 0
    failed_count = 0

    for tc in tests_to_run:
        # Run code in sandbox with test case input
        run_res = execute_code_sandboxed(
            code=code,
            stdin_data=tc.input,
            timeout_seconds=timeout_per_test,
            execution_mode=question.execution_mode,
            function_name=question.function_name,
            language=effective_lang
        )

        passed = False
        failure_reason = None
        first_diff = None
        diagnostic = None
        flag_review = None

        if run_res.timed_out:
            failure_reason = f"Time Limit Exceeded ({timeout_per_test}s)"
            diagnostic = "Your program entered an infinite loop or exceeded the execution time limit."
        elif run_res.error_message == "Compilation Error":
            failure_reason = "Compilation Error"
            diagnostic = run_res.stderr.strip() or "Compilation failed."
        elif run_res.exit_code != 0:
            failure_reason = f"Runtime Error ({run_res.error_message or 'Non-zero exit'})"
            diagnostic = run_res.stderr.strip() or "Program crashed during execution."
        else:
            # Output comparison
            passed, first_diff, diagnostic, flag_review = compare_output(
                expected=tc.output,
                actual=run_res.stdout,
                mode=effective_mode,
                normalize_crlf=normalize_crlf,
                allow_one_final_newline_difference=allow_one_final_newline
            )
            if not passed:
                if first_diff and first_diff.is_final_newline_only:
                    failure_reason = "Trailing Newline Mismatch (Exact mode requires terminal newline match)"
                else:
                    failure_reason = "Wrong Answer (Output Mismatch)"

        if passed:
            passed_count += 1
        else:
            failed_count += 1

        # Check privacy: hide inputs/outputs for hidden tests if not in owner mode
        if tc.is_hidden and not is_owner:
            display_input = None
            display_expected = None
            display_actual = None
            display_exp_vis = None
            display_act_vis = None
            display_first_diff = None
            display_stderr = None
        else:
            display_input = tc.input
            display_expected = tc.output
            display_actual = run_res.stdout
            display_exp_vis = to_visible_whitespace(tc.output)
            display_act_vis = to_visible_whitespace(run_res.stdout)
            display_first_diff = first_diff
            display_stderr = run_res.stderr if run_res.stderr else None

        results.append(TestCaseResult(
            test_index=tc.index,
            is_hidden=tc.is_hidden,
            passed=passed,
            input=display_input,
            expected_output=display_expected,
            actual_output=display_actual,
            expected_visible=display_exp_vis,
            actual_visible=display_act_vis,
            failure_reason=failure_reason,
            first_difference=display_first_diff,
            diagnostic_message=diagnostic,
            duration_ms=run_res.duration_ms,
            stderr=display_stderr,
            timed_out=run_res.timed_out,
            exit_code=run_res.exit_code,
            newline_review_flag=flag_review,
            comparison_mode=effective_mode,
            is_final_newline_only=bool(first_diff and first_diff.is_final_newline_only)
        ))

    total = len(tests_to_run)
    all_passed = (passed_count == total and total > 0)
    summary = f"{passed_count} / {total} tests passed"

    return SubmitResult(
        bank_id=bank_id,
        question_id=question.question_id,
        total_tests=total,
        passed_tests=passed_count,
        failed_tests=failed_count,
        all_passed=all_passed,
        results=results,
        summary=summary,
        timestamp=datetime.utcnow().isoformat() + "Z",
        comparison_mode=effective_mode
    )
