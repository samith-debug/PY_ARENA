import string
from typing import Tuple, Optional
from backend.models.schema import DifferenceDetail

def to_visible_whitespace(text: Optional[str]) -> str:
    """
    Renders whitespace characters visible:
    - space ' ' -> '␠' (U+2420)
    - tab '\t' -> '⇥' (U+21E5)
    - newline '\n' -> '↵\n' (U+21B5)
    - carriage return '\r' -> '␍' (U+240D)
    """
    if text is None:
        return ""
    result = []
    for c in text:
        if c == ' ':
            result.append('␠')
        elif c == '\t':
            result.append('⇥')
        elif c == '\r':
            result.append('␍')
        elif c == '\n':
            result.append('↵\n')
        else:
            result.append(c)
    return "".join(result)

def format_line_visible(line: str) -> str:
    """
    Formats a single line with visible whitespace markers without appending literal \n.
    """
    return line.replace(' ', '␠').replace('\t', '⇥').replace('\r', '␍')

def analyze_first_difference(expected: str, actual: str) -> Optional[DifferenceDetail]:
    """
    Finds the exact first character or line difference between expected and actual strings,
    providing human-readable explanations and line/column indices.
    """
    if expected == actual:
        return None

    min_len = min(len(expected), len(actual))
    
    # Check if the only difference is exactly one final newline
    # Case 1: actual has one trailing \n and expected does not end with \n
    if actual == expected + '\n' and not expected.endswith('\n'):
        line_no = actual.count('\n', 0, len(expected)) + 1
        col_no = len(expected) - (actual.rfind('\n', 0, len(expected)) if '\n' in actual[:len(expected)] else -1)
        return DifferenceDetail(
            line_number=line_no,
            column_number=col_no,
            char_index=len(expected),
            expected_char=None,
            actual_char='\\n',
            expected_repr="EOF (no terminal newline)",
            actual_repr="\\n (terminal newline '↵')",
            description="Final-newline-only mismatch: actual output ends with a single terminal newline (\\n), whereas expected output ends without one.",
            diff_type="final_newline_only",
            is_final_newline_only=True,
            expected_visible=to_visible_whitespace(expected),
            actual_visible=to_visible_whitespace(actual)
        )

    # Case 2: expected has one trailing \n and actual does not end with \n
    if expected == actual + '\n' and not actual.endswith('\n'):
        line_no = expected.count('\n', 0, len(actual)) + 1
        col_no = len(actual) - (expected.rfind('\n', 0, len(actual)) if '\n' in expected[:len(actual)] else -1)
        return DifferenceDetail(
            line_number=line_no,
            column_number=col_no,
            char_index=len(actual),
            expected_char='\\n',
            actual_char=None,
            expected_repr="\\n (terminal newline '↵')",
            actual_repr="EOF (no terminal newline)",
            description="Final-newline-only mismatch: actual output is missing the final terminal newline (\\n).",
            diff_type="final_newline_only",
            is_final_newline_only=True,
            expected_visible=to_visible_whitespace(expected),
            actual_visible=to_visible_whitespace(actual)
        )

    # Find first differing character index
    diff_idx = -1
    for i in range(min_len):
        if expected[i] != actual[i]:
            diff_idx = i
            break
            
    if diff_idx == -1:
        # One string is a prefix of the other (multiple characters extra or missing)
        if len(actual) > len(expected):
            extra = actual[len(expected):]
            line_no = actual.count('\n', 0, len(expected)) + 1
            last_nl = actual.rfind('\n', 0, len(expected))
            col_no = len(expected) - last_nl if last_nl != -1 else len(expected) + 1
            
            if extra == '\n\n' or (actual.endswith('\n\n') and expected.endswith('\n')):
                return DifferenceDetail(
                    line_number=line_no,
                    column_number=col_no,
                    char_index=len(expected),
                    expected_char=None,
                    actual_char='\\n',
                    expected_repr="EOF",
                    actual_repr="\\n\\n (extra blank line)",
                    description="Actual output contains an extra blank line or multiple trailing newlines.",
                    diff_type="extra_newline",
                    is_final_newline_only=False,
                    expected_visible=to_visible_whitespace(expected),
                    actual_visible=to_visible_whitespace(actual)
                )
            elif extra.startswith(' '):
                return DifferenceDetail(
                    line_number=line_no,
                    column_number=col_no,
                    char_index=len(expected),
                    expected_char=None,
                    actual_char=' ',
                    expected_repr="EOF",
                    actual_repr=repr(extra),
                    description=f"Actual output has {len(extra)} extra trailing space(s) at end: '{format_line_visible(extra)}'",
                    diff_type="trailing_spaces",
                    is_final_newline_only=False,
                    expected_visible=to_visible_whitespace(expected),
                    actual_visible=to_visible_whitespace(actual)
                )
            else:
                return DifferenceDetail(
                    line_number=line_no,
                    column_number=col_no,
                    char_index=len(expected),
                    expected_char=None,
                    actual_char=extra[0],
                    expected_repr="EOF",
                    actual_repr=repr(extra[:20]),
                    description=f"Actual output contains {len(extra)} extra characters at end starting with {repr(extra[0])}",
                    diff_type="extra_trailing_content",
                    is_final_newline_only=False,
                    expected_visible=to_visible_whitespace(expected),
                    actual_visible=to_visible_whitespace(actual)
                )
        else:
            missing = expected[len(actual):]
            line_no = expected.count('\n', 0, len(actual)) + 1
            last_nl = expected.rfind('\n', 0, len(actual))
            col_no = len(actual) - last_nl if last_nl != -1 else len(actual) + 1
            
            return DifferenceDetail(
                line_number=line_no,
                column_number=col_no,
                char_index=len(actual),
                expected_char=missing[0],
                actual_char=None,
                expected_repr=repr(missing[:20]),
                actual_repr="EOF",
                description=f"Actual output truncated or missing {len(missing)} character(s): {repr(missing[:20])}",
                diff_type="missing_content",
                is_final_newline_only=False,
                expected_visible=to_visible_whitespace(expected),
                actual_visible=to_visible_whitespace(actual)
            )

    # Character mismatch at diff_idx
    exp_c = expected[diff_idx]
    act_c = actual[diff_idx]
    
    line_no = actual.count('\n', 0, diff_idx) + 1
    last_nl = actual.rfind('\n', 0, diff_idx)
    col_no = diff_idx - last_nl if last_nl != -1 else diff_idx + 1

    # Extract current line in both for context
    exp_line_start = expected.rfind('\n', 0, diff_idx)
    exp_line_start = 0 if exp_line_start == -1 else exp_line_start + 1
    exp_line_end = expected.find('\n', diff_idx)
    exp_line = expected[exp_line_start : exp_line_end if exp_line_end != -1 else len(expected)]

    act_line_start = actual.rfind('\n', 0, diff_idx)
    act_line_start = 0 if act_line_start == -1 else act_line_start + 1
    act_line_end = actual.find('\n', diff_idx)
    act_line = actual[act_line_start : act_line_end if act_line_end != -1 else len(actual)]

    exp_line_vis = format_line_visible(exp_line)
    act_line_vis = format_line_visible(act_line)

    # Heuristic 1: Extra space before punctuation (e.g., "Rahul !" vs "Rahul!")
    if act_c == ' ' and diff_idx + 1 < len(actual):
        if actual[diff_idx + 1] == exp_c:
            if exp_c in string.punctuation:
                return DifferenceDetail(
                    line_number=line_no,
                    column_number=col_no,
                    char_index=diff_idx,
                    expected_char=exp_c,
                    actual_char=' ',
                    expected_repr=repr(exp_c),
                    actual_repr="'␠' (space)",
                    description=f"Extra space before punctuation '{exp_c}' on line {line_no}. Expected '{exp_c}', found '␠{exp_c}'.",
                    diff_type="extra_space_before_punct",
                    is_final_newline_only=False,
                    expected_visible=to_visible_whitespace(expected),
                    actual_visible=to_visible_whitespace(actual)
                )
            else:
                return DifferenceDetail(
                    line_number=line_no,
                    column_number=col_no,
                    char_index=diff_idx,
                    expected_char=exp_c,
                    actual_char=' ',
                    expected_repr=repr(exp_c),
                    actual_repr="'␠' (space)",
                    description=f"Extra space inserted on line {line_no}, col {col_no}.",
                    diff_type="whitespace_internal",
                    is_final_newline_only=False,
                    expected_visible=to_visible_whitespace(expected),
                    actual_visible=to_visible_whitespace(actual)
                )

    # Heuristic 2: Missing expected space
    if exp_c == ' ' and diff_idx + 1 < len(expected):
        if expected[diff_idx + 1] == act_c:
            return DifferenceDetail(
                line_number=line_no,
                column_number=col_no,
                char_index=diff_idx,
                expected_char=' ',
                actual_char=act_c,
                expected_repr="'␠' (space)",
                actual_repr=repr(act_c),
                description=f"Missing expected space before '{act_c}' on line {line_no}, col {col_no}.",
                diff_type="missing_space",
                is_final_newline_only=False,
                expected_visible=to_visible_whitespace(expected),
                actual_visible=to_visible_whitespace(actual)
            )

    # Heuristic 3: Tabs vs spaces
    if (exp_c == '\t' and act_c == ' ') or (exp_c == ' ' and act_c == '\t'):
        exp_name = "tab (⇥)" if exp_c == '\t' else "space (␠)"
        act_name = "tab (⇥)" if act_c == '\t' else "space (␠)"
        return DifferenceDetail(
            line_number=line_no,
            column_number=col_no,
            char_index=diff_idx,
            expected_char=exp_c,
            actual_char=act_c,
            expected_repr="'⇥' (tab)" if exp_c == '\t' else "'␠' (space)",
            actual_repr="'⇥' (tab)" if act_c == '\t' else "'␠' (space)",
            description=f"Tab/space mismatch on line {line_no}, col {col_no}: expected {exp_name}, found {act_name}.",
            diff_type="tab_space_mismatch",
            is_final_newline_only=False,
            expected_visible=to_visible_whitespace(expected),
            actual_visible=to_visible_whitespace(actual)
        )

    # Heuristic 4: Trailing spaces on a specific line
    if (exp_c == '\n' and act_c == ' ') or (exp_c == ' ' and act_c == '\n'):
        return DifferenceDetail(
            line_number=line_no,
            column_number=col_no,
            char_index=diff_idx,
            expected_char=exp_c,
            actual_char=act_c,
            expected_repr="'↵' (newline)" if exp_c == '\n' else "'␠' (space)",
            actual_repr="'↵' (newline)" if act_c == '\n' else "'␠' (space)",
            description=f"Trailing spaces differ on line {line_no}. Expected line: \"{exp_line_vis}\" | Actual line: \"{act_line_vis}\"",
            diff_type="trailing_spaces_on_line",
            is_final_newline_only=False,
            expected_visible=to_visible_whitespace(expected),
            actual_visible=to_visible_whitespace(actual)
        )

    # Heuristic 5: Line breaks mismatch
    if exp_c == '\n' or act_c == '\n':
        return DifferenceDetail(
            line_number=line_no,
            column_number=col_no,
            char_index=diff_idx,
            expected_char=exp_c,
            actual_char=act_c,
            expected_repr="'↵' (newline)" if exp_c == '\n' else repr(exp_c),
            actual_repr="'↵' (newline)" if act_c == '\n' else repr(act_c),
            description=f"Line break mismatch on line {line_no}, col {col_no}.",
            diff_type="line_break_mismatch",
            is_final_newline_only=False,
            expected_visible=to_visible_whitespace(expected),
            actual_visible=to_visible_whitespace(actual)
        )

    # General character mismatch
    return DifferenceDetail(
        line_number=line_no,
        column_number=col_no,
        char_index=diff_idx,
        expected_char=exp_c,
        actual_char=act_c,
        expected_repr=repr(exp_c),
        actual_repr=repr(act_c),
        description=f"Character mismatch at line {line_no}, column {col_no}: expected '{format_line_visible(exp_c)}', got '{format_line_visible(act_c)}'.",
        diff_type="char_mismatch",
        is_final_newline_only=False,
        expected_visible=to_visible_whitespace(expected),
        actual_visible=to_visible_whitespace(actual)
    )

