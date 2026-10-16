from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class TestCase(BaseModel):
    index: int
    input: str
    output: str
    is_hidden: bool = False
    name: Optional[str] = None

class ValidationIssue(BaseModel):
    row_number: Optional[int] = None
    question_id: Optional[str] = None
    field: Optional[str] = None
    severity: str = "error"  # "error" or "warning"
    message: str

class ValidationReport(BaseModel):
    filename: str
    total_rows: int
    total_questions: int
    valid_questions: int
    total_test_cases: int
    visible_test_cases: int
    hidden_test_cases: int
    duplicate_ids: List[str] = []
    missing_required_fields: List[str] = []
    malformed_json_cells: List[Dict[str, Any]] = []
    issues: List[ValidationIssue] = []

class Question(BaseModel):
    question_id: str
    title: str
    module: Optional[str] = None
    difficulty: Optional[str] = "Easy"
    objective: Optional[str] = None
    problem_statement: str
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    constraints: Optional[str] = None
    sample_inputs: List[str] = []
    sample_outputs: List[str] = []
    hints: List[str] = []
    starter_code: Optional[str] = None
    reference_solution: Optional[str] = None
    execution_mode: str = "stdin/stdout"  # "stdin/stdout" or "function"
    function_name: Optional[str] = None
    test_cases: List[TestCase] = []
    extra_fields: Dict[str, Any] = {}
    validation_errors: List[str] = []
    validation_warnings: List[str] = []

class QuestionBank(BaseModel):
    id: str
    filename: str
    imported_at: str
    total_questions: int
    total_test_cases: int
    visible_test_cases: int
    hidden_test_cases: int
    questions: List[Question]
    validation_report: ValidationReport

class RunRequest(BaseModel):
    code: str
    stdin_data: str = ""
    timeout_seconds: float = 3.0
    execution_mode: str = "stdin/stdout"
    function_name: Optional[str] = None

class RunResult(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    duration_ms: float
    timed_out: bool = False
    truncated: bool = False
    error_message: Optional[str] = None

class DifferenceDetail(BaseModel):
    line_number: Optional[int] = None
    column_number: Optional[int] = None
    char_index: Optional[int] = None
    expected_char: Optional[str] = None
    actual_char: Optional[str] = None
    expected_repr: Optional[str] = None
    actual_repr: Optional[str] = None
    description: str
    diff_type: str  # "extra_space_before_punct", "whitespace_internal", "missing_space", "tab_space_mismatch", "newline_encoding", "casing_mismatch", "extra_newline", "missing_newline", "char_mismatch", "final_newline_only"
    is_final_newline_only: bool = False
    expected_visible: Optional[str] = None
    actual_visible: Optional[str] = None

class TestCaseResult(BaseModel):
    test_index: int
    is_hidden: bool
    passed: bool
    input: Optional[str] = None
    expected_output: Optional[str] = None
    actual_output: Optional[str] = None
    expected_visible: Optional[str] = None
    actual_visible: Optional[str] = None
    failure_reason: Optional[str] = None
    first_difference: Optional[DifferenceDetail] = None
    diagnostic_message: Optional[str] = None
    duration_ms: float
    stderr: Optional[str] = None
    timed_out: bool = False
    exit_code: int = 0
    newline_review_flag: Optional[str] = None
    comparison_mode: str = "judge"
    is_final_newline_only: bool = False

class SubmitRequest(BaseModel):
    bank_id: str
    question_id: str
    code: str
    run_all: bool = False  # If True, runs both visible and hidden tests
    comparison_mode: str = "judge"  # "judge" (Judge-compatible: allows at most 1 final newline) or "exact" (byte-for-byte)
    normalize_crlf: bool = True
    strict_newline_policy: Optional[str] = None  # Backward-compatible alias

class SubmitResult(BaseModel):
    bank_id: str
    question_id: str
    total_tests: int
    passed_tests: int
    failed_tests: int
    all_passed: bool
    results: List[TestCaseResult]
    summary: str
    timestamp: str
    comparison_mode: str = "judge"

class QuestionDiff(BaseModel):
    question_id: str
    diff_type: str  # "added", "removed", "modified", "unchanged"
    title_1: Optional[str] = None
    title_2: Optional[str] = None
    changed_fields: List[str] = []
    field_diffs: Dict[str, Dict[str, Any]] = {}

class CompareResult(BaseModel):
    bank_1_id: str
    bank_1_name: str
    bank_2_id: str
    bank_2_name: str
    summary: Dict[str, int]
    added_questions: List[str]
    removed_questions: List[str]
    modified_questions: List[str]
    identical_questions: List[str]
    diffs: List[QuestionDiff]
    duplicate_ids_1: List[str]
    duplicate_ids_2: List[str]

class UserRegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

class UserLoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    created_at: str

class AuthResponse(BaseModel):
    token: str
    user: UserResponse

class ProgressUpdateRequest(BaseModel):
    question_id: str
    bank_id: str
    status: str  # 'passed', 'failed', 'attempted'
    code: Optional[str] = None
    all_passed: bool = False
    passed_count: int = 0
    total_tests: int = 0

class DraftUpdateRequest(BaseModel):
    question_id: str
    bank_id: str
    code: str

class ResetQuestionRequest(BaseModel):
    question_id: str

class UserProgressStats(BaseModel):
    total_solved: int
    total_attempted: int
    passed_questions: List[str]

class UserProgressSummary(BaseModel):
    statuses: Dict[str, str]
    drafts: Dict[str, str]
    stats: UserProgressStats

