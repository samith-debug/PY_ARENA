import csv
import io
import json
import re
from typing import List, Dict, Any, Tuple, Optional
from backend.models.schema import (
    Question,
    TestCase,
    QuestionBank,
    ValidationReport,
    ValidationIssue
)

COLUMN_ALIASES = {
    "question_id": ["question_id", "final_id", "id", "qid"],
    "title": ["title", "question_title", "name", "problem_name", "problem name"],
    "difficulty": ["difficulty", "level"],
    "objective": ["objective", "learning_objective", "learning_objectives", "category"],
    "problem_statement": ["problem_statement", "statement", "description", "problem", "question", "problem_description", "problem description"],
    "constraints": ["constraints", "constraint"],
    "sample_input": ["sample_input", "input_example", "sample_input_1", "sample input", "input"],
    "sample_output": ["sample_output", "output_example", "sample_output_1", "sample output", "output"],
    "starter_code": ["starter_code", "boilerplate_code", "boilerplate", "template_code", "template"],
    "reference_solution": ["reference_solution", "solution", "reference_code", "answer_code"],
    "test_cases": ["test_cases", "tests", "testcases"],
    "execution_mode": ["execution_mode", "mode"],
    "function_name": ["function_name", "entry_point"],
    "hints": ["hints", "progressive_hints"],
    "language": ["language", "lang", "programming_language"]
}

