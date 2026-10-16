import os
import json
import csv
from typing import Dict, Any, List
from backend.core.parser import parse_csv_content
from backend.core.sandbox import execute_code_sandboxed
from backend.core.comparator import compare_output, to_visible_whitespace

def audit_question_bank(csv_path: str) -> Dict[str, Any]:
    with open(csv_path, "rb") as f:
        content = f.read()

    filename = os.path.basename(csv_path)
    bank = parse_csv_content(content, filename)

    total_questions = len(bank.questions)
    total_test_cases = sum(len(q.test_cases) for q in bank.questions)

    exact_passes = 0
    exact_fails = 0
    judge_passes = 0
    judge_fails = 0

    final_newline_only_count = 0
    genuine_content_mismatches = 0
    questions_requiring_review = []

    per_question_results = []

    for q in bank.questions:
        q_info = {
            "question_id": q.question_id,
            "title": q.title,
            "total_tests": len(q.test_cases),
            "ref_solution_present": bool(q.reference_solution),
            "exact_passed": 0,
            "judge_passed": 0,
            "final_newline_mismatches": 0,
            "content_mismatches": 0,
            "syntax_or_runtime_errors": 0,
            "test_details": []
        }

        if not q.reference_solution:
            questions_requiring_review.append({
                "question_id": q.question_id,
                "reason": "Missing reference solution in CSV"
            })
            per_question_results.append(q_info)
            continue

        for tc in q.test_cases:
            run_res = execute_code_sandboxed(
                code=q.reference_solution,
                stdin_data=tc.input,
                timeout_seconds=3.0,
                execution_mode=q.execution_mode,
                function_name=q.function_name
            )

            if run_res.exit_code != 0:
                exact_fails += 1
                judge_fails += 1
                q_info["syntax_or_runtime_errors"] += 1
                q_info["test_details"].append({
                    "test_index": tc.index,
                    "error": run_res.stderr.strip() or "Non-zero exit"
                })
                continue

            # Compare Exact mode
            pass_exact, diff_exact, _, _ = compare_output(
                expected=tc.output,
                actual=run_res.stdout,
                mode="exact",
                normalize_crlf=True
            )

            # Compare Judge-compatible mode
            pass_judge, diff_judge, _, _ = compare_output(
                expected=tc.output,
                actual=run_res.stdout,
                mode="judge",
                normalize_crlf=True
            )

            if pass_exact:
                exact_passes += 1
                q_info["exact_passed"] += 1
            else:
                exact_fails += 1

            if pass_judge:
                judge_passes += 1
                q_info["judge_passed"] += 1
            else:
                judge_fails += 1

            if diff_judge and diff_judge.is_final_newline_only:
                final_newline_only_count += 1
                q_info["final_newline_mismatches"] += 1
            elif not pass_judge:
                genuine_content_mismatches += 1
                q_info["content_mismatches"] += 1
                q_info["test_details"].append({
                    "test_index": tc.index,
                    "diff_type": diff_judge.diff_type if diff_judge else "unknown",
                    "description": diff_judge.description if diff_judge else "Content mismatch"
                })

        if q_info["content_mismatches"] > 0 or q_info["syntax_or_runtime_errors"] > 0:
            questions_requiring_review.append({
                "question_id": q.question_id,
                "reason": f"{q_info['content_mismatches']} content mismatches, {q_info['syntax_or_runtime_errors']} runtime errors."
            })

        per_question_results.append(q_info)

    return {
        "filename": filename,
        "total_questions": total_questions,
        "total_test_cases": total_test_cases,
        "exact_mode": {
            "passed": exact_passes,
            "failed": exact_fails,
            "pass_rate_pct": round((exact_passes / total_test_cases * 100), 2) if total_test_cases > 0 else 0
        },
        "judge_mode": {
            "passed": judge_passes,
            "failed": judge_fails,
            "pass_rate_pct": round((judge_passes / total_test_cases * 100), 2) if total_test_cases > 0 else 0
        },
        "final_newline_only_mismatches": final_newline_only_count,
        "genuine_content_mismatches": genuine_content_mismatches,
        "malformed_csv_json_records": len(bank.validation_report.malformed_json_cells),
        "questions_requiring_review": questions_requiring_review,
        "per_question_results": per_question_results
    }

if __name__ == "__main__":
    report_v1 = audit_question_bank("sample_data/module_01_v1.csv")
    print(json.dumps(report_v1, indent=2))
