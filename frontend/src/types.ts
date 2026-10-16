export interface TestCase {
  index: number;
  input: string | null;
  output: string | null;
  is_hidden: boolean;
  name?: string | null;
}

export interface DifferenceDetail {
  line_number?: number;
  column_number?: number;
  char_index?: number;
  expected_char?: string;
  actual_char?: string;
  expected_repr?: string;
  actual_repr?: string;
  description: string;
  diff_type: string;
}

export interface TestCaseResult {
  test_index: number;
  is_hidden: boolean;
  passed: boolean;
  input?: string | null;
  expected_output?: string | null;
  actual_output?: string | null;
  expected_visible?: string | null;
  actual_visible?: string | null;
  failure_reason?: string | null;
  first_difference?: DifferenceDetail | null;
  diagnostic_message?: string | null;
  duration_ms: number;
  stderr?: string | null;
  timed_out: boolean;
  exit_code: number;
  newline_review_flag?: string | null;
  comparison_mode?: string;
  is_final_newline_only?: boolean;
}

export interface SubmitResult {
  bank_id: string;
  question_id: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  all_passed: boolean;
  results: TestCaseResult[];
  summary: string;
  timestamp: string;
  comparison_mode?: string;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
  timed_out: boolean;
  truncated: boolean;
  error_message?: string | null;
}

export interface QuestionSummary {
  question_id: string;
  title: string;
  module?: string | null;
  difficulty: string;
  objective?: string | null;
  execution_mode: string;
  total_tests: number;
  visible_tests: number;
  hidden_tests: number;
  has_starter_code: boolean;
  has_reference_solution: boolean;
  has_validation_errors: boolean;
  validation_errors: string[];
  validation_warnings: string[];
}

export interface QuestionDetail {
  question_id: string;
  title: string;
  module?: string | null;
  difficulty?: string;
  objective?: string | null;
  problem_statement: string;
  input_format?: string | null;
  output_format?: string | null;
  constraints?: string | null;
  sample_inputs: string[];
  sample_outputs: string[];
  hints: string[];
  starter_code?: string | null;
  reference_solution?: string | null;
  execution_mode: string;
  function_name?: string | null;
  test_cases: TestCase[];
  extra_fields: Record<string, any>;
  validation_errors: string[];
  validation_warnings: string[];
}

export interface ValidationIssue {
  row_number?: number;
  question_id?: string;
  field?: string;
  severity: string;
  message: string;
}

export interface ValidationReport {
  filename: string;
  total_rows: number;
  total_questions: number;
  valid_questions: number;
  total_test_cases: number;
  visible_test_cases: number;
  hidden_test_cases: number;
  duplicate_ids: string[];
  missing_required_fields: string[];
  malformed_json_cells: Array<{
    row_number: number;
    question_id: string;
    column: string;
    error: string;
    raw_preview: string;
  }>;
  issues: ValidationIssue[];
}

export interface QuestionBankMeta {
  id: string;
  filename: string;
  imported_at: string;
  total_questions: number;
  total_test_cases: number;
  visible_test_cases: number;
  hidden_test_cases: number;
  validation_report: ValidationReport;
}

export interface ModuleItem {
  bankId: string;
  filename: string;
  moduleName: string;
  moduleNumber: number;
  questions: QuestionSummary[];
}

export interface QuestionDiff {
  question_id: string;
  diff_type: "added" | "removed" | "modified" | "unchanged";
  title_1?: string | null;
  title_2?: string | null;
  changed_fields: string[];
  field_diffs: Record<string, any>;
}

export interface CompareResult {
  bank_1_id: string;
  bank_1_name: string;
  bank_2_id: string;
  bank_2_name: string;
  summary: {
    bank_1_total: number;
    bank_2_total: number;
    added: number;
    removed: number;
    modified: number;
    identical: number;
  };
  added_questions: string[];
  removed_questions: string[];
  modified_questions: string[];
  identical_questions: string[];
  diffs: QuestionDiff[];
  duplicate_ids_1: string[];
  duplicate_ids_2: string[];
}

export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface UserProgressStats {
  total_solved: number;
  total_attempted: number;
  passed_questions: string[];
}

export interface UserProgressSummary {
  statuses: Record<string, 'passed' | 'failed' | 'attempted'>;
  drafts: Record<string, string>;
  stats: UserProgressStats;
}

