import pytest
import io
import json
from backend.core.parser import parse_csv_content
from backend.core.comparator import compare_output, analyze_first_difference
from backend.core.sandbox import execute_code_sandboxed
from backend.core.test_runner import run_tests_for_question
from backend.core.comparator_csv import compare_question_banks

# 1. UTF-8 BOM
def test_utf8_bom_handling():
    content = '\ufeffquestion_id,title,problem_statement,test_cases\nQ1,Hello World,"Print hello","[]"'.encode('utf-8')
    bank = parse_csv_content(content, "bom_test.csv")
    assert len(bank.questions) == 1
    assert bank.questions[0].question_id == "Q1"
    assert bank.questions[0].title == "Hello World"

# 2. Quoted CSV fields containing commas
def test_quoted_commas():
    csv_str = 'question_id,title,problem_statement,test_cases\nQ2,"Title, with, commas","Problem, with, commas","[]"'
    bank = parse_csv_content(csv_str, "commas.csv")
    assert bank.questions[0].title == "Title, with, commas"
    assert bank.questions[0].problem_statement == "Problem, with, commas"

# 3. Multiline quoted fields
def test_multiline_quoted_fields():
    csv_str = '''question_id,title,problem_statement,test_cases
Q3,MultiLine,"Line 1
Line 2
Line 3","[]"'''
    bank = parse_csv_content(csv_str, "multiline.csv")
    assert "Line 1\nLine 2\nLine 3" in bank.questions[0].problem_statement

# 4. Escaped double quotes
def test_escaped_double_quotes():
    csv_str = '''question_id,title,problem_statement,test_cases
Q4,Quotes,"He said ""Hello World"" clearly","[]"'''
    bank = parse_csv_content(csv_str, "quotes.csv")
    assert 'He said "Hello World" clearly' == bank.questions[0].problem_statement

# 5. JSON test-case arrays inside CSV cells
def test_json_test_cases_array():
    raw_tc = json.dumps([
        {"input": "Alice", "output": "Hello Alice", "is_hidden": False},
        {"input": "Bob\nBuilder", "output": "Hello Bob\nBuilder", "is_hidden": True}
    ])
    # Escape quotes for CSV
    escaped_tc = raw_tc.replace('"', '""')
    csv_str = f'question_id,title,problem_statement,test_cases\nQ5,JSON Test,Desc,"{escaped_tc}"'
    bank = parse_csv_content(csv_str, "json_tc.csv")
    assert len(bank.questions[0].test_cases) == 2
    assert bank.questions[0].test_cases[0].input == "Alice"
    assert bank.questions[0].test_cases[1].is_hidden is True
    assert bank.visible_test_cases == 1
    assert bank.hidden_test_cases == 1

# 6. Empty stdin
def test_empty_stdin():
    code = "import sys\ncontent = sys.stdin.read()\nprint(f'Length: {len(content)}')"
    res = execute_code_sandboxed(code, stdin_data="")
    assert res.exit_code == 0
    assert res.stdout == "Length: 0\n"

# 7. Multiline stdin
def test_multiline_stdin():
    code = "import sys\nlines = sys.stdin.read().splitlines()\nprint(f'{len(lines)} lines')"
    res = execute_code_sandboxed(code, stdin_data="line1\nline2\nline3\n")
    assert res.exit_code == 0
    assert res.stdout == "3 lines\n"

# 8. Multiple test cases per question
def test_multiple_test_cases_runner():
    raw_tc = json.dumps([
        {"input": "1", "output": "2\n", "is_hidden": False},
        {"input": "5", "output": "10\n", "is_hidden": False},
        {"input": "10", "output": "20\n", "is_hidden": True}
    ])
    escaped_tc = raw_tc.replace('"', '""')
    csv_str = f'question_id,title,problem_statement,test_cases\nQ8,Multi Test,Desc,"{escaped_tc}"'
    bank = parse_csv_content(csv_str, "multi_tests.csv")
    q = bank.questions[0]
    
    code = "n = int(input())\nprint(n * 2)"
    # Run visible tests only
    sub_vis = run_tests_for_question(q, code, bank.id, run_all=False, is_owner=False)
    assert sub_vis.total_tests == 2
    assert sub_vis.all_passed is True

    # Run all tests
    sub_all = run_tests_for_question(q, code, bank.id, run_all=True, is_owner=True)
    assert sub_all.total_tests == 3
    assert sub_all.all_passed is True

# 9. Missing and duplicate question IDs
def test_missing_and_duplicate_ids():
    csv_str = '''question_id,title,problem_statement,test_cases
Q1,First,Desc,"[]"
Q1,Duplicate First,Desc,"[]"
,Missing ID,Desc,"[]"'''
    bank = parse_csv_content(csv_str, "ids_test.csv")
    assert "Q1" in bank.validation_report.duplicate_ids
    assert any("Missing Question ID" in s for s in bank.validation_report.missing_required_fields)

# 10. Invalid test-case JSON
def test_invalid_test_case_json():
    csv_str = 'question_id,title,problem_statement,test_cases\nQ10,Bad JSON,Desc,"[{invalid json here}"'
    bank = parse_csv_content(csv_str, "bad_json.csv")
    assert len(bank.validation_report.malformed_json_cells) == 1
    assert bank.validation_report.malformed_json_cells[0]["question_id"] == "Q10"
    assert len(bank.questions[0].validation_errors) > 0

