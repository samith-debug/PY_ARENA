import io
import csv
import json
from typing import Dict, Any, List, Tuple
from backend.models.schema import QuestionBank, CompareResult, QuestionDiff

def compare_question_banks(bank1: QuestionBank, bank2: QuestionBank) -> CompareResult:
    """
    Compares two question banks by question ID, detecting added, removed,
    and modified fields (title, statement, constraints, reference solution,
    test cases count, expected outputs, visibility flags).
    """
    q_map_1 = {q.question_id: q for q in bank1.questions}
    q_map_2 = {q.question_id: q for q in bank2.questions}

    ids_1 = set(q_map_1.keys())
    ids_2 = set(q_map_2.keys())

    added_ids = sorted(list(ids_2 - ids_1))
    removed_ids = sorted(list(ids_1 - ids_2))
    common_ids = sorted(list(ids_1 & ids_2))

    modified_ids: List[str] = []
    identical_ids: List[str] = []
    diffs: List[QuestionDiff] = []

    # Added questions
    for qid in added_ids:
        q2 = q_map_2[qid]
        diffs.append(QuestionDiff(
            question_id=qid,
            diff_type="added",
            title_1=None,
            title_2=q2.title,
            changed_fields=["all"],
            field_diffs={
                "status": {"bank_1": "Not present", "bank_2": f"Added in {bank2.filename}"},
                "title": {"bank_1": None, "bank_2": q2.title},
                "test_count": {"bank_1": 0, "bank_2": len(q2.test_cases)}
            }
        ))

    # Removed questions
    for qid in removed_ids:
        q1 = q_map_1[qid]
        diffs.append(QuestionDiff(
            question_id=qid,
            diff_type="removed",
            title_1=q1.title,
            title_2=None,
            changed_fields=["all"],
            field_diffs={
                "status": {"bank_1": f"Present in {bank1.filename}", "bank_2": "Removed"},
                "title": {"bank_1": q1.title, "bank_2": None},
                "test_count": {"bank_1": len(q1.test_cases), "bank_2": 0}
            }
        ))

    # Compare common questions
    for qid in common_ids:
        q1 = q_map_1[qid]
        q2 = q_map_2[qid]

        changed_fields: List[str] = []
        field_diffs: Dict[str, Dict[str, Any]] = {}

        # 1. Title
        if q1.title != q2.title:
            changed_fields.append("title")
            field_diffs["title"] = {"bank_1": q1.title, "bank_2": q2.title}

        # 2. Problem Statement
        if q1.problem_statement != q2.problem_statement:
            changed_fields.append("problem_statement")
            field_diffs["problem_statement"] = {
                "bank_1": q1.problem_statement,
                "bank_2": q2.problem_statement
            }

        # 3. Constraints
        if (q1.constraints or "") != (q2.constraints or ""):
            changed_fields.append("constraints")
            field_diffs["constraints"] = {
                "bank_1": q1.constraints,
                "bank_2": q2.constraints
            }

        # 4. Reference solution
        if (q1.reference_solution or "") != (q2.reference_solution or ""):
            changed_fields.append("reference_solution")
            field_diffs["reference_solution"] = {
                "bank_1": q1.reference_solution,
                "bank_2": q2.reference_solution
            }

        # 5. Hints
        if q1.hints != q2.hints:
            changed_fields.append("hints")
            field_diffs["hints"] = {
                "bank_1": q1.hints,
                "bank_2": q2.hints
            }

        # 6. Test case count
        if len(q1.test_cases) != len(q2.test_cases):
            changed_fields.append("test_case_count")
            field_diffs["test_case_count"] = {
                "bank_1": len(q1.test_cases),
                "bank_2": len(q2.test_cases)
            }

        # 7. Test case content & expected outputs & visibility flags
        tc_changes = []
        min_tc = min(len(q1.test_cases), len(q2.test_cases))
        for i in range(min_tc):
            tc1 = q1.test_cases[i]
            tc2 = q2.test_cases[i]
            tc_diff = {}
            if tc1.input != tc2.input:
                tc_diff["input"] = {"bank_1": tc1.input, "bank_2": tc2.input}
            if tc1.output != tc2.output:
                tc_diff["output"] = {"bank_1": tc1.output, "bank_2": tc2.output}
            if tc1.is_hidden != tc2.is_hidden:
                tc_diff["is_hidden"] = {"bank_1": tc1.is_hidden, "bank_2": tc2.is_hidden}
            if tc_diff:
                tc_changes.append({"test_index": i + 1, "differences": tc_diff})

        if tc_changes:
            changed_fields.append("test_case_details")
            field_diffs["test_case_details"] = {
                "bank_1": f"{len(tc_changes)} test case(s) modified",
                "bank_2": tc_changes
            }

        if changed_fields:
            modified_ids.append(qid)
            diffs.append(QuestionDiff(
                question_id=qid,
                diff_type="modified",
                title_1=q1.title,
                title_2=q2.title,
                changed_fields=changed_fields,
                field_diffs=field_diffs
            ))
        else:
            identical_ids.append(qid)
            diffs.append(QuestionDiff(
                question_id=qid,
                diff_type="unchanged",
                title_1=q1.title,
                title_2=q2.title,
                changed_fields=[],
                field_diffs={}
            ))

    summary = {
        "bank_1_total": len(bank1.questions),
        "bank_2_total": len(bank2.questions),
        "added": len(added_ids),
        "removed": len(removed_ids),
        "modified": len(modified_ids),
        "identical": len(identical_ids)
    }

    return CompareResult(
        bank_1_id=bank1.id,
        bank_1_name=bank1.filename,
        bank_2_id=bank2.id,
        bank_2_name=bank2.filename,
        summary=summary,
        added_questions=added_ids,
        removed_questions=removed_ids,
        modified_questions=modified_ids,
        identical_questions=identical_ids,
        diffs=diffs,
        duplicate_ids_1=bank1.validation_report.duplicate_ids,
        duplicate_ids_2=bank2.validation_report.duplicate_ids
    )

def export_comparison_csv(compare_result: CompareResult) -> str:
    """
    Exports the comparison report as a CSV string.
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Question ID",
        "Diff Type",
        f"Title ({compare_result.bank_1_name})",
        f"Title ({compare_result.bank_2_name})",
        "Changed Fields",
        "Details"
    ])

    for diff in compare_result.diffs:
        writer.writerow([
            diff.question_id,
            diff.diff_type,
            diff.title_1 or "",
            diff.title_2 or "",
            ", ".join(diff.changed_fields),
            json.dumps(diff.field_diffs)
        ])

    return output.getvalue()