def resolve_field(row: Dict[str, str], canonical_name: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Finds the value for a canonical field based on aliases.
    Returns (value, matched_column_name).
    """
    aliases = COLUMN_ALIASES.get(canonical_name, [canonical_name])
    for col in row.keys():
        if not col or not isinstance(col, str):
            continue
        col_clean = col.strip().lower()
        for alias in aliases:
            if col_clean == alias.lower():
                val = row[col]
                return val, col
    return None, None

def parse_test_cases_cell(
    raw_val: str,
    row_number: int,
    col_name: str,
    question_id: str
) -> Tuple[List[TestCase], List[ValidationIssue]]:
    """
    Parses the JSON test cases cell.
    Does NOT silently replace malformed JSON with empty list.
    Reports row number, col name, question ID, and parse error.
    """
    issues: List[ValidationIssue] = []
    test_cases: List[TestCase] = []

    if not raw_val or not raw_val.strip():
        issues.append(ValidationIssue(
            row_number=row_number,
            question_id=question_id,
            field=col_name,
            severity="warning",
            message=f"Test cases cell is empty in row {row_number} (Question {question_id})."
        ))
        return test_cases, issues

    raw_str = raw_val.strip()

    try:
        parsed = json.loads(raw_str)
    except Exception as e:
        issues.append(ValidationIssue(
            row_number=row_number,
            question_id=question_id,
            field=col_name,
            severity="error",
            message=f"Invalid JSON in test-case cell at row {row_number}, column '{col_name}': {str(e)}"
        ))
        return test_cases, issues

    if not isinstance(parsed, list):
        issues.append(ValidationIssue(
            row_number=row_number,
            question_id=question_id,
            field=col_name,
            severity="error",
            message=f"Malformed test-case data at row {row_number}: Expected JSON array of objects, got {type(parsed).__name__}."
        ))
        return test_cases, issues

    for idx, item in enumerate(parsed):
        if not isinstance(item, dict):
            issues.append(ValidationIssue(
                row_number=row_number,
                question_id=question_id,
                field=col_name,
                severity="error",
                message=f"Test case #{idx + 1} in row {row_number} is not a JSON object: {repr(item)}"
            ))
            continue

        if "input" not in item:
            issues.append(ValidationIssue(
                row_number=row_number,
                question_id=question_id,
                field=col_name,
                severity="warning",
                message=f"Test case #{idx + 1} in row {row_number} is missing 'input' field. Assuming empty string."
            ))
            inp = ""
        else:
            inp = str(item["input"])

        if "output" not in item:
            issues.append(ValidationIssue(
                row_number=row_number,
                question_id=question_id,
                field=col_name,
                severity="error",
                message=f"Test case #{idx + 1} in row {row_number} is missing required 'output' field."
            ))
            continue
        else:
            out = str(item["output"])

        is_hidden = bool(item.get("is_hidden", False))
        name = item.get("name", None)

        test_cases.append(TestCase(
            index=idx + 1,
            input=inp,
            output=out,
            is_hidden=is_hidden,
            name=name
        ))

    return test_cases, issues

def parse_csv_content(csv_bytes_or_str: Any, filename: str) -> QuestionBank:
    """
    Parses CSV content supporting UTF-8, UTF-8 BOM, multiline cells, escaped quotes,
    column aliases, and JSON test cases.
    """
    if isinstance(csv_bytes_or_str, bytes):
        # Decode using utf-8-sig to automatically strip UTF-8 BOM if present
        text = csv_bytes_or_str.decode("utf-8-sig", errors="replace")
    else:
        text = str(csv_bytes_or_str)
        if text.startswith("\ufeff"):
            text = text[1:]

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("CSV file has no headers or is empty.")

    all_issues: List[ValidationIssue] = []
    questions: List[Question] = []
    seen_ids: Dict[str, int] = {}
    duplicate_ids: List[str] = []
    missing_required_fields: List[str] = []
    malformed_json_cells: List[Dict[str, Any]] = []

    total_rows = 0
    total_test_cases = 0
    visible_test_cases = 0
    hidden_test_cases = 0

    for row_idx, row in enumerate(reader, start=2):  # Header is row 1
        total_rows += 1
        row_issues: List[str] = []
        row_warnings: List[str] = []

        # Question ID
        qid, qid_col = resolve_field(row, "question_id")
        if not qid or not qid.strip():
            qid = f"ROW_{row_idx}"
            missing_required_fields.append(f"Row {row_idx}: Missing Question ID")
            row_issues.append(f"Row {row_idx}: Missing Question ID")
            all_issues.append(ValidationIssue(
                row_number=row_idx,
                question_id=qid,
                field="question_id",
                severity="error",
                message=f"Row {row_idx} has no Question ID."
            ))
        else:
            qid = qid.strip()

        # Check duplicate IDs
        if qid in seen_ids:
            duplicate_ids.append(qid)
            msg = f"Duplicate question ID '{qid}' found at row {row_idx} (previously seen at row {seen_ids[qid]})."
            row_issues.append(msg)
            all_issues.append(ValidationIssue(
                row_number=row_idx,
                question_id=qid,
                field="question_id",
                severity="error",
                message=msg
            ))
        else:
            seen_ids[qid] = row_idx

        # Title
        title, _ = resolve_field(row, "title")
        if not title or not title.strip():
            title = f"Untitled Question ({qid})"
            missing_required_fields.append(f"{qid}: Missing Title")
            row_warnings.append(f"Missing Title in row {row_idx}")
            all_issues.append(ValidationIssue(
                row_number=row_idx,
                question_id=qid,
                field="title",
                severity="warning",
                message="Missing title; using generated placeholder."
            ))
        else:
            title = title.strip()

        # Problem Statement
        statement, _ = resolve_field(row, "problem_statement")
        if not statement or not statement.strip():
            statement = "No problem statement provided in CSV."
            missing_required_fields.append(f"{qid}: Missing Problem Statement")
            row_warnings.append("Missing Problem Statement")
            all_issues.append(ValidationIssue(
                row_number=row_idx,
                question_id=qid,
                field="problem_statement",
                severity="warning",
                message="Missing problem statement."
            ))

        # Other canonical fields
        difficulty, _ = resolve_field(row, "difficulty")
        objective, _ = resolve_field(row, "objective")
        constraints, _ = resolve_field(row, "constraints")
        starter_code, _ = resolve_field(row, "starter_code")
        ref_solution, _ = resolve_field(row, "reference_solution")
        mode, _ = resolve_field(row, "execution_mode")
        func_name, _ = resolve_field(row, "function_name")
        raw_lang, _ = resolve_field(row, "language")

        # Specific formatting fields if present
        input_format = row.get("input_format") or row.get("input_specification")
        output_format = row.get("output_format") or row.get("output_specification")
        module_name = row.get("module") or row.get("module_name")

        # Detect language (explicit column or auto-detection from filename/code)
        if raw_lang and raw_lang.strip():
            lang = raw_lang.strip().lower()
        elif "java" in filename.lower() or (module_name and "java" in module_name.lower()):
            lang = "java"
        elif (ref_solution and any(k in ref_solution for k in ["public class", "class Solution", "System.out.print", "import java.", "Scanner sc"])) or \
             (starter_code and any(k in starter_code for k in ["public class", "class Solution", "System.out.print", "import java.", "Scanner sc"])):
            lang = "java"
        else:
            lang = "python"

        # Provide default starter code for Java if empty
        if lang == "java" and (not starter_code or not starter_code.strip()):
            starter_code = "import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n        \n    }\n}"

        # Samples / Examples
        sample_inputs: List[str] = []
        sample_outputs: List[str] = []
        
        # Check sample_input / sample_output aliases
        s_in, _ = resolve_field(row, "sample_input")
        s_out, _ = resolve_field(row, "sample_output")
        if s_in is not None: sample_inputs.append(s_in)
        if s_out is not None: sample_outputs.append(s_out)

        # Check numbered samples (sample_input_1, sample_input_2, ...)
        for i in range(1, 10):
            sin_key = f"sample_input_{i}"
            sout_key = f"sample_output_{i}"
            if sin_key in row and row[sin_key]:
                if row[sin_key] not in sample_inputs:
                    sample_inputs.append(row[sin_key])
            if sout_key in row and row[sout_key]:
                if row[sout_key] not in sample_outputs:
                    sample_outputs.append(row[sout_key])

        # Progressive hints
        hints: List[str] = []
        hints_raw, _ = resolve_field(row, "hints")
        if hints_raw and hints_raw.strip():
            # could be JSON or plain text
            try:
                parsed_hints = json.loads(hints_raw)
                if isinstance(parsed_hints, list):
                    hints.extend([str(h) for h in parsed_hints if h])
                else:
                    hints.append(str(parsed_hints))
            except Exception:
                hints.append(hints_raw.strip())

        # Also collect numbered hint columns (hint_1, hint_2, hint_3...)
        for i in range(1, 10):
            h_key = f"hint_{i}"
            if h_key in row and row[h_key] and row[h_key].strip():
                val = row[h_key].strip()
                if val not in hints:
                    hints.append(val)

        # Test cases
        tc_raw, tc_col = resolve_field(row, "test_cases")
        test_cases: List[TestCase] = []
        if tc_raw is not None:
            tc_list, tc_issues = parse_test_cases_cell(
                tc_raw,
                row_idx,
                tc_col or "test_cases",
                qid
            )
            test_cases = tc_list
            for issue in tc_issues:
                all_issues.append(issue)
                if issue.severity == "error":
                    row_issues.append(issue.message)
                    malformed_json_cells.append({
                        "row_number": row_idx,
                        "question_id": qid,
                        "column": tc_col,
                        "error": issue.message,
                        "raw_preview": tc_raw[:150]
                    })
                else:
                    row_warnings.append(issue.message)
        else:
            row_warnings.append("No test_cases column found.")
            all_issues.append(ValidationIssue(
                row_number=row_idx,
                question_id=qid,
                field="test_cases",
                severity="warning",
                message="No test_cases column found."
            ))

        # Fallback: if no test cases were parsed from JSON, but sample inputs/outputs exist, generate visible test cases
        if not test_cases and sample_inputs and sample_outputs:
            for s_idx, (s_in_val, s_out_val) in enumerate(zip(sample_inputs, sample_outputs)):
                test_cases.append(TestCase(
                    index=s_idx + 1,
                    input=s_in_val,
                    output=s_out_val,
                    is_hidden=False,
                    name=f"Sample Test Case {s_idx + 1}"
                ))

        total_test_cases += len(test_cases)
        vis_count = sum(1 for t in test_cases if not t.is_hidden)
        hid_count = sum(1 for t in test_cases if t.is_hidden)
        visible_test_cases += vis_count
        hidden_test_cases += hid_count

        # Preserve all extra columns
        matched_canonical_cols = set()
        for cname in COLUMN_ALIASES:
            _, mcol = resolve_field(row, cname)
            if mcol: matched_canonical_cols.add(mcol)
        
        extra_fields = {
            k: v for k, v in row.items() 
            if k and isinstance(k, str)
            and k not in matched_canonical_cols 
            and not k.startswith("hint_") 
            and not k.startswith("sample_input_") 
            and not k.startswith("sample_output_")
        }

        # Determine execution mode and function_name
        exec_mode = "stdin/stdout"
        if mode and ("func" in mode.lower() or "(" in mode):
            is_in_place = ("->None" in mode or "-> None" in mode)
            detailed_exc = bool(input_format and "<ExceptionName>: <message>" in input_format)
            with_cause = bool(input_format and "[cause:" in input_format)

            parts = ["function"]
            if is_in_place:
                parts.append("in_place")
            if detailed_exc:
                parts.append("detailed_exc")
            if with_cause:
                parts.append("with_cause")
            exec_mode = ":".join(parts)
        elif not mode and ref_solution and re.search(r'^\s*def\s+[a-zA-Z_]', ref_solution, re.MULTILINE):
            exec_mode = "function"

        if not func_name:
            if mode:
                m = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(', mode.strip())
                if m:
                    func_name = m.group(1)
            if not func_name and ref_solution:
                m = re.search(r'def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(', ref_solution)
                if m:
                    func_name = m.group(1)

        question = Question(
            question_id=qid,
            title=title,
            module=module_name,
            difficulty=difficulty or "Easy",
            objective=objective,
            problem_statement=statement,
            input_format=input_format,
            output_format=output_format,
            constraints=constraints,
            sample_inputs=sample_inputs,
            sample_outputs=sample_outputs,
            hints=hints,
            starter_code=starter_code,
            reference_solution=ref_solution,
            execution_mode=exec_mode,
            function_name=func_name,
            language=lang,
            test_cases=test_cases,
            extra_fields=extra_fields,
            validation_errors=row_issues,
            validation_warnings=row_warnings
        )
        questions.append(question)

    import uuid
    from datetime import datetime
    bank_id = str(uuid.uuid4())[:8]

    report = ValidationReport(
        filename=filename,
        total_rows=total_rows,
        total_questions=len(questions),
        valid_questions=sum(1 for q in questions if not q.validation_errors),
        total_test_cases=total_test_cases,
        visible_test_cases=visible_test_cases,
        hidden_test_cases=hidden_test_cases,
        duplicate_ids=list(set(duplicate_ids)),
        missing_required_fields=missing_required_fields,
        malformed_json_cells=malformed_json_cells,
        issues=all_issues
    )

    return QuestionBank(
        id=bank_id,
        filename=filename,
        imported_at=datetime.utcnow().isoformat() + "Z",
        total_questions=len(questions),
        total_test_cases=total_test_cases,
        visible_test_cases=visible_test_cases,
        hidden_test_cases=hidden_test_cases,
        questions=questions,
        validation_report=report,
        language="java" if ("java" in filename.lower() or any(q.language == "java" for q in questions)) else "python"
    )
