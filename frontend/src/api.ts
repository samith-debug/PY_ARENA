import type {
  QuestionBankMeta,
  QuestionSummary,
  QuestionDetail,
  RunResult,
  SubmitResult,
  CompareResult,
  User,
  AuthResponse,
  UserProgressSummary
} from './types';

const API_BASE = '/api';
const TOKEN_KEY = 'codementor_auth_token';

// --- Token Storage Helpers ---
export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    console.error('Failed to store auth token:', e);
  }
}

export function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.error('Failed to clear auth token:', e);
  }
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// --- Auth Endpoints ---

export async function registerStudent(
  email: string,
  password: string,
  name?: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Registration failed');
  }
  const data: AuthResponse = await res.json();
  setStoredToken(data.token);
  return data;
}

export async function loginStudent(
  email: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Login failed');
  }
  const data: AuthResponse = await res.json();
  setStoredToken(data.token);
  return data;
}

export async function logoutStudent(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (e) {
    console.error('Logout error:', e);
  } finally {
    clearStoredToken();
  }
}

export async function fetchCurrentUser(): Promise<User | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      clearStoredToken();
      return null;
    }
    return res.json();
  } catch {
    return null;
  }
}

// --- User Progress & Drafts Sync ---

export async function fetchUserProgress(): Promise<UserProgressSummary | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/user/progress`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function saveUserProgressApi(params: {
  question_id: string;
  bank_id: string;
  status: 'passed' | 'failed' | 'attempted';
  code?: string;
  all_passed: boolean;
  passed_count: number;
  total_tests: number;
}): Promise<void> {
  const token = getStoredToken();
  if (!token) return;
  try {
    await fetch(`${API_BASE}/user/progress`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params)
    });
  } catch (e) {
    console.error('Failed to sync progress to server:', e);
  }
}

export async function saveUserDraftApi(
  question_id: string,
  bank_id: string,
  code: string
): Promise<void> {
  const token = getStoredToken();
  if (!token) return;
  try {
    await fetch(`${API_BASE}/user/draft`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ question_id, bank_id, code })
    });
  } catch (e) {
    console.error('Failed to sync draft to server:', e);
  }
}

export async function resetUserProgressApi(question_id: string): Promise<void> {
  const token = getStoredToken();
  if (!token) return;
  try {
    await fetch(`${API_BASE}/user/reset`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ question_id })
    });
  } catch (e) {
    console.error('Failed to reset question on server:', e);
  }
}

// --- Standard Curriculum & Sandbox API ---

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchBanks(): Promise<QuestionBankMeta[]> {
  const res = await fetch(`${API_BASE}/question-banks`);
  if (!res.ok) throw new Error('Failed to load question banks');
  return res.json();
}

export async function importBank(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/question-banks/import`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Failed to import CSV');
  }
  return res.json();
}

export async function fetchQuestions(
  bankId: string,
  difficulty?: string,
  search?: string
): Promise<QuestionSummary[]> {
  const params = new URLSearchParams();
  if (difficulty && difficulty !== 'All') params.append('difficulty', difficulty);
  if (search) params.append('search', search);

  const res = await fetch(`${API_BASE}/question-banks/${bankId}/questions?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch questions');
  return res.json();
}

export async function fetchQuestionDetail(
  bankId: string,
  questionId: string,
  isOwner: boolean = false,
  includeSolution: boolean = true
): Promise<QuestionDetail> {
  const params = new URLSearchParams();
  if (isOwner) params.append('is_owner', 'true');
  if (includeSolution) params.append('include_solution', 'true');

  const res = await fetch(
    `${API_BASE}/question-banks/${bankId}/questions/${questionId}?${params.toString()}`
  );
  if (!res.ok) throw new Error('Failed to fetch question details');
  return res.json();
}

export async function runCode(
  code: string,
  stdinData: string = '',
  executionMode: string = 'stdin/stdout',
  functionName?: string | null
): Promise<RunResult> {
  const res = await fetch(`${API_BASE}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      stdin_data: stdinData,
      execution_mode: executionMode,
      function_name: functionName
    })
  });
  if (!res.ok) throw new Error('Execution failed');
  return res.json();
}

export async function submitSolution(
  bankId: string,
  questionId: string,
  code: string,
  runAll: boolean = false,
  isOwner: boolean = false,
  comparisonMode: string = 'judge',
  normalizeCrlf: boolean = true
): Promise<SubmitResult> {
  const params = new URLSearchParams();
  if (isOwner) params.append('is_owner', 'true');

  const res = await fetch(`${API_BASE}/submit?${params.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bank_id: bankId,
      question_id: questionId,
      code,
      run_all: runAll,
      comparison_mode: comparisonMode,
      normalize_crlf: normalizeCrlf
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Validation failed');
  }
  return res.json();
}

export async function compareBanks(bank1Id: string, bank2Id: string): Promise<CompareResult> {
  const formData = new FormData();
  formData.append('bank_1_id', bank1Id);
  formData.append('bank_2_id', bank2Id);

  const res = await fetch(`${API_BASE}/question-banks/compare`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Comparison failed');
  }
  return res.json();
}

export function getExportBankUrl(bankId: string): string {
  return `${API_BASE}/question-banks/${bankId}/export/json`;
}

export function getExportValidationReportUrl(bankId: string, format: 'json' | 'csv'): string {
  return `${API_BASE}/question-banks/${bankId}/export/validation-report?format=${format}`;
}

export function getExportQuestionUrl(bankId: string, questionId: string): string {
  return `${API_BASE}/question-banks/${bankId}/questions/${questionId}/export`;
}
