import os
import json
import io
import csv
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Header, Depends
from fastapi.responses import JSONResponse, Response, PlainTextResponse

from backend.models.schema import (
    QuestionBank,
    Question,
    RunRequest,
    RunResult,
    SubmitRequest,
    SubmitResult,
    CompareResult,
    UserRegisterRequest,
    UserLoginRequest,
    UserResponse,
    AuthResponse,
    ProgressUpdateRequest,
    DraftUpdateRequest,
    ResetQuestionRequest,
    UserProgressSummary
)
from backend.core.database import (
    create_user,
    authenticate_user,
    create_session,
    get_user_from_token,
    delete_session,
    save_user_progress,
    save_user_draft,
    reset_user_question,
    get_user_progress_summary
)
from backend.core.parser import parse_csv_content
from backend.core.sandbox import execute_code_sandboxed
from backend.core.test_runner import run_tests_for_question
from backend.core.comparator_csv import compare_question_banks, export_comparison_csv

router = APIRouter(prefix="/api")


# In-memory bank store with disk persistence fallback
BANKS: Dict[str, QuestionBank] = {}
STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage")
os.makedirs(STORAGE_DIR, exist_ok=True)

def save_bank_to_disk(bank: QuestionBank):
    try:
        path = os.path.join(STORAGE_DIR, f"{bank.id}.json")
        with open(path, "w", encoding="utf-8") as f:
            f.write(bank.model_dump_json(indent=2))
    except Exception as e:
        print(f"Failed to persist bank {bank.id} to disk: {e}")

def load_banks_from_disk():
    try:
        for fname in os.listdir(STORAGE_DIR):
            if fname.endswith(".json"):
                path = os.path.join(STORAGE_DIR, fname)
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    bank = QuestionBank(**data)
                    BANKS[bank.id] = bank
    except Exception as e:
        print(f"Error loading stored banks: {e}")

# Load stored banks at module load
load_banks_from_disk()

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "PyArena Practice Lab API",
        "version": "1.0.0",
        "loaded_banks": len(BANKS)
    }

@router.post("/question-banks/import", response_model=QuestionBank)
async def import_question_bank(
    file: UploadFile = File(...)
):
    try:
        content = await file.read()
        filename = file.filename or "uploaded_questions.csv"
        bank = parse_csv_content(content, filename)
        BANKS[bank.id] = bank
        save_bank_to_disk(bank)
        return bank
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")

@router.get("/question-banks")
def list_question_banks():
    return [
        {
            "id": b.id,
            "filename": b.filename,
            "imported_at": b.imported_at,
            "total_questions": b.total_questions,
            "total_test_cases": b.total_test_cases,
            "visible_test_cases": b.visible_test_cases,
            "hidden_test_cases": b.hidden_test_cases,
            "validation_report": b.validation_report
        }
        for b in BANKS.values()
    ]

@router.get("/question-banks/{bank_id}", response_model=QuestionBank)
def get_question_bank(bank_id: str):
    if bank_id not in BANKS:
        raise HTTPException(status_code=404, detail="Question bank not found")
    return BANKS[bank_id]

@router.get("/question-banks/{bank_id}/questions")
def list_questions(
    bank_id: str,
    difficulty: Optional[str] = None,
    search: Optional[str] = None
):
    if bank_id not in BANKS:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    bank = BANKS[bank_id]
    results = []

    for q in bank.questions:
        # Filter difficulty
        if difficulty and difficulty.lower() != "all":
            if (q.difficulty or "").lower() != difficulty.lower():
                continue

        # Filter search
        if search:
            s = search.lower()
            match_id = s in q.question_id.lower()
            match_title = s in q.title.lower()
            match_stmt = s in q.problem_statement.lower()
            match_obj = q.objective and s in q.objective.lower()
            if not (match_id or match_title or match_stmt or match_obj):
                continue

        results.append({
            "question_id": q.question_id,
            "title": q.title,
            "module": q.module,
            "difficulty": q.difficulty,
            "objective": q.objective,
            "execution_mode": q.execution_mode,
            "total_tests": len(q.test_cases),
            "visible_tests": sum(1 for t in q.test_cases if not t.is_hidden),
            "hidden_tests": sum(1 for t in q.test_cases if t.is_hidden),
            "has_starter_code": bool(q.starter_code),
            "has_reference_solution": bool(q.reference_solution),
            "has_validation_errors": len(q.validation_errors) > 0,
            "validation_errors": q.validation_errors,
            "validation_warnings": q.validation_warnings
        })

    return results

@router.get("/question-banks/{bank_id}/questions/{question_id}")
def get_question_details(
    bank_id: str,
    question_id: str,
    is_owner: bool = Query(False, description="Owner/Admin mode allows viewing hidden tests and solutions"),
    include_solution: bool = Query(True, description="Explicitly request reference solution"),
):
    if bank_id not in BANKS:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    bank = BANKS[bank_id]
    target_q = next((q for q in bank.questions if q.question_id == question_id), None)
    
    if not target_q:
        raise HTTPException(status_code=404, detail=f"Question '{question_id}' not found in bank '{bank_id}'")

    # Deep copy / prepare dict for response
    q_dict = target_q.model_dump()

    # Solution privacy: only omit if explicitly opted out and not in owner mode
    if not is_owner and include_solution is False:
        q_dict["reference_solution"] = None

    # Hidden tests privacy
    sanitized_tests = []
    for tc in target_q.test_cases:
        if tc.is_hidden and not is_owner:
            sanitized_tests.append({
                "index": tc.index,
                "input": None,
                "output": None,
                "is_hidden": True,
                "name": tc.name or f"Hidden Test #{tc.index}"
            })
        else:
            sanitized_tests.append(tc.model_dump())
    
    q_dict["test_cases"] = sanitized_tests
    return q_dict

