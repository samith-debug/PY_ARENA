import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.api.routes import router, BANKS, save_bank_to_disk
from backend.core.parser import parse_csv_content

app = FastAPI(
    title="CodeArena Practice Lab API",
    description="Multi-Language (Python & Java) Practice Lab, Sandboxed Execution Engine, and Test-Case Validation Workbench",
    version="2.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

# Preload sample question banks on startup if none exist yet
@app.on_event("startup")
def preload_sample_banks():
    sample_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sample_data")
    if os.path.exists(sample_dir):
        v1_path = os.path.join(sample_dir, "module_01_v1.csv")
        v2_path = os.path.join(sample_dir, "module_01_v2.csv")

        # Check if v1 already loaded
        already_loaded = any(b.filename in ("module_01_v1.csv", "module_01_introduction_to_python.csv") for b in BANKS.values())
        if not already_loaded and os.path.exists(v1_path):
            try:
                with open(v1_path, "rb") as f:
                    b1 = parse_csv_content(f.read(), "module_01_introduction_to_python.csv")
                    BANKS[b1.id] = b1
                    save_bank_to_disk(b1)
                    print(f"Preloaded sample bank: {b1.filename} ({b1.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload v1 sample: {e}")


        m2_path = os.path.join(sample_dir, "module_02_data_types_and_input_output.csv")
        if not os.path.exists(m2_path):
            m2_path = os.path.join(sample_dir, "m2.csv")
        already_loaded_m2 = any("module_02" in b.filename or b.filename == "m2.csv" for b in BANKS.values())
        if not already_loaded_m2 and os.path.exists(m2_path):
            try:
                with open(m2_path, "rb") as f:
                    b3 = parse_csv_content(f.read(), "module_02_data_types_and_input_output.csv")
                    BANKS[b3.id] = b3
                    save_bank_to_disk(b3)
                    print(f"Preloaded sample bank: {b3.filename} ({b3.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 2 sample: {e}")

        m3_path = os.path.join(sample_dir, "module_03_operators.csv")
        if not os.path.exists(m3_path):
            m3_path = os.path.join(sample_dir, "m3.csv")
        already_loaded_m3 = any("module_03" in b.filename or b.filename == "m3.csv" for b in BANKS.values())
        if not already_loaded_m3 and os.path.exists(m3_path):
            try:
                with open(m3_path, "rb") as f:
                    b4 = parse_csv_content(f.read(), "module_03_operators.csv")
                    BANKS[b4.id] = b4
                    save_bank_to_disk(b4)
                    print(f"Preloaded sample bank: {b4.filename} ({b4.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 3 sample: {e}")

        m4_path = os.path.join(sample_dir, "module_04_conditional_statements.csv")
        if not os.path.exists(m4_path):
            m4_path = os.path.join(sample_dir, "m4.csv")
        already_loaded_m4 = any("module_04" in b.filename or b.filename == "m4.csv" for b in BANKS.values())
        if not already_loaded_m4 and os.path.exists(m4_path):
            try:
                with open(m4_path, "rb") as f:
                    b5 = parse_csv_content(f.read(), "module_04_conditional_statements.csv")
                    BANKS[b5.id] = b5
                    save_bank_to_disk(b5)
                    print(f"Preloaded sample bank: {b5.filename} ({b5.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 4 sample: {e}")

        m5_path = os.path.join(sample_dir, "module_05_loops.csv")
        if not os.path.exists(m5_path):
            m5_path = os.path.join(sample_dir, "m5.csv")
        already_loaded_m5 = any("module_05" in b.filename or b.filename == "m5.csv" for b in BANKS.values())
        if not already_loaded_m5 and os.path.exists(m5_path):
            try:
                with open(m5_path, "rb") as f:
                    b6 = parse_csv_content(f.read(), "module_05_loops.csv")
                    BANKS[b6.id] = b6
                    save_bank_to_disk(b6)
                    print(f"Preloaded sample bank: {b6.filename} ({b6.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 5 sample: {e}")

        m6_path = os.path.join(sample_dir, "module_06_functions_i.csv")
        if not os.path.exists(m6_path):
            m6_path = os.path.join(sample_dir, "m6.csv")
        already_loaded_m6 = any("module_06" in b.filename or b.filename == "m6.csv" for b in BANKS.values())
        if not already_loaded_m6 and os.path.exists(m6_path):
            try:
                with open(m6_path, "rb") as f:
                    b7 = parse_csv_content(f.read(), "module_06_functions_i.csv")
                    BANKS[b7.id] = b7
                    save_bank_to_disk(b7)
                    print(f"Preloaded sample bank: {b7.filename} ({b7.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 6 sample: {e}")

        m7_path = os.path.join(sample_dir, "module_07_strings.csv")
        if not os.path.exists(m7_path):
            m7_path = os.path.join(sample_dir, "m7.csv")
        already_loaded_m7 = any("module_07" in b.filename or b.filename == "m7.csv" for b in BANKS.values())
        if not already_loaded_m7 and os.path.exists(m7_path):
            try:
                with open(m7_path, "rb") as f:
                    b8 = parse_csv_content(f.read(), "module_07_strings.csv")
                    BANKS[b8.id] = b8
                    save_bank_to_disk(b8)
                    print(f"Preloaded sample bank: {b8.filename} ({b8.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 7 sample: {e}")

        m8_path = os.path.join(sample_dir, "module_08_lists.csv")
        if not os.path.exists(m8_path):
            m8_path = os.path.join(sample_dir, "m8.csv")
        already_loaded_m8 = any("module_08" in b.filename or b.filename == "m8.csv" for b in BANKS.values())
        if not already_loaded_m8 and os.path.exists(m8_path):
            try:
                with open(m8_path, "rb") as f:
                    b9 = parse_csv_content(f.read(), "module_08_lists.csv")
                    BANKS[b9.id] = b9
                    save_bank_to_disk(b9)
                    print(f"Preloaded sample bank: {b9.filename} ({b9.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 8 sample: {e}")

        m9_path = os.path.join(sample_dir, "module_09_tuples_sets_dictionaries.csv")
        if not os.path.exists(m9_path):
            m9_path = os.path.join(sample_dir, "m9.csv")
        already_loaded_m9 = any("module_09" in b.filename or b.filename == "m9.csv" for b in BANKS.values())
        if not already_loaded_m9 and os.path.exists(m9_path):
            try:
                with open(m9_path, "rb") as f:
                    b10 = parse_csv_content(f.read(), "module_09_tuples_sets_dictionaries.csv")
                    BANKS[b10.id] = b10
                    save_bank_to_disk(b10)
                    print(f"Preloaded sample bank: {b10.filename} ({b10.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 9 sample: {e}")

        m10_path = os.path.join(sample_dir, "module_10_functions_ii_recursion_and_backtracking.csv")
        if not os.path.exists(m10_path):
            m10_path = os.path.join(sample_dir, "m10.csv")
        already_loaded_m10 = any("module_10" in b.filename or b.filename == "m10.csv" for b in BANKS.values())
        if not already_loaded_m10 and os.path.exists(m10_path):
            try:
                with open(m10_path, "rb") as f:
                    b11 = parse_csv_content(f.read(), "module_10_functions_ii_recursion_and_backtracking.csv")
                    BANKS[b11.id] = b11
                    save_bank_to_disk(b11)
                    print(f"Preloaded sample bank: {b11.filename} ({b11.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 10 sample: {e}")

        m11_path = os.path.join(sample_dir, "module_11_comprehensions_and_iteration_tools.csv")
        if not os.path.exists(m11_path):
            m11_path = os.path.join(sample_dir, "m11.csv")
        already_loaded_m11 = any("module_11" in b.filename or b.filename == "m11.csv" for b in BANKS.values())
        if not already_loaded_m11 and os.path.exists(m11_path):
            try:
                with open(m11_path, "rb") as f:
                    b12 = parse_csv_content(f.read(), "module_11_comprehensions_and_iteration_tools.csv")
                    BANKS[b12.id] = b12
                    save_bank_to_disk(b12)
                    print(f"Preloaded sample bank: {b12.filename} ({b12.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 11 sample: {e}")

        m12_path = os.path.join(sample_dir, "module_12_exceptions_and_debugging.csv")
        if not os.path.exists(m12_path):
            m12_path = os.path.join(sample_dir, "m12.csv")
        already_loaded_m12 = any("module_12" in b.filename or b.filename == "m12.csv" for b in BANKS.values())
        if not already_loaded_m12 and os.path.exists(m12_path):
            try:
                with open(m12_path, "rb") as f:
                    b13 = parse_csv_content(f.read(), "module_12_exceptions_and_debugging.csv")
                    BANKS[b13.id] = b13
                    save_bank_to_disk(b13)
                    print(f"Preloaded sample bank: {b13.filename} ({b13.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 12 sample: {e}")

        m13_path = os.path.join(sample_dir, "module_13_object_oriented_programming_i.csv")
        if not os.path.exists(m13_path):
            m13_path = os.path.join(sample_dir, "m13.csv")
        already_loaded_m13 = any("module_13" in b.filename or b.filename == "m13.csv" for b in BANKS.values())
        if not already_loaded_m13 and os.path.exists(m13_path):
            try:
                with open(m13_path, "rb") as f:
                    b14 = parse_csv_content(f.read(), "module_13_object_oriented_programming_i.csv")
                    BANKS[b14.id] = b14
                    save_bank_to_disk(b14)
                    print(f"Preloaded sample bank: {b14.filename} ({b14.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 13 sample: {e}")

        m14_path = os.path.join(sample_dir, "module_14_advanced_oop.csv")
        if not os.path.exists(m14_path):
            m14_path = os.path.join(sample_dir, "m14.csv")
        already_loaded_m14 = any("module_14" in b.filename or b.filename == "m14.csv" for b in BANKS.values())
        if not already_loaded_m14 and os.path.exists(m14_path):
            try:
                with open(m14_path, "rb") as f:
                    b15 = parse_csv_content(f.read(), "module_14_advanced_oop.csv")
                    BANKS[b15.id] = b15
                    save_bank_to_disk(b15)
                    print(f"Preloaded sample bank: {b15.filename} ({b15.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 14 sample: {e}")

        m15_path = os.path.join(sample_dir, "module_15_algorithmic_thinking_and_complexity.csv")
        if not os.path.exists(m15_path):
            m15_path = os.path.join(sample_dir, "m15.csv")
        already_loaded_m15 = any("module_15" in b.filename or b.filename == "m15.csv" for b in BANKS.values())
        if not already_loaded_m15 and os.path.exists(m15_path):
            try:
                with open(m15_path, "rb") as f:
                    b16 = parse_csv_content(f.read(), "module_15_algorithmic_thinking_and_complexity.csv")
                    BANKS[b16.id] = b16
                    save_bank_to_disk(b16)
                    print(f"Preloaded sample bank: {b16.filename} ({b16.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 15 sample: {e}")

        m16_path = os.path.join(sample_dir, "module_16_searching_and_sorting.csv")
        if not os.path.exists(m16_path):
            m16_path = os.path.join(sample_dir, "m16.csv")
        already_loaded_m16 = any("module_16" in b.filename or b.filename == "m16.csv" for b in BANKS.values())
        if not already_loaded_m16 and os.path.exists(m16_path):
            try:
                with open(m16_path, "rb") as f:
                    b17 = parse_csv_content(f.read(), "module_16_searching_and_sorting.csv")
                    BANKS[b17.id] = b17
                    save_bank_to_disk(b17)
                    print(f"Preloaded sample bank: {b17.filename} ({b17.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 16 sample: {e}")

        m17_path = os.path.join(sample_dir, "module_17_data_structures.csv")
        if not os.path.exists(m17_path):
            m17_path = os.path.join(sample_dir, "m17.csv")
        if not os.path.exists(m17_path):
            m17_path = os.path.join(sample_dir, "m17_detailed_descriptions.csv")
        already_loaded_m17 = any("module_17" in b.filename or "m17" in b.filename for b in BANKS.values())
        if not already_loaded_m17 and os.path.exists(m17_path):
            try:
                with open(m17_path, "rb") as f:
                    b18 = parse_csv_content(f.read(), "module_17_data_structures.csv")
                    BANKS[b18.id] = b18
                    save_bank_to_disk(b18)
                    print(f"Preloaded sample bank: {b18.filename} ({b18.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 17 sample: {e}")

        m18_path = os.path.join(sample_dir, "module_18_advanced_algorithms.csv")
        if not os.path.exists(m18_path):
            m18_path = os.path.join(sample_dir, "m18.csv")
        if not os.path.exists(m18_path):
            m18_path = os.path.join(sample_dir, "m18_detailed_descriptions.csv")
        already_loaded_m18 = any("module_18" in b.filename or "m18" in b.filename for b in BANKS.values())
        if not already_loaded_m18 and os.path.exists(m18_path):
            try:
                with open(m18_path, "rb") as f:
                    b19 = parse_csv_content(f.read(), "module_18_trees_and_heaps.csv")
                    BANKS[b19.id] = b19
                    save_bank_to_disk(b19)
                    print(f"Preloaded sample bank: {b19.filename} ({b19.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 18 sample: {e}")

        m19_path = os.path.join(sample_dir, "m19.csv")
        already_loaded_m19 = any("module_19" in b.filename or "m19" in b.filename for b in BANKS.values())
        if not already_loaded_m19 and os.path.exists(m19_path):
            try:
                with open(m19_path, "rb") as f:
                    b20 = parse_csv_content(f.read(), "module_19_graph_algorithms.csv")
                    BANKS[b20.id] = b20
                    save_bank_to_disk(b20)
                    print(f"Preloaded sample bank: {b20.filename} ({b20.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 19 sample: {e}")

        m20_path = os.path.join(sample_dir, "m20.csv")
        already_loaded_m20 = any("module_20" in b.filename or "m20" in b.filename for b in BANKS.values())
        if not already_loaded_m20 and os.path.exists(m20_path):
            try:
                with open(m20_path, "rb") as f:
                    b21 = parse_csv_content(f.read(), "module_20_greedy_and_dp.csv")
                    BANKS[b21.id] = b21
                    save_bank_to_disk(b21)
                    print(f"Preloaded sample bank: {b21.filename} ({b21.total_questions} questions)")
            except Exception as e:
                print(f"Failed to preload module 20 sample: {e}")

        # Preload Java modules if available
        root_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
        for search_dir in [sample_dir, root_dir]:
            if os.path.exists(search_dir):
                for fname in sorted(os.listdir(search_dir)):
                    if (fname.lower().startswith("jp_") or "java" in fname.lower()) and fname.endswith(".csv"):
                        if not any(b.filename == fname for b in BANKS.values()):
                            fpath = os.path.join(search_dir, fname)
                            try:
                                with open(fpath, "rb") as f:
                                    jbank = parse_csv_content(f.read(), fname)
                                    BANKS[jbank.id] = jbank
                                    save_bank_to_disk(jbank)
                                    print(f"Preloaded Java bank: {jbank.filename} ({jbank.total_questions} questions)")
                            except Exception as e:
                                print(f"Failed to preload Java bank {fname}: {e}")

# Mount frontend build if available
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist")
PUBLIC_DIAGRAMS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "public", "diagrams")
if os.path.exists(PUBLIC_DIAGRAMS):
    app.mount("/diagrams", StaticFiles(directory=PUBLIC_DIAGRAMS), name="diagrams")

if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