def compare_output(
    expected: str,
    actual: str,
    mode: str = "judge",
    normalize_crlf: bool = True,
    allow_one_final_newline_difference: Optional[bool] = None,
    newline_policy: Optional[str] = None
) -> Tuple[bool, Optional[DifferenceDetail], Optional[str], Optional[str]]:
    """
    Compares expected and actual outputs according to the required policy:
    1. Preserves all internal spaces, tabs, punctuation, and line breaks.
    2. Preserves leading and trailing spaces on individual lines.
    3. Does NOT use .strip() or .rstrip() on the entire output.
    4. Normalizes CRLF (\\r\\n) to LF (\\n) if normalize_crlf is True.
    5. Allows at most one final newline difference when mode == "judge":
       - 'Hello' vs 'Hello\\n' -> PASS
       - 'Hello\\n' vs 'Hello' -> PASS
       - 'Hello' vs 'Hello\\n\\n' -> FAIL
       - 'A\\nB\\n' vs 'A\\nB\\n\\n' -> FAIL
       - 'Hello  ' vs 'Hello' -> FAIL
    6. Exact mode requires identical character-for-character matching.

    Returns:
      (passed: bool, first_diff: Optional[DifferenceDetail], diagnostic: Optional[str], flag_review: Optional[str])
    """
    # Handle backward-compatible alias
    if newline_policy:
        if newline_policy == "strip_single_terminal_newline":
            mode = "judge"
        elif newline_policy == "exact":
            mode = "exact"

    # CRLF normalization if configured
    exp = expected.replace("\r\n", "\n") if normalize_crlf else expected
    act = actual.replace("\r\n", "\n") if normalize_crlf else actual

    # Check for fixture review flags
    flag_review = None
    if "\r" in expected and "\n" in expected:
        flag_review = "Expected fixture contains mixed CRLF/LF line terminators."
    elif not expected.endswith("\n") and "\n" in expected:
        flag_review = "Expected output contains multiline content but lacks a final terminal newline."

    # Exact match check
    if act == exp:
        return True, None, "Exact match.", flag_review

    # Check if the difference is AT MOST ONE final newline
    is_single_final_newline = False
    if act == exp + "\n" and not exp.endswith("\n"):
        is_single_final_newline = True
    elif exp == act + "\n" and not act.endswith("\n"):
        is_single_final_newline = True

    # Determine if one final newline difference is permitted
    if mode == "exact":
        one_final_newline_allowed = False
    elif allow_one_final_newline_difference is not None:
        one_final_newline_allowed = allow_one_final_newline_difference
    else:
        one_final_newline_allowed = (mode == "judge" or mode == "one_final_newline")

    passed = False
    if is_single_final_newline and one_final_newline_allowed:
        passed = True

    first_diff = analyze_first_difference(exp, act)

    # Diagnostic messages
    diagnostics = []
    if is_single_final_newline:
        if passed:
            diagnostics.append("Judge-compatible match: Content matches exactly; single final newline difference allowed.")
        else:
            diagnostics.append("Exact mode mismatch: Outputs differ solely by a single terminal newline.")
    elif exp.strip() == act.strip() and exp != act:
        diagnostics.append("Whitespace mismatch: Outputs would match under aggressive strip(), but strict comparison requires preserving whitespace.")

    if len(exp.splitlines()) != len(act.splitlines()):
        diagnostics.append(f"Line count: expected {len(exp.splitlines())} lines, got {len(act.splitlines())} lines.")

    if "\t" in act and "\t" not in exp:
        diagnostics.append("Actual output contains tab characters (⇥) where spaces were expected.")

    if first_diff:
        diagnostics.append(first_diff.description)

    diag_str = " | ".join(diagnostics) if diagnostics else "Outputs differ."

    return passed, first_diff, diag_str, flag_review