@router.post("/run", response_model=RunResult)
def run_code_endpoint(payload: RunRequest):
    return execute_code_sandboxed(
        code=payload.code,
        stdin_data=payload.stdin_data,
        timeout_seconds=payload.timeout_seconds,
        execution_mode=payload.execution_mode,
        function_name=payload.function_name
    )

@router.post("/submit", response_model=SubmitResult)
def submit_code_endpoint(
    payload: SubmitRequest,
    is_owner: bool = Query(False, description="Enables running all hidden tests with full output inspection")
):
    if payload.bank_id not in BANKS:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    bank = BANKS[payload.bank_id]
    target_q = next((q for q in bank.questions if q.question_id == payload.question_id), None)
    
    if not target_q:
        raise HTTPException(status_code=404, detail=f"Question '{payload.question_id}' not found")

    # If run_all is requested, only allow full inspection if is_owner is True; otherwise run_all runs server-side with masked hidden outputs
    return run_tests_for_question(
        question=target_q,
        code=payload.code,
        bank_id=payload.bank_id,
        run_all=payload.run_all,
        is_owner=is_owner,
        comparison_mode=payload.comparison_mode,
        normalize_crlf=payload.normalize_crlf,
        strict_newline_policy=payload.strict_newline_policy
    )

@router.post("/question-banks/compare", response_model=CompareResult)
def compare_banks_endpoint(
    bank_1_id: str = Form(...),
    bank_2_id: str = Form(...)
):
    if bank_1_id not in BANKS or bank_2_id not in BANKS:
        raise HTTPException(status_code=404, detail="One or both question banks not found")

    bank1 = BANKS[bank_1_id]
    bank2 = BANKS[bank_2_id]
    return compare_question_banks(bank1, bank2)

@router.get("/question-banks/{bank_id}/export/json")
def export_bank_json(bank_id: str):
    if bank_id not in BANKS:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    bank = BANKS[bank_id]
    return JSONResponse(
        content=bank.model_dump(),
        headers={"Content-Disposition": f'attachment; filename="{bank.filename}_export.json"'}
    )

@router.get("/question-banks/{bank_id}/export/validation-report")
def export_validation_report(bank_id: str, format: str = Query("json")):
    if bank_id not in BANKS:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    bank = BANKS[bank_id]
    report = bank.validation_report

    if format == "csv":
        out = io.StringIO()
        writer = csv.writer(out)
        writer.writerow(["Row Number", "Question ID", "Field", "Severity", "Message"])
        for issue in report.issues:
            writer.writerow([
                issue.row_number or "",
                issue.question_id or "",
                issue.field or "",
                issue.severity,
                issue.message
            ])
        return Response(
            content=out.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{bank.filename}_validation_report.csv"'}
        )
    else:
        return JSONResponse(
            content=report.model_dump(),
            headers={"Content-Disposition": f'attachment; filename="{bank.filename}_validation_report.json"'}
        )

@router.get("/question-banks/{bank_id}/questions/{question_id}/export")
def export_single_question(bank_id: str, question_id: str):
    if bank_id not in BANKS:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    bank = BANKS[bank_id]
    q = next((item for item in bank.questions if item.question_id == question_id), None)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
        
    return JSONResponse(
        content=q.model_dump(),
        headers={"Content-Disposition": f'attachment; filename="{question_id}.json"'}
    )

# --- Authentication & Progress Tracking ---

def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization.split(" ", 1)[1].strip()
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
    return user

def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    return get_user_from_token(token)

@router.post("/auth/register", response_model=AuthResponse)
def register_student(req: UserRegisterRequest):
    email = req.email.strip()
    if not email or "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    if not req.password or len(req.password.strip()) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    try:
        user = create_user(email=email, password=req.password, name=req.name)
        token = create_session(user["id"])
        return {
            "token": token,
            "user": user
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@router.post("/auth/login", response_model=AuthResponse)
def login_student(req: UserLoginRequest):
    email = req.email.strip()
    if not email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    user = authenticate_user(email, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_session(user["id"])
    return {
        "token": token,
        "user": user
    }

@router.post("/auth/logout")
def logout_student(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        delete_session(token)
    return {"status": "success", "message": "Logged out successfully"}

@router.get("/auth/me", response_model=UserResponse)
def get_me(user: Dict[str, Any] = Depends(get_current_user)):
    return user

@router.get("/user/progress", response_model=UserProgressSummary)
def get_user_progress(user: Dict[str, Any] = Depends(get_current_user)):
    summary = get_user_progress_summary(user["id"])
    return summary

@router.post("/user/progress")
def update_user_progress(
    req: ProgressUpdateRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    save_user_progress(
        user_id=user["id"],
        question_id=req.question_id,
        bank_id=req.bank_id,
        status=req.status,
        code=req.code,
        all_passed=req.all_passed,
        passed_count=req.passed_count,
        total_tests=req.total_tests
    )
    return {"status": "success"}

@router.post("/user/draft")
def update_user_draft(
    req: DraftUpdateRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    save_user_draft(
        user_id=user["id"],
        question_id=req.question_id,
        bank_id=req.bank_id,
        code=req.code
    )
    return {"status": "success"}

@router.post("/user/reset")
def reset_user_question_state(
    req: ResetQuestionRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    reset_user_question(user_id=user["id"], question_id=req.question_id)
    return {"status": "success"}

