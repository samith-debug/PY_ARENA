import os
import secrets
import hashlib
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

# Load .env if present
try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
    if os.path.exists(env_path):
        load_dotenv(env_path)
except Exception:
    pass

import re

DATABASE_URL = (
    os.environ.get("DATABASE_URL")
    or os.environ.get("Database_url")
    or os.environ.get("database_url")
    or os.environ.get("SUPABASE_DB_URL")
)

# Auto-convert direct Supabase URL to IPv4 pooler if needed (Vercel serverless has no IPv6 outbound routing)
if DATABASE_URL and "db.azttnwtsiirnqifcctlb.supabase.co" in DATABASE_URL:
    m = re.match(r"(postgresql?://)([^:]+):([^@]+)@db\.([a-zA-Z0-9]+)\.supabase\.co(?::5432)?(/.*)?", DATABASE_URL)
    if m:
        scheme, user, pwd, project_ref, path = m.groups()
        path = path or "/postgres"
        if "?" in path:
            path_part, query_part = path.split("?", 1)
            path = f"{path_part}?sslmode=require&{query_part}"
        else:
            path = f"{path}?sslmode=require"
        pooler_user = f"{user}.{project_ref}" if "." not in user else user
        DATABASE_URL = f"{scheme}{pooler_user}:{pwd}@aws-0-ap-south-1.pooler.supabase.com:5432{path}"
        print("🔄 Converted direct Supabase URL to IPv4 Pooler URL for serverless compatibility")

USE_POSTGRES = bool(DATABASE_URL and DATABASE_URL.startswith(("postgres://", "postgresql://")))

if USE_POSTGRES:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    print("🔌 Using Supabase / PostgreSQL cloud database")
else:
    import sqlite3
    # In serverless environments like Vercel, the filesystem is read-only except /tmp
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        DB_PATH = "/tmp/codearena.db"
    else:
        DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage", "codearena.db")
    print(f"💾 Using SQLite database ({DB_PATH})")

def get_connection():
    if USE_POSTGRES:
        # Supabase/PostgreSQL connection with 10s connect timeout
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor, connect_timeout=10)
        conn.autocommit = False
        return conn
    else:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def adapt_sql(sql: str) -> str:
    """Adapts standard SQL with ? parameter placeholders for Postgres (%s) if needed."""
    if USE_POSTGRES:
        return sql.replace("?", "%s")
    return sql

def init_db():
    if not USE_POSTGRES:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    conn = get_connection()
    cursor = conn.cursor()

    if USE_POSTGRES:
        # PostgreSQL / Supabase Schema
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            password_hash TEXT NOT NULL,
            salt VARCHAR(64) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token VARCHAR(128) PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ NOT NULL,
            last_active TIMESTAMPTZ NOT NULL
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_progress (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            question_id VARCHAR(100) NOT NULL,
            bank_id VARCHAR(100) NOT NULL,
            status VARCHAR(30) NOT NULL,
            all_passed INTEGER DEFAULT 0,
            passed_count INTEGER DEFAULT 0,
            total_tests INTEGER DEFAULT 0,
            code TEXT,
            updated_at TIMESTAMPTZ NOT NULL,
            UNIQUE(user_id, question_id)
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_drafts (
            user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            question_id VARCHAR(100) NOT NULL,
            bank_id VARCHAR(100) NOT NULL,
            code TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (user_id, question_id)
        );
        """)
    else:
        # SQLite Schema
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            last_active TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            question_id TEXT NOT NULL,
            bank_id TEXT NOT NULL,
            status TEXT NOT NULL,
            all_passed INTEGER DEFAULT 0,
            passed_count INTEGER DEFAULT 0,
            total_tests INTEGER DEFAULT 0,
            code TEXT,
            updated_at TEXT NOT NULL,
            UNIQUE(user_id, question_id),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_drafts (
            user_id INTEGER NOT NULL,
            question_id TEXT NOT NULL,
            bank_id TEXT NOT NULL,
            code TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, question_id),
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """)

    conn.commit()
    cursor.close()
    conn.close()

# Password hashing using standard PBKDF2-HMAC-SHA256
def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return hashed, salt

def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    hashed, _ = hash_password(password, salt)
    return secrets.compare_digest(hashed, stored_hash)

