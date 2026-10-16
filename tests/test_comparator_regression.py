import pytest
from backend.core.comparator import compare_output, to_visible_whitespace

@pytest.mark.parametrize("expected,actual,exact_expected,judge_expected", [
    ("Hello", "Hello", True, True),
    ("Hello", "Hello\n", False, True),
    ("Hello\n", "Hello", False, True),
    ("Hello", "Hello\n\n", False, False),
    ("Hello", "Hello  ", False, False),
    ("Welcome, Rahul!", "Welcome, Rahul !", False, False),
    ("A\nB", "A\nC", False, False),
    ("A\nB\n", "A\nB\n\n", False, False),
])
def test_required_regression_table(expected, actual, exact_expected, judge_expected):
    """
    Validates the exact regression matrix specified in Section 6.
    """
    # Test Exact mode
    passed_exact, diff_exact, _, _ = compare_output(expected, actual, mode="exact")
    assert passed_exact == exact_expected, f"Failed exact mode for ({expected!r}, {actual!r}): got {passed_exact}"

    # Test Judge-compatible (one-final-newline) mode
    passed_judge, diff_judge, _, _ = compare_output(expected, actual, mode="judge")
    assert passed_judge == judge_expected, f"Failed judge mode for ({expected!r}, {actual!r}): got {passed_judge}"

def test_crlf_vs_lf():
    # With CRLF normalization (default)
    exp = "Line 1\r\nLine 2\r\n"
    act = "Line 1\nLine 2\n"
    passed, _, _, _ = compare_output(exp, act, mode="exact", normalize_crlf=True)
    assert passed is True

    # Without CRLF normalization
    passed_strict, diff, _, _ = compare_output(exp, act, mode="exact", normalize_crlf=False)
    assert passed_strict is False
    assert diff is not None

def test_empty_expected_and_actual():
    # Both empty
    passed, _, _, _ = compare_output("", "", mode="exact")
    assert passed is True

    # Empty expected vs single newline actual
    passed_exact, _, _, _ = compare_output("", "\n", mode="exact")
    assert passed_exact is False
    passed_judge, diff, _, _ = compare_output("", "\n", mode="judge")
    assert passed_judge is True
    assert diff.is_final_newline_only is True

    # Empty expected vs double newline actual
    passed_j2, _, _, _ = compare_output("", "\n\n", mode="judge")
    assert passed_j2 is False

def test_multiline_output_with_internal_exactness():
    exp = "+---+\n| A |\n+---+"
    act = "+---+\n| A |\n+---+\n"
    
    # Judge mode allows the single final newline
    passed_j, _, _, _ = compare_output(exp, act, mode="judge")
    assert passed_j is True

    # But any internal space difference must FAIL even in judge mode
    act_bad = "+---+\n| A  |\n+---+\n"
    passed_bad, diff_bad, _, _ = compare_output(exp, act_bad, mode="judge")
    assert passed_bad is False
    assert diff_bad.diff_type in ("trailing_spaces_on_line", "whitespace_internal", "char_mismatch", "extra_space_before_punct")

def test_leading_spaces():
    exp = "  Hello"
    act = " Hello"
    passed, diff, _, _ = compare_output(exp, act, mode="judge")
    assert passed is False
    assert diff.line_number == 1
    assert diff.column_number == 2

def test_tabs_vs_spaces():
    exp = "\tValue"
    act = "    Value"
    passed, diff, _, _ = compare_output(exp, act, mode="judge")
    assert passed is False
    assert diff.diff_type == "tab_space_mismatch"
    assert "tab" in diff.description.lower()

def test_unicode_characters():
    exp = "Total: ₹500 👍"
    act = "Total: ₹500 👍\n"
    passed_j, _, _, _ = compare_output(exp, act, mode="judge")
    assert passed_j is True

    act_wrong = "Total: ₹500 👎\n"
    passed_wrong, diff, _, _ = compare_output(exp, act_wrong, mode="judge")
    assert passed_wrong is False

def test_multiple_trailing_blank_lines():
    exp = "Done"
    act = "Done\n\n\n"
    passed, diff, _, _ = compare_output(exp, act, mode="judge")
    assert passed is False
    assert diff.is_final_newline_only is False

def test_visible_whitespace_formatting():
    raw = "Name:  Arjun\t123\r\nEnd"
    vis = to_visible_whitespace(raw)
    assert "␠␠" in vis  # Two spaces visible
    assert "⇥" in vis    # Tab visible
    assert "␍" in vis    # Carriage return visible
    assert "↵\n" in vis  # Newline visible