# 11. Internal whitespace mismatch
def test_internal_whitespace_mismatch():
    expected = "Welcome, Rahul!"
    actual = "Welcome,  Rahul!"  # Two spaces
    passed, diff, diag, _ = compare_output(expected, actual)
    assert passed is False
    assert diff is not None
    assert diff.diff_type in ("whitespace_internal", "extra_space_before_punct", "char_mismatch")

# 12. Punctuation mismatch
def test_punctuation_mismatch_and_space_before_punct():
    expected = "Welcome, Rahul!"
    actual = "Welcome, Rahul !"
    passed, diff, diag, _ = compare_output(expected, actual)
    assert passed is False
    assert diff is not None
    assert diff.diff_type == "extra_space_before_punct"
    assert "Extra space before punctuation '!'" in diff.description

# 13. Leading/trailing spaces
def test_leading_trailing_spaces():
    expected = "Hello World"
    actual = " Hello World "
    passed, diff, diag, _ = compare_output(expected, actual)
    assert passed is False
    assert "whitespace" in diag.lower()

# 14. Missing final newline
def test_missing_final_newline():
    expected = "Line 1\nLine 2\n"
    actual = "Line 1\nLine 2"
    passed, diff, diag, _ = compare_output(expected, actual, newline_policy="exact")
    assert passed is False
    assert diff.diff_type in ("final_newline_only", "missing_newline")
    assert diff.is_final_newline_only is True

# 15. Extra blank line
def test_extra_blank_line():
    expected = "Result: 42\n"
    actual = "Result: 42\n\n"
    passed, diff, diag, _ = compare_output(expected, actual, newline_policy="exact")
    assert passed is False
    assert diff.diff_type == "extra_newline"

# 16. Python syntax errors
def test_python_syntax_error():
    code = "def foo(\n  return 42"
    res = execute_code_sandboxed(code)
    assert res.exit_code != 0
    assert "SyntaxError" in res.stderr

# 17. Runtime exceptions
def test_python_runtime_exception():
    code = "x = 1 / 0"
    res = execute_code_sandboxed(code)
    assert res.exit_code != 0
    assert "ZeroDivisionError" in res.stderr

# 18. Infinite-loop timeout
def test_infinite_loop_timeout():
    code = "while True:\n    pass"
    res = execute_code_sandboxed(code, timeout_seconds=1.0)
    assert res.timed_out is True
    assert res.exit_code == 124
    assert "TimeLimitExceeded" in res.stderr

# 19. Output-limit enforcement
def test_output_limit_enforcement():
    code = "print('A' * 100000)"
    res = execute_code_sandboxed(code, max_output_bytes=5000)
    assert res.truncated is True
    assert "[Output truncated" in res.stdout

# 20. Hidden-test privacy
def test_hidden_test_privacy():
    raw_tc = json.dumps([
        {"input": "SecretInput", "output": "SecretOutput", "is_hidden": True}
    ])
    escaped_tc = raw_tc.replace('"', '""')
    csv_str = f'question_id,title,problem_statement,test_cases\nQ20,Hidden Test,Desc,"{escaped_tc}"'
    bank = parse_csv_content(csv_str, "privacy.csv")
    q = bank.questions[0]
    
    # Run in student mode (is_owner=False)
    sub = run_tests_for_question(q, "print('WrongOutput')", bank.id, run_all=True, is_owner=False)
    assert len(sub.results) == 1
    res = sub.results[0]
    assert res.passed is False
    # Hidden details must NOT be leaked
    assert res.input is None
    assert res.expected_output is None
    assert res.actual_output is None
    assert res.first_difference is None

# 21. Multiple CSV versions comparison
def test_multiple_csv_comparison():
    csv1 = '''question_id,title,problem_statement,constraints,reference_solution,test_cases
M1,Banner,Hello world,None,print("hello"),"[]"
M2,To be removed,Desc,None,print("del"),"[]"'''

    csv2 = '''question_id,title,problem_statement,constraints,reference_solution,test_cases
M1,Banner Updated,Hello world revised,None,print("hello updated"),"[]"
M3,Added New,New question,None,print("new"),"[]"'''

    b1 = parse_csv_content(csv1, "v1.csv")
    b2 = parse_csv_content(csv2, "v2.csv")

    diff_report = compare_question_banks(b1, b2)
    assert "M3" in diff_report.added_questions
    assert "M2" in diff_report.removed_questions
    assert "M1" in diff_report.modified_questions
    m1_diff = next(d for d in diff_report.diffs if d.question_id == "M1")
    assert "title" in m1_diff.changed_fields
    assert "problem_statement" in m1_diff.changed_fields
    assert "reference_solution" in m1_diff.changed_fields

# 22. Reference solutions that contain backslashes and formatted strings
def test_reference_solution_backslashes():
    solution_code = '''msg = input().rstrip("\\r\\n")
L = len(msg)
border = "+" + "-" * (L + 2) + "+"
print(border)
print(f"| {msg} |")
print(border)
print(" \\\\")
'''
    res = execute_code_sandboxed(solution_code, stdin_data="Python")
    assert res.exit_code == 0
    assert " \\" in res.stdout