# User queries
def create_user(email: str, password: str, name: Optional[str] = None) -> Dict[str, Any]:
    email = email.strip().lower()
    if not name:
        name = email.split('@')[0].capitalize()
    
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(adapt_sql("SELECT id FROM users WHERE email = ?"), (email,))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        raise ValueError("An account with this email already exists")

    pwd_hash, salt = hash_password(password)
    now = datetime.now(timezone.utc).isoformat()

    if USE_POSTGRES:
        cursor.execute(
            "INSERT INTO users (email, name, password_hash, salt, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (email, name, pwd_hash, salt, now)
        )
        user_id = cursor.fetchone()["id"]
    else:
        cursor.execute(
            "INSERT INTO users (email, name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)",
            (email, name, pwd_hash, salt, now)
        )
        user_id = cursor.lastrowid

    conn.commit()
    cursor.close()
    conn.close()

    return {
        "id": user_id,
        "email": email,
        "name": name,
        "created_at": now
    }

def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    email = email.strip().lower()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(adapt_sql("SELECT id, email, name, password_hash, salt, created_at FROM users WHERE email = ?"), (email,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        return None

    if verify_password(password, row["password_hash"], row["salt"]):
        return {
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "created_at": str(row["created_at"])
        }
    return None

def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        adapt_sql("INSERT INTO sessions (token, user_id, created_at, last_active) VALUES (?, ?, ?, ?)"),
        (token, user_id, now, now)
    )
    conn.commit()
    cursor.close()
    conn.close()
    return token

def get_user_from_token(token: str) -> Optional[Dict[str, Any]]:
    if not token:
        return None
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(adapt_sql("""
        SELECT u.id, u.email, u.name, u.created_at, s.token
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ?
    """), (token,))
    row = cursor.fetchone()
    if row:
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute(adapt_sql("UPDATE sessions SET last_active = ? WHERE token = ?"), (now, token))
        conn.commit()
        user_data = {
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "created_at": str(row["created_at"])
        }
        cursor.close()
        conn.close()
        return user_data
    cursor.close()
    conn.close()
    return None

def delete_session(token: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(adapt_sql("DELETE FROM sessions WHERE token = ?"), (token,))
    conn.commit()
    cursor.close()
    conn.close()

# Progress tracking
def save_user_progress(
    user_id: int,
    question_id: str,
    bank_id: str,
    status: str,
    code: Optional[str] = None,
    all_passed: bool = False,
    passed_count: int = 0,
    total_tests: int = 0
):
    now = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(adapt_sql("""
        INSERT INTO user_progress (user_id, question_id, bank_id, status, all_passed, passed_count, total_tests, code, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, question_id) DO UPDATE SET
            status = excluded.status,
            all_passed = excluded.all_passed,
            passed_count = excluded.passed_count,
            total_tests = excluded.total_tests,
            code = COALESCE(excluded.code, user_progress.code),
            updated_at = excluded.updated_at
    """), (user_id, question_id, bank_id, status, 1 if all_passed else 0, passed_count, total_tests, code, now))
    conn.commit()
    cursor.close()
    conn.close()

def save_user_draft(user_id: int, question_id: str, bank_id: str, code: str):
    now = datetime.now(timezone.utc).isoformat()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(adapt_sql("""
        INSERT INTO user_drafts (user_id, question_id, bank_id, code, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, question_id) DO UPDATE SET
            code = excluded.code,
            bank_id = excluded.bank_id,
            updated_at = excluded.updated_at
    """), (user_id, question_id, bank_id, code, now))
    conn.commit()
    cursor.close()
    conn.close()

def reset_user_question(user_id: int, question_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(adapt_sql("DELETE FROM user_progress WHERE user_id = ? AND question_id = ?"), (user_id, question_id))
    cursor.execute(adapt_sql("DELETE FROM user_drafts WHERE user_id = ? AND question_id = ?"), (user_id, question_id))
    conn.commit()
    cursor.close()
    conn.close()

def get_user_progress_summary(user_id: int) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute(adapt_sql("SELECT question_id, bank_id, status, all_passed, passed_count, total_tests, code, updated_at FROM user_progress WHERE user_id = ?"), (user_id,))
    progress_rows = cursor.fetchall()
    
    statuses: Dict[str, str] = {}
    passed_questions: List[str] = []
    
    for row in progress_rows:
        statuses[row["question_id"]] = row["status"]
        if row["status"] == "passed":
            passed_questions.append(row["question_id"])

    cursor.execute(adapt_sql("SELECT question_id, bank_id, code, updated_at FROM user_drafts WHERE user_id = ?"), (user_id,))
    draft_rows = cursor.fetchall()
    drafts: Dict[str, str] = {}
    for row in draft_rows:
        drafts[row["question_id"]] = row["code"]

    cursor.close()
    conn.close()

    return {
        "statuses": statuses,
        "drafts": drafts,
        "stats": {
            "total_solved": len(passed_questions),
            "total_attempted": len(statuses),
            "passed_questions": passed_questions
        }
    }

# Run init on import safely
try:
    init_db()
except Exception as e:
    print(f"⚠️ init_db warning (will retry on first query): {e}")

