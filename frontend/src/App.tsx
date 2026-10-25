import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchBanks,
  importBank,
  fetchQuestions,
  fetchQuestionDetail,
  runCode,
  submitSolution,
  fetchCurrentUser,
  logoutStudent,
  fetchUserProgress,
  saveUserProgressApi,
  saveUserDraftApi,
  resetUserProgressApi
} from './api';
import type {
  QuestionBankMeta,
  QuestionSummary,
  QuestionDetail,
  SubmitResult,
  RunResult,
  ModuleItem,
  User
} from './types';
import { Sidebar } from './components/Sidebar';
import { ProblemView } from './components/ProblemView';
import { EditorPanel } from './components/EditorPanel';
import { OutputPanel } from './components/OutputPanel';
import { CompareModal } from './components/CompareModal';
import { ValidationReportModal } from './components/ValidationReportModal';
import { AuthModal } from './components/AuthModal';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Code,
  Terminal,
  FileText,
  Trophy,
  LogOut,
  LogIn
} from 'lucide-react';

export const App: React.FC = () => {
  // Authentication & Student state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const serverDraftsRef = React.useRef<Record<string, string>>({});

  const isOwnerMode = false;

  // Banks & Curriculum state
  const [activeCourse, setActiveCourse] = useState<'python' | 'java'>('python');
  const [banks, setBanks] = useState<QuestionBankMeta[]>([]);
  const [curriculumModules, setCurriculumModules] = useState<ModuleItem[]>([]);
  const [isLoadingCurriculum, setIsLoadingCurriculum] = useState<boolean>(false);
  const [currentBankId, setCurrentBankId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [questionDetail, setQuestionDetail] = useState<QuestionDetail | null>(null);

  // Editor & Sandbox state
  const [selectedLanguage, setSelectedLanguage] = useState<'python' | 'java'>('python');
  const [code, setCode] = useState<string>('');
  const [customStdin, setCustomStdin] = useState<string>('');
  const [strictNewlinePolicy] = useState<string>('judge');
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Output & Test Results state
  const [activeOutputTab, setActiveOutputTab] = useState<'tests' | 'console'>('tests');
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [questionStatuses, setQuestionStatuses] = useState<
    Record<string, 'passed' | 'failed' | 'attempted'>
  >(() => {
    try {
      const saved = localStorage.getItem('codementor_question_statuses');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Mobile / Small Screen tab mode
  const [mobileTab, setMobileTab] = useState<'problem' | 'editor' | 'output'>('problem');

  // Modals
  const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);
  const [isValidationOpen, setIsValidationOpen] = useState<boolean>(false);

  // Helper to format clean module name from filename
  const formatBankTitle = (filename: string): string => {
    const clean = filename.replace(/\.csv$/i, '');
    const match = clean.match(/^module[_\s]*0?(\d+)[_\s]*(.*)$/i);
    if (match) {
      const num = match[1].padStart(2, '0');
      const rest = match[2]
        .split(/[_\-\s]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return `Module ${num}: ${rest || 'Workbench'}`;
    }
    return clean.replace(/[_\-]+/g, ' ');
  };

  // Check student authentication and load cloud progress on start
  useEffect(() => {
    const checkAuthAndLoadProgress = async () => {
      try {
        const user = await fetchCurrentUser();
        if (user) {
          setCurrentUser(user);
          const prog = await fetchUserProgress();
          if (prog) {
            setQuestionStatuses(prog.statuses);
            serverDraftsRef.current = prog.drafts;
            try {
              localStorage.setItem('codementor_question_statuses', JSON.stringify(prog.statuses));
            } catch (e) {
              console.error('Failed to sync to local storage:', e);
            }
          }
        } else {
          // Prompt login/register immediately so student enters email and creates password to access course
          setIsAuthModalOpen(true);
        }
      } catch (e) {
        console.error('Auth verification error:', e);
        setIsAuthModalOpen(true);
      }
    };
    checkAuthAndLoadProgress();
  }, []);

  // When a student logs in or registers successfully
  const handleAuthSuccess = async (user: User) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    try {
      const prog = await fetchUserProgress();
      if (prog) {
        setQuestionStatuses(prog.statuses);
        serverDraftsRef.current = prog.drafts;
        try {
          localStorage.setItem('codementor_question_statuses', JSON.stringify(prog.statuses));
        } catch (e) {
          console.error('Failed to sync to local storage:', e);
        }
        if (selectedQuestionId && prog.drafts[selectedQuestionId]) {
          setCode(prog.drafts[selectedQuestionId]);
        }
      }
    } catch (e) {
      console.error('Failed to load user progress after login:', e);
    }
  };

  // Sign out student
  const handleSignOut = async () => {
    await logoutStudent();
    setCurrentUser(null);
    setIsAuthModalOpen(true);
  };

  // Load curriculum modules for all banks
  const loadCurriculum = useCallback(async (bankList: QuestionBankMeta[]) => {
    if (bankList.length === 0) {
      setCurriculumModules([]);
      return;
    }
    setIsLoadingCurriculum(true);
    try {
      const sortedBanks = [...bankList].sort((a, b) => {
        const getNum = (name: string) => {
          const m = name.match(/(?:module|jp[-_]?m)[_\s]*0?(\d+)/i);
          return m ? parseInt(m[1], 10) : 999;
        };
        return getNum(a.filename) - getNum(b.filename);
      });

      const modulesData: ModuleItem[] = [];

      for (const bank of sortedBanks) {
        try {
          const qList = await fetchQuestions(bank.id);

          const sampleModule = qList.find((q) => q.module)?.module;
          const modName = sampleModule || formatBankTitle(bank.filename);

          const isJavaBank =
            (bank.language || '').toLowerCase() === 'java' ||
            bank.filename.toLowerCase().startsWith('jp_') ||
            bank.filename.toLowerCase().includes('java') ||
            qList.some((q) => (q.language || '').toLowerCase() === 'java');
          const course: 'python' | 'java' = isJavaBank ? 'java' : 'python';

          let modNum = 1;
          const numMatch = (sampleModule || bank.filename).match(/(?:module|jp[-_]?m)[_\s]*0?(\d+)/i);
          if (numMatch) {
            modNum = parseInt(numMatch[1], 10);
          } else {
            modNum = modulesData.filter((m) => m.course === course).length + 1;
          }

          const diffRank: Record<string, number> = { easy: 1, medium: 2, hard: 3 };
          const sortedQs = [...qList].sort((a, b) => {
            const ra = diffRank[(a.difficulty || '').toLowerCase()] || 99;
            const rb = diffRank[(b.difficulty || '').toLowerCase()] || 99;
            if (ra !== rb) return ra - rb;
            return a.question_id.localeCompare(b.question_id, undefined, {
              numeric: true,
              sensitivity: 'base'
            });
          });

          modulesData.push({
            bankId: bank.id,
            filename: bank.filename,
            moduleName: modName,
            moduleNumber: modNum,
            course,
            questions: sortedQs
          });
        } catch (e) {
          console.error(`Failed to load questions for bank ${bank.id}:`, e);
        }
      }

      setCurriculumModules(modulesData);

      if (modulesData.length > 0) {
        const activeCourseModules = modulesData.filter((m) => (m.course || 'python') === activeCourse);
        const targetModules = activeCourseModules.length > 0 ? activeCourseModules : modulesData;

        setCurrentBankId((prevBankId) => {
          if (prevBankId && targetModules.some((m) => m.bankId === prevBankId)) {
            return prevBankId;
          }
          return targetModules[0].bankId;
        });

        setSelectedQuestionId((prevQId) => {
          const allQs = targetModules.flatMap((m) => m.questions);
          if (prevQId && allQs.some((q) => q.question_id === prevQId)) {
            return prevQId;
          }
          return targetModules[0].questions[0]?.question_id || null;
        });
      }
    } catch (err) {
      console.error('Failed to load curriculum:', err);
    } finally {
      setIsLoadingCurriculum(false);
    }
  }, [activeCourse]);

  // Load question banks and curriculum on start
  const loadBanks = useCallback(async () => {
    try {
      const data = await fetchBanks();
      setBanks(data);
      await loadCurriculum(data);
    } catch (err) {
      console.error('Error fetching question banks:', err);
    }
  }, [loadCurriculum]);

  useEffect(() => {
    loadBanks();
  }, [loadBanks]);

  // Keep track of which question the code in the editor currently belongs to
  const loadedQuestionRef = React.useRef<{ bankId: string; qId: string } | null>(null);

  // Load question detail and draft when selected question changes
  useEffect(() => {
    if (!currentBankId || !selectedQuestionId) return;

    const loadDetail = async () => {
      try {
        const detail = await fetchQuestionDetail(
          currentBankId,
          selectedQuestionId,
          isOwnerMode,
          true
        );
        setQuestionDetail(detail);

        // Check for server draft or local draft
        const draftKey = `codementor_draft_${currentBankId}_${selectedQuestionId}`;
        const savedDraft = serverDraftsRef.current[selectedQuestionId] || localStorage.getItem(draftKey);

        const isJavaQuestion = (detail.language || '').toLowerCase() === 'java';
        setSelectedLanguage(isJavaQuestion ? 'java' : 'python');

        let initialCode = '';
        if (savedDraft && !savedDraft.includes('Welcome Banner')) {
          initialCode = savedDraft;
        } else if (detail.starter_code) {
          initialCode = detail.starter_code;
        } else if (isJavaQuestion) {
          initialCode = `import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution for ${detail.question_id}: ${detail.title} below\n        \n    }\n}\n`;
        } else {
          initialCode = `# Write your solution for ${detail.question_id}: ${detail.title} below\nimport sys\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n`;
        }
        setCode(initialCode);
        loadedQuestionRef.current = { bankId: currentBankId, qId: selectedQuestionId };

        if (detail.sample_inputs && detail.sample_inputs.length > 0) {
          setCustomStdin(detail.sample_inputs[0]);
        }
      } catch (err) {
        console.error('Failed to fetch question details:', err);
      }
    };
    loadDetail();
  }, [currentBankId, selectedQuestionId, isOwnerMode]);

  // Save drafts to localStorage and sync to server (debounced)
  useEffect(() => {
    if (!currentBankId || !selectedQuestionId || !code) return;
    if (
      loadedQuestionRef.current?.bankId === currentBankId &&
      loadedQuestionRef.current?.qId === selectedQuestionId
    ) {
      const draftKey = `codementor_draft_${currentBankId}_${selectedQuestionId}`;
      localStorage.setItem(draftKey, code);
      serverDraftsRef.current[selectedQuestionId] = code;

      if (currentUser) {
        const timer = setTimeout(() => {
          saveUserDraftApi(selectedQuestionId, currentBankId, code);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [code, currentBankId, selectedQuestionId, currentUser]);

  // Flattened ordered list of curriculum questions for current course
  const allCurriculumQuestions = useMemo(() => {
    const list: Array<{
      bankId: string;
      moduleNumber: number;
      moduleName: string;
      question: QuestionSummary;
      displayIndex: string;
    }> = [];

    const activeMods = curriculumModules.filter((m) => (m.course || 'python') === activeCourse);

    activeMods.forEach((m) => {
      let easyCount = 0;
      let medCount = 0;
      let hardCount = 0;

      m.questions.forEach((q) => {
        const diff = (q.difficulty || 'Easy').toLowerCase();
        let dIndex = '';
        if (diff === 'easy') {
          easyCount++;
          dIndex = `${m.moduleNumber}.1.${easyCount}`;
        } else if (diff === 'medium') {
          medCount++;
          dIndex = `${m.moduleNumber}.2.${medCount}`;
        } else {
          hardCount++;
          dIndex = `${m.moduleNumber}.3.${hardCount}`;
        }

        list.push({
          bankId: m.bankId,
          moduleNumber: m.moduleNumber,
          moduleName: m.moduleName,
          question: q,
          displayIndex: dIndex
        });
      });
    });

    return list;
  }, [curriculumModules, activeCourse]);

  // Map of question_id -> displayIndex
  const displayIndexMap = useMemo(() => {
    const map: Record<string, string> = {};
    allCurriculumQuestions.forEach((item) => {
      map[item.question.question_id] = item.displayIndex;
    });
    return map;
  }, [allCurriculumQuestions]);

  // Current question index in curriculum
  const currentQuestionIndex = useMemo(() => {
    if (!selectedQuestionId) return -1;
    return allCurriculumQuestions.findIndex(
      (item) => item.question.question_id === selectedQuestionId
    );
  }, [allCurriculumQuestions, selectedQuestionId]);

  // Navigation handlers
  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      const prev = allCurriculumQuestions[currentQuestionIndex - 1];
      if (prev.bankId !== currentBankId) {
        setCurrentBankId(prev.bankId);
      }
      setSelectedQuestionId(prev.question.question_id);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < allCurriculumQuestions.length - 1 && currentQuestionIndex >= 0) {
      const next = allCurriculumQuestions[currentQuestionIndex + 1];
      if (next.bankId !== currentBankId) {
        setCurrentBankId(next.bankId);
      }
      setSelectedQuestionId(next.question.question_id);
    }
  };

  // Upload handler
  const handleUploadFile = async (file: File) => {
    try {
      const newBank = await importBank(file);
      await loadBanks();
      setCurrentBankId(newBank.id);
      setSelectedQuestionId(null);
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    }
  };

  // Course counts
  const courseModuleCounts = useMemo(() => {
    const python = curriculumModules.filter((m) => (m.course || 'python') === 'python').length;
    const java = curriculumModules.filter((m) => m.course === 'java').length;
    return { python, java };
  }, [curriculumModules]);

  // Select Course (Python or Java)
  const handleSelectCourse = (course: 'python' | 'java') => {
    setActiveCourse(course);
    setSelectedLanguage(course);

    const courseMods = curriculumModules.filter((m) => (m.course || 'python') === course);
    if (courseMods.length > 0 && courseMods[0].questions.length > 0) {
      setCurrentBankId(courseMods[0].bankId);
      setSelectedQuestionId(courseMods[0].questions[0].question_id);
    }
  };

  // Select Question directly
  const handleSelectQuestion = (bankId: string, qId: string) => {
    const mod = curriculumModules.find((m) => m.bankId === bankId);
    if (mod?.course && mod.course !== activeCourse) {
      setActiveCourse(mod.course);
    }
    if (mod?.course) {
      setSelectedLanguage(mod.course);
    }
    if (bankId !== currentBankId) {
      setCurrentBankId(bankId);
    }
    setSelectedQuestionId(qId);
    if (mobileTab === 'problem') setMobileTab('problem');
  };

  // Switch Language manually in editor
  const handleChangeLanguage = (newLang: 'python' | 'java') => {
    setSelectedLanguage(newLang);
    const isDefaultPython = !code || code.includes('import sys\ndef main()') || code.trim() === '# Write your solution here';
    const isDefaultJava = !code || (code.includes('public class Solution') && code.includes('Scanner sc'));
    if (isDefaultPython && newLang === 'java') {
      setCode(`import java.util.*;\n\npublic class Solution {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // Write your solution here\n        \n    }\n}\n`);
    } else if (isDefaultJava && newLang === 'python') {
      setCode(`# Write your solution here\nimport sys\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n`);
    }
  };

  // Run Custom Code
  const handleRunCode = async () => {
    if (!code) return;
    setIsRunning(true);
    setActiveOutputTab('console');
    try {
      const res = await runCode(
        code,
        customStdin,
        questionDetail?.execution_mode || 'stdin/stdout',
        questionDetail?.function_name,
        selectedLanguage
      );
      setRunResult(res);
    } catch (err: any) {
      alert(`Execution error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Run Tests (Visible or All)
  const handleRunTests = async (runAll: boolean) => {
    if (!currentBankId || !selectedQuestionId || !code) return;
    setIsRunning(true);
    setActiveOutputTab('tests');
    try {
      const res = await submitSolution(
        currentBankId,
        selectedQuestionId,
        code,
        runAll,
        isOwnerMode,
        strictNewlinePolicy,
        true,
        selectedLanguage
      );
      setSubmitResult(res);

      // Update question status ONLY on full submit (runAll === true)
      if (runAll) {
        setQuestionStatuses((prev) => {
          const next: Record<string, 'passed' | 'failed' | 'attempted'> = {
            ...prev,
            [selectedQuestionId]: res.all_passed ? 'passed' : 'failed'
          };
          try {
            localStorage.setItem('codementor_question_statuses', JSON.stringify(next));
          } catch (e) {
            console.error('Failed to save questionStatuses:', e);
          }
          return next;
        });

        // Persist to server under student account
        if (currentUser) {
          saveUserProgressApi({
            question_id: selectedQuestionId,
            bank_id: currentBankId,
            status: res.all_passed ? 'passed' : 'failed',
            code,
            all_passed: res.all_passed,
            passed_count: res.passed_tests,
            total_tests: res.total_tests
          });
        }
      }
    } catch (err: any) {
      alert(`Validation error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Reset code to starter or default
  const handleResetCode = () => {
    if (!currentBankId || !selectedQuestionId || !questionDetail) return;
    const draftKey = `codementor_draft_${currentBankId}_${selectedQuestionId}`;
    localStorage.removeItem(draftKey);
    localStorage.removeItem(`codementor_solved_time_${selectedQuestionId}`);

    if (submitResult?.question_id === selectedQuestionId) {
      setSubmitResult(null);
    }
    setQuestionStatuses((prev) => {
      const copy = { ...prev };
      delete copy[selectedQuestionId];
      try {
        localStorage.setItem('codementor_question_statuses', JSON.stringify(copy));
      } catch (e) {
        console.error('Failed to update questionStatuses:', e);
      }
      return copy;
    });

    if (currentUser) {
      resetUserProgressApi(selectedQuestionId);
    }

    if (questionDetail.starter_code) {
      setCode(questionDetail.starter_code);
    } else {
      setCode(
        `# Write your solution for ${questionDetail.question_id}: ${questionDetail.title} below\nimport sys\n\ndef main():\n    pass\n\nif __name__ == "__main__":\n    main()\n`
      );
    }
  };

  // Fetch reference solution from server
  const handleFetchSolution = async () => {
    if (!currentBankId || !selectedQuestionId) return;
    try {
      const detail = await fetchQuestionDetail(currentBankId, selectedQuestionId, isOwnerMode, true);
      setQuestionDetail(detail);
    } catch (err) {
      console.error('Failed to fetch reference solution:', err);
    }
  };

  const currentBank = banks.find((b) => b.id === currentBankId);
  const currentBankIssuesCount = currentBank?.validation_report?.issues?.length || 0;
  const totalSolvedCount = allCurriculumQuestions.filter(
    (item) => questionStatuses[item.question.question_id] === 'passed'
  ).length;
  const totalQuestionsCount = allCurriculumQuestions.length;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0e15] text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Application Bar */}
      <header className="h-12 bg-[#0e121a] border-b border-[#1b2333] px-3.5 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center space-x-3.5">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-200 font-mono text-xs font-bold shadow-sm">
              {'<C/>'}
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-zinc-100 text-sm tracking-tight">CodeArena</span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                activeCourse === 'java'
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {activeCourse === 'java' ? 'Java Course' : 'Python Course'}
              </span>
            </div>
          </div>

          {/* Course Switcher in Header */}
          <div className="flex items-center space-x-1 p-0.5 bg-zinc-900/90 rounded-lg border border-zinc-800 shadow-inner">
            <button
              onClick={() => handleSelectCourse('python')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold transition ${
                activeCourse === 'python'
                  ? 'bg-zinc-800 text-amber-300 border border-amber-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>🐍</span>
              <span>Python ({courseModuleCounts.python} Modules)</span>
            </button>
            <button
              onClick={() => handleSelectCourse('java')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-semibold transition ${
                activeCourse === 'java'
                  ? 'bg-zinc-800 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>☕</span>
              <span>Java ({courseModuleCounts.java} {courseModuleCounts.java === 1 ? 'Module' : 'Modules'})</span>
            </button>
          </div>
        </div>

        {/* Center: Student Learning Tracker */}
        <div className="hidden md:flex items-center space-x-3">
          <div className="flex items-center space-x-2.5 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 shadow-inner">
            <Trophy className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-300 font-medium">
              Progress:{' '}
              <strong className="text-zinc-100 font-mono font-bold">
                {totalSolvedCount} / {totalQuestionsCount}
              </strong>{' '}
              Solved
            </span>
            <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden ml-1">
              <div
                className="h-full bg-zinc-300 rounded-full transition-all duration-300"
                style={{
                  width: `${totalQuestionsCount > 0 ? Math.min(100, Math.round((totalSolvedCount / totalQuestionsCount) * 100)) : 0}%`
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-zinc-400 font-medium">
              {totalQuestionsCount > 0 ? Math.round((totalSolvedCount / totalQuestionsCount) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Right: Student Account Profile */}
        <div className="flex items-center space-x-2.5">
          {currentUser ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-200">
                  {currentUser.name
                    ? currentUser.name.slice(0, 2).toUpperCase()
                    : currentUser.email.slice(0, 2).toUpperCase()}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-[11px] font-semibold text-zinc-200 leading-tight">
                    {currentUser.name || currentUser.email.split('@')[0]}
                  </span>
                  <span className="text-[9px] text-zinc-400 flex items-center space-x-1 leading-tight">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Cloud Synced</span>
                  </span>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg border border-transparent hover:border-zinc-700 transition"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center space-x-1.5 text-xs font-medium px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 transition shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Enter Course</span>
            </button>
          )}
        </div>
      </header>

      {/* Mobile view selector */}
      <div className="lg:hidden h-10 bg-[#11141b] border-b border-[#1f2535] flex items-center justify-around px-2 shrink-0">
        <button
          onClick={() => setMobileTab('problem')}
          className={`flex items-center space-x-1 text-xs font-medium py-1 px-3 rounded-md transition ${
            mobileTab === 'problem' ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'text-zinc-400'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Problem</span>
        </button>
        <button
          onClick={() => setMobileTab('editor')}
          className={`flex items-center space-x-1 text-xs font-medium py-1 px-3 rounded-md transition ${
            mobileTab === 'editor' ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'text-zinc-400'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          <span>Editor</span>
        </button>
        <button
          onClick={() => setMobileTab('output')}
          className={`flex items-center space-x-1 text-xs font-medium py-1 px-3 rounded-md transition ${
            mobileTab === 'output' ? 'bg-zinc-800 text-zinc-100 border border-zinc-700' : 'text-zinc-400'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Results</span>
        </button>
      </div>

      {/* Main Workbench Body: 3-Column Assessment Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Column 1: Left Assessment Tree Navigation */}
        <Sidebar
          modules={curriculumModules}
          selectedQuestionId={selectedQuestionId}
          onSelectQuestion={handleSelectQuestion}
          questionStatuses={questionStatuses}
          isLoading={isLoadingCurriculum}
          banks={banks}
          currentBankId={currentBankId}
          onSelectBank={async (id) => {
            setCurrentBankId(id);
            const mod = curriculumModules.find((m) => m.bankId === id);
            if (mod?.course && mod.course !== activeCourse) {
              setActiveCourse(mod.course);
            }
            if (mod?.course) {
              setSelectedLanguage(mod.course);
            }
            if (mod && mod.questions.length > 0) {
              setSelectedQuestionId(mod.questions[0].question_id);
            }
          }}
          onUploadFile={handleUploadFile}
          onOpenCompare={() => setIsCompareOpen(true)}
          onOpenValidationReport={() => setIsValidationOpen(true)}
          currentBankIssuesCount={currentBankIssuesCount}
          currentUser={currentUser}
          onSignOut={handleSignOut}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          activeCourse={activeCourse}
          onSelectCourse={handleSelectCourse}
          courseModuleCounts={courseModuleCounts}
        />

        {/* Column 2 & 3 Container */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Column 2: Problem Description */}
          <div
            className={`w-full lg:w-[35%] h-full flex flex-col border-r border-[#1d2538] bg-[#0c1017] ${
              mobileTab === 'problem' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <ProblemView
              question={questionDetail}
              bankId={currentBankId || ''}
              onCopyToStdin={(inputStr: string) => {
                setCustomStdin(inputStr);
                setActiveOutputTab('console');
              }}
              onLoadSolutionToEditor={(sol: string) => setCode(sol)}
              onFetchSolution={handleFetchSolution}
              displayIndex={
                selectedQuestionId ? displayIndexMap[selectedQuestionId] : undefined
              }
              isOwnerMode={isOwnerMode}
              isSolved={selectedQuestionId ? questionStatuses[selectedQuestionId] === 'passed' : false}
            />
          </div>

          {/* Column 3: Split Editor (Top) & Output Panel (Bottom) */}
          <div
            className={`w-full lg:w-[65%] h-full flex flex-col bg-[#0b0e15] ${
              mobileTab !== 'problem' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {/* Top Half: Code Editor */}
            <div
              className={`h-[55%] flex flex-col border-b border-[#1e273a] ${
                mobileTab === 'editor' ? 'flex h-full' : mobileTab === 'output' ? 'hidden' : 'flex'
              }`}
            >
              <EditorPanel
                code={code}
                onChangeCode={setCode}
                onRunVisibleTests={() => handleRunTests(false)}
                onRunAllTests={() => handleRunTests(true)}
                onResetCode={handleResetCode}
                onLoadStarterCode={() => {
                  if (questionDetail?.starter_code) {
                    setCode(questionDetail.starter_code);
                  }
                }}
                onLoadReferenceSolution={async () => {
                  await handleFetchSolution();
                  if (questionDetail?.reference_solution) {
                    setCode(questionDetail.reference_solution);
                  }
                }}
                isRunning={isRunning}
                questionId={selectedQuestionId || ''}
                language={selectedLanguage}
                onChangeLanguage={handleChangeLanguage}
              />
            </div>

            {/* Bottom Half: Test Results & Terminal */}
            <div
              className={`h-[45%] flex flex-col bg-[#0f141f] ${
                mobileTab === 'output' ? 'flex h-full' : mobileTab === 'editor' ? 'hidden' : 'flex'
              }`}
            >
              <OutputPanel
                submitResult={submitResult}
                runResult={runResult}
                customStdin={customStdin}
                onChangeCustomStdin={setCustomStdin}
                activeTab={activeOutputTab}
                onChangeTab={setActiveOutputTab}
                onRunCustomStdin={handleRunCode}
                isRunning={isRunning}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Global Bottom Assessment Action Bar */}
      <footer className="h-12 bg-[#0e121a] border-t border-[#1b2333] px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center space-x-2">
          {/* Reset Code Button */}
          <button
            onClick={handleResetCode}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700/60 transition"
            title="Reset code to question template"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
            <span>RESET</span>
          </button>
        </div>

        {/* Action Controls: < PREV | RUN | SUBMIT | NEXT > */}
        <div className="flex items-center space-x-2.5">
          {/* < PREV Button */}
          <button
            onClick={handlePrevQuestion}
            disabled={currentQuestionIndex <= 0}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-200 font-semibold text-xs transition flex items-center space-x-1 border border-zinc-700/60 shadow-sm"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>PREV</span>
          </button>

          {/* RUN CODE Button */}
          <button
            onClick={() => handleRunTests(false)}
            disabled={isRunning || !selectedQuestionId}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-100 font-semibold text-xs transition flex items-center space-x-1.5 border border-zinc-600/70 shadow-sm"
          >
            <Code className="w-3.5 h-3.5 text-zinc-300" />
            <span>RUN CODE</span>
          </button>

          {/* SUBMIT Button */}
          <button
            onClick={() => handleRunTests(true)}
            disabled={isRunning || !selectedQuestionId}
            className="px-5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-950 font-bold text-xs transition flex items-center space-x-1.5 shadow-sm active:scale-[0.99]"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-950" />
            <span>SUBMIT</span>
          </button>

          {/* NEXT > Button */}
          <button
            onClick={handleNextQuestion}
            disabled={currentQuestionIndex >= allCurriculumQuestions.length - 1}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-zinc-200 font-semibold text-xs transition flex items-center space-x-1 border border-zinc-700/60 shadow-sm"
          >
            <span>NEXT</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>

      {/* Student Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onSuccess={handleAuthSuccess}
        onClose={() => setIsAuthModalOpen(false)}
        canClose={currentUser !== null}
      />

      {/* CSV Version Comparison Modal */}
      <CompareModal
        banks={banks}
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
      />

      {/* CSV Validation Report Modal */}
      <ValidationReportModal
        bankId={currentBankId || ''}
        report={currentBank?.validation_report || null}
        isOpen={isValidationOpen}
        onClose={() => setIsValidationOpen(false)}
      />
    </div>
  );
};

export default App;
