# ⚡ PyArena

> **Modern 18-Module Python Practice Lab & Sandboxed Assessment Workbench**  
> An interactive, full-stack educational coding platform featuring sandboxed execution, real-time test case evaluation, cloud progress synchronization via Supabase PostgreSQL, and a Monaco-powered developer environment.

---

## ✨ Features

- **🎓 Comprehensive 18-Module Curriculum**:
  - Structured modules covering foundational Python to advanced algorithms.
  - Granular problem levels per module: **Easy**, **Medium**, and **Hard**.
  - Detailed problem descriptions, sample test inputs/outputs, constraints, and hints.

- **🛡️ Sandboxed Code Execution Engine**:
  - Secure, dedicated subprocess isolation with network restrictions and CPU time limits.
  - Fast execution runtime (<1ms overhead) with stdout/stderr capture and truncation defense.
  - Supports both standard I/O (`stdin/stdout`) and programmatic function call evaluations.

- **🧪 Test Case Validation Suite**:
  - Evaluates both visible and hidden test cases.
  - Precise diff comparison with newline/whitespace normalization.
  - Execution duration benchmarks and performance analytics per test run.

- **☁️ Cloud Student Accounts & Progress Sync (Supabase PostgreSQL)**:
  - User authentication with bcrypt password hashing and token-based sessions.
  - Instant cloud sync for solved question statuses, real-time accuracy, and code drafts.
  - Persistent code drafts across browser sessions and devices.

- **🎨 Minimalist Developer Workbench**:
  - Monaco Code Editor integration with syntax highlighting and bracket colorization.
  - In-module status filtering: Quick toggles for **All**, **Unsolved**, and **Solved** questions.
  - Problem status indicators: Green `</>` for solved problems, dark neutral for unsolved.
  - Clean, distraction-free matte dark UI.

---

## 🏗️ Architecture

```
pyarena/
├── backend/                  # FastAPI Application
│   ├── api/routes.py         # Auth, Question Banks, and Sandbox endpoints
│   ├── core/
│   │   ├── database.py       # Supabase PostgreSQL connection & schema
│   │   ├── sandbox.py        # Isolated Python runner orchestrator
│   │   ├── sandbox_worker.py # Low-level subprocess worker
│   │   ├── test_runner.py    # Test case evaluation logic
│   │   └── parser.py         # CSV Curriculum bank ingestion
│   ├── models/schema.py      # Pydantic models & DTOs
│   └── storage/              # Local curriculum cache
├── frontend/                 # React 19 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/       # Workbench panels (Sidebar, Editor, Output, Auth)
│   │   ├── api.ts            # Typed API client with auto-sync
│   │   └── App.tsx           # Main assessment workbench layout
│   └── index.html
├── sample_data/              # Full 18-Module CSV curriculum datasets
└── tests/                    # Backend regression and unit tests
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** & `npm`
- A **Supabase PostgreSQL** instance (or any compatible PostgreSQL database)

---

### 1. Backend Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/samith-debug/PY_ARENA.git
   cd PY_ARENA
   ```

2. **Create and activate a virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   Create a `.env` file in the root directory (refer to `.env.example`):
   ```env
   DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
   NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT].supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=[KEY]
   ```

5. **Start the FastAPI backend server**:
   ```bash
   python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   The backend API will be available at `http://127.0.0.1:8000`.  
   Interactive API docs: `http://127.0.0.1:8000/docs`.

---

### 2. Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   npm install
   ```

2. **Start the Vite development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

### 3. Running Tests

Run the backend test suite:
```bash
pytest tests/
```

---

## 🔒 Security & Sandbox Isolation

Code submitted to PyArena runs inside a sandboxed environment:
- **Network Block**: Socket initialization is strictly restricted.
- **Resource Constraints**: CPU execution limits enforced via `setrlimit`.
- **Ephemeral Workspaces**: Every run generates and immediately destroys a clean temporary scratch directory.

---

## 📄 License

This project is licensed under the MIT License.
