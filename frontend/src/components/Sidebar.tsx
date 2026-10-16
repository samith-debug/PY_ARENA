import React, { useState, useMemo } from 'react';
import {
  Home,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Bookmark,
  CheckCircle2,
  XCircle,
  Upload,
  GitCompare,
  FileCheck,
  Layers,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import type { QuestionSummary, QuestionBankMeta, ModuleItem, User } from '../types';

interface SidebarProps {
  modules: ModuleItem[];
  selectedQuestionId: string | null;
  onSelectQuestion: (bankId: string, questionId: string) => void;
  questionStatuses: Record<string, 'passed' | 'failed' | 'attempted'>;
  isLoading: boolean;
  banks: QuestionBankMeta[];
  currentBankId: string | null;
  onSelectBank: (id: string) => void;
  onUploadFile: (file: File) => void;
  onOpenCompare: () => void;
  onOpenValidationReport: () => void;
  currentBankIssuesCount: number;
  currentUser?: User | null;
  onSignOut?: () => void;
  onOpenAuth?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  modules,
  selectedQuestionId,
  onSelectQuestion,
  questionStatuses,
  isLoading,
  banks,
  currentBankId,
  onSelectBank,
  onUploadFile,
  onOpenCompare,
  onOpenValidationReport,
  currentBankIssuesCount,
  currentUser,
  onSignOut,
  onOpenAuth
}) => {

  const [searchTerm, setSearchTerm] = useState('');
  const [moduleStatusFilters, setModuleStatusFilters] = useState<Record<string, 'all' | 'unsolved' | 'solved'>>({});
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showBankMenu, setShowBankMenu] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const setModuleFilter = (bankId: string, filter: 'all' | 'unsolved' | 'solved') => {
    setModuleStatusFilters((prev) => ({
      ...prev,
      [bankId]: filter,
    }));
  };

  // Expanded state per module and per difficulty: e.g. "mod-1": true, "mod-1-Easy": true
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedDifficulties, setExpandedDifficulties] = useState<Record<string, boolean>>({});

  const toggleModule = (modKey: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [modKey]: prev[modKey] !== undefined ? !prev[modKey] : false,
    }));
  };

  const toggleDifficulty = (diffKey: string) => {
    setExpandedDifficulties((prev) => ({
      ...prev,
      [diffKey]: prev[diffKey] !== undefined ? !prev[diffKey] : false,
    }));
  };

  // Filter modules and questions by search term and module-level solved status
  const filteredModules = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();

    return modules.map((mod) => {
      const currentFilter = moduleStatusFilters[mod.bankId] || 'all';
      const totalCount = mod.questions.length;
      const solvedCount = mod.questions.filter((q) => questionStatuses[q.question_id] === 'passed').length;
      const unsolvedCount = Math.max(0, totalCount - solvedCount);

      const filtered = mod.questions.filter((q) => {
        const isPassed = questionStatuses[q.question_id] === 'passed';
        if (currentFilter === 'solved' && !isPassed) return false;
        if (currentFilter === 'unsolved' && isPassed) return false;

        if (!s) return true;
        return (
          q.question_id.toLowerCase().includes(s) ||
          q.title.toLowerCase().includes(s) ||
          (q.objective && q.objective.toLowerCase().includes(s))
        );
      });

      const easy: QuestionSummary[] = [];
      const medium: QuestionSummary[] = [];
      const hard: QuestionSummary[] = [];

      filtered.forEach((q) => {
        const diff = (q.difficulty || 'Easy').toLowerCase();
        if (diff === 'easy') easy.push(q);
        else if (diff === 'medium') medium.push(q);
        else hard.push(q);
      });

      return {
        ...mod,
        filteredQuestions: filtered,
        easy,
        medium,
        hard,
        totalCount,
        solvedCount,
        unsolvedCount,
        currentFilter,
      };
    }).filter((m) => {
      if (s) {
        return m.filteredQuestions.length > 0;
      }
      return true;
    });
  }, [modules, searchTerm, moduleStatusFilters, questionStatuses]);


  // Total questions count and solved count across all modules
  const totalQuestionsCount = useMemo(() => {
    return modules.reduce((acc, m) => acc + m.questions.length, 0);
  }, [modules]);

  const totalSolvedCount = useMemo(() => {
    const allIds = new Set<string>();
    modules.forEach((m) => {
      m.questions.forEach((q) => {
        if (questionStatuses[q.question_id] === 'passed') {
          allIds.add(q.question_id);
        }
      });
    });
    return allIds.size;
  }, [modules, questionStatuses]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  if (isCollapsed) {
    return (
      <aside className="w-12 h-full bg-[#11151e] border-r border-[#1e2638] flex flex-col items-center py-3 select-none z-10 transition-all duration-200">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-md transition mb-4"
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-xs font-bold mb-4">
          {'</>'}
        </div>
        <div className="flex-1 flex flex-col items-center space-y-2 overflow-y-auto">
          {modules.map((m) => (
            <div key={m.bankId} className="flex flex-col items-center space-y-1">
              <span className="text-[9px] font-mono font-bold text-slate-500">M{m.moduleNumber}</span>
              {m.questions.slice(0, 5).map((q) => (
                <button
                  key={q.question_id}
                  onClick={() => onSelectQuestion(m.bankId, q.question_id)}
                  className={`w-7 h-7 rounded flex items-center justify-center text-[11px] font-mono transition ${
                    q.question_id === selectedQuestionId
                      ? 'bg-slate-700 text-white font-bold'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                  title={`${q.question_id}: ${q.title}`}
                >
                  {q.question_id.split('-')[1] || q.question_id.slice(-2)}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[350px] h-full flex flex-col bg-[#111622] border-r border-[#1d2538] text-slate-200 select-none z-10 transition-all duration-200 shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Banner Card: Clean CodeMentor Header */}
      <div className="p-2.5 pb-2 border-b border-[#1d2538]">
        <div className="bg-[#151a24] rounded-lg px-3 py-2.5 border border-[#232b3b] shadow-sm flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <button
              onClick={() => setShowBankMenu(!showBankMenu)}
              className="text-zinc-400 hover:text-white transition shrink-0"
              title="Question Banks & CSV Management"
            >
              <Home className="w-4 h-4 text-zinc-300 hover:text-white transition" />
            </button>

            <button
              onClick={() => setShowBankMenu(!showBankMenu)}
              className="text-left group flex items-center space-x-1.5 min-w-0"
            >
              <h2 className="text-[13px] font-bold text-zinc-100 tracking-tight group-hover:text-white transition flex items-center gap-1.5">
                <span>PyArena</span>
                <span className="text-[9px] font-mono font-medium uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Lab
                </span>
              </h2>
            </button>
          </div>

          {/* Collapse Button < */}
          <button
            onClick={() => setIsCollapsed(true)}
            className="w-6 h-6 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition shrink-0 ml-1"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Bank Switcher Dropdown Menu */}
        {showBankMenu && (
          <div className="mt-2 p-2 bg-[#141822] rounded-lg border border-[#242d3e] shadow-xl space-y-1.5 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between px-1.5 pb-1 border-b border-zinc-800 text-[11px] font-semibold text-zinc-400">
              <span className="flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-zinc-400" />
                <span>Question Banks</span>
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-zinc-300 hover:text-white flex items-center space-x-1 hover:underline text-[10px]"
              >
                <Upload className="w-3 h-3" />
                <span>Upload CSV</span>
              </button>
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
              {banks.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    onSelectBank(b.id);
                    setShowBankMenu(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs transition flex items-center justify-between ${
                    b.id === currentBankId
                      ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 font-medium'
                      : 'hover:bg-zinc-800/60 text-zinc-300'
                  }`}
                >
                  <span className="truncate pr-2">{b.filename}</span>
                  <span className="text-[10px] text-zinc-400 shrink-0 font-mono">
                    {b.total_questions} Qs
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <button
                onClick={() => {
                  setShowBankMenu(false);
                  onOpenCompare();
                }}
                className="text-zinc-400 hover:text-zinc-200 flex items-center space-x-1"
              >
                <GitCompare className="w-3 h-3 text-zinc-400" />
                <span>Compare Versions</span>
              </button>
              <button
                onClick={() => {
                  setShowBankMenu(false);
                  onOpenValidationReport();
                }}
                className="text-zinc-400 hover:text-zinc-200 flex items-center space-x-1"
              >
                <FileCheck className="w-3 h-3 text-zinc-400" />
                <span>Audit Report {currentBankIssuesCount > 0 ? `(${currentBankIssuesCount})` : ''}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search Bar with cmd + k badge */}
      <div className="p-2.5 pb-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search content"
            className="w-full bg-[#151923] text-zinc-200 text-xs pl-8 pr-16 py-1.5 rounded-md border border-[#232b3b] focus:outline-none focus:border-zinc-500 placeholder-zinc-500 transition"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
            <span className="text-[10px] text-zinc-400 bg-zinc-800 border border-zinc-700/80 px-1 py-0.2 rounded font-mono">
              cmd + k
            </span>
          </div>
        </div>
      </div>

      {/* Accordion Tree Hierarchy: Modules -> Easy / Medium / Hard Problems */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-2">
        {isLoading && (
          <div className="p-4 text-center text-xs text-zinc-500">
            Loading curriculum modules...
          </div>
        )}

        {filteredModules.map((mod) => {
          const modKey = `mod-${mod.bankId}`;
          // Default to true (expanded) unless explicitly closed
          const isModExpanded = expandedModules[modKey] !== false;

          const easyKey = `${modKey}-Easy`;
          const medKey = `${modKey}-Medium`;
          const hardKey = `${modKey}-Hard`;

          const isEasyExpanded = expandedDifficulties[easyKey] !== false;
          const isMedExpanded = expandedDifficulties[medKey] !== false;
          const isHardExpanded = expandedDifficulties[hardKey] !== false;

          const modIdx = mod.moduleNumber;

          return (
            <div key={mod.bankId} className="space-y-1 border-b border-[#1b2333]/80 pb-2 last:border-b-0">
              {/* Module Header */}
              <div
                onClick={() => toggleModule(modKey)}
                className="flex items-start justify-between px-2.5 py-2 text-zinc-200 font-bold text-xs rounded-md hover:bg-zinc-800/60 cursor-pointer select-none transition gap-2 group"
              >
                <div className="flex items-start space-x-2 flex-1 min-w-0">
                  <Bookmark className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                  <span className="text-[12.5px] leading-snug font-bold text-zinc-100 group-hover:text-white transition break-words">
                    {modIdx}. {mod.moduleName}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0 pt-0.5">
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/90 px-1.5 py-0.5 rounded border border-zinc-700/80">
                    {mod.currentFilter !== 'all' ? `${mod.filteredQuestions.length}/${mod.totalCount} Qs` : `${mod.totalCount} Qs`}
                  </span>
                  {isModExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                  )}
                </div>
              </div>

              {/* Module Content (Difficulties & Filter) */}
              {isModExpanded && (
                <div className="space-y-1.5 pl-1.5 pt-0.5">
                  {/* Inside Module Filter Buttons */}
                  <div className="px-1 pt-0.5 pb-1">
                    <div className="grid grid-cols-3 p-0.5 bg-[#0e121a] rounded-lg border border-[#1f2637] text-[10px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModuleFilter(mod.bankId, 'all');
                        }}
                        className={`py-1 rounded font-medium transition ${
                          mod.currentFilter === 'all'
                            ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/80 font-semibold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        All ({mod.totalCount})
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModuleFilter(mod.bankId, 'unsolved');
                        }}
                        className={`py-1 rounded font-medium transition ${
                          mod.currentFilter === 'unsolved'
                            ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/80 font-semibold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Unsolved ({mod.unsolvedCount})
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModuleFilter(mod.bankId, 'solved');
                        }}
                        className={`py-1 rounded font-medium transition ${
                          mod.currentFilter === 'solved'
                            ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/80 font-semibold'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Solved ({mod.solvedCount})
                      </button>
                    </div>
                  </div>
                  {/* Easy Section */}
                  <div className="space-y-0.5">
                    <div
                      onClick={() => toggleDifficulty(easyKey)}
                      className="flex items-center justify-between px-2.5 py-1 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer rounded hover:bg-slate-800/40 select-none transition"
                    >
                      <div className="flex items-center space-x-2">
                        <Bookmark className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/30 shrink-0" />
                        <span>{modIdx}.1. Easy</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] font-mono text-emerald-400/90 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                          {mod.easy.length}
                        </span>
                        {isEasyExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isEasyExpanded && (
                      <div className="space-y-0.5 pl-2">
                        {mod.easy.map((q, idx) => {
                          const isSelected = q.question_id === selectedQuestionId;
                          const status = questionStatuses[q.question_id];
                          const displayIndex = `${modIdx}.1.${idx + 1}`;

                          return (
                            <button
                              key={q.question_id}
                              onClick={() => onSelectQuestion(mod.bankId, q.question_id)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition flex items-center space-x-2 ${
                                isSelected
                                  ? 'bg-[#1e2638] text-white border border-[#334260] shadow-sm font-medium'
                                  : 'text-slate-300 hover:bg-[#182030] hover:text-white'
                              }`}
                            >
                              <span
                                className={`font-mono text-xs font-bold shrink-0 transition-colors ${
                                  status === 'passed' ? 'text-emerald-400' : 'text-zinc-500'
                                }`}
                              >
                                {'</>'}
                              </span>
                              <span className="truncate flex-1">
                                {displayIndex}. {q.title}
                              </span>
                              {status === 'passed' && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              )}
                              {status === 'failed' && (
                                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                        {mod.easy.length === 0 && (
                          <div className="text-[11px] text-slate-500 italic px-3 py-1">
                            No easy problems in this module
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Medium Section */}
                  <div className="space-y-0.5">
                    <div
                      onClick={() => toggleDifficulty(medKey)}
                      className="flex items-center justify-between px-2.5 py-1 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer rounded hover:bg-slate-800/40 select-none transition"
                    >
                      <div className="flex items-center space-x-2">
                        <Bookmark className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30 shrink-0" />
                        <span>{modIdx}.2. Medium</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] font-mono text-amber-400/90 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                          {mod.medium.length}
                        </span>
                        {isMedExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isMedExpanded && (
                      <div className="space-y-0.5 pl-2">
                        {mod.medium.map((q, idx) => {
                          const isSelected = q.question_id === selectedQuestionId;
                          const status = questionStatuses[q.question_id];
                          const displayIndex = `${modIdx}.2.${idx + 1}`;

                          return (
                            <button
                              key={q.question_id}
                              onClick={() => onSelectQuestion(mod.bankId, q.question_id)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition flex items-center space-x-2 ${
                                isSelected
                                  ? 'bg-[#1e2638] text-white border border-[#334260] shadow-sm font-medium'
                                  : 'text-slate-300 hover:bg-[#182030] hover:text-white'
                              }`}
                            >
                              <span
                                className={`font-mono text-xs font-bold shrink-0 transition-colors ${
                                  status === 'passed' ? 'text-emerald-400' : 'text-zinc-500'
                                }`}
                              >
                                {'</>'}
                              </span>
                              <span className="truncate flex-1">
                                {displayIndex}. {q.title}
                              </span>
                              {status === 'passed' && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              )}
                              {status === 'failed' && (
                                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                        {mod.medium.length === 0 && (
                          <div className="text-[11px] text-slate-500 italic px-3 py-1">
                            No medium problems in this module
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hard Section */}
                  <div className="space-y-0.5">
                    <div
                      onClick={() => toggleDifficulty(hardKey)}
                      className="flex items-center justify-between px-2.5 py-1 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer rounded hover:bg-slate-800/40 select-none transition"
                    >
                      <div className="flex items-center space-x-2">
                        <Bookmark className="w-3.5 h-3.5 text-rose-400 fill-rose-400/30 shrink-0" />
                        <span>{modIdx}.3. Hard</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] font-mono text-rose-400/90 bg-rose-500/10 px-1.5 py-0.2 rounded border border-rose-500/20">
                          {mod.hard.length}
                        </span>
                        {isHardExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isHardExpanded && (
                      <div className="space-y-0.5 pl-2">
                        {mod.hard.map((q, idx) => {
                          const isSelected = q.question_id === selectedQuestionId;
                          const status = questionStatuses[q.question_id];
                          const displayIndex = `${modIdx}.3.${idx + 1}`;

                          return (
                            <button
                              key={q.question_id}
                              onClick={() => onSelectQuestion(mod.bankId, q.question_id)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition flex items-center space-x-2 ${
                                isSelected
                                  ? 'bg-[#1e2638] text-white border border-[#334260] shadow-sm font-medium'
                                  : 'text-slate-300 hover:bg-[#182030] hover:text-white'
                              }`}
                            >
                              <span
                                className={`font-mono text-xs font-bold shrink-0 transition-colors ${
                                  status === 'passed' ? 'text-emerald-400' : 'text-zinc-500'
                                }`}
                              >
                                {'</>'}
                              </span>
                              <span className="truncate flex-1">
                                {displayIndex}. {q.title}
                              </span>
                              {status === 'passed' && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              )}
                              {status === 'failed' && (
                                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                        {mod.hard.length === 0 && (
                          <div className="text-[11px] text-slate-500 italic px-3 py-1">
                            No hard problems in this module
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sidebar Progress & Student Footer */}
      <div className="border-t border-[#1d2538] bg-[#0d121c]/90 p-2.5 space-y-2">
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
            <span className="font-medium text-zinc-300">Course Progress</span>
            <span className="font-mono text-zinc-200 font-bold">
              {totalSolvedCount} / {totalQuestionsCount}{' '}
              ({totalQuestionsCount > 0 ? Math.round((totalSolvedCount / totalQuestionsCount) * 100) : 0}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-zinc-300 rounded-full transition-all duration-300"
              style={{
                width: `${totalQuestionsCount > 0 ? Math.min(100, Math.round((totalSolvedCount / totalQuestionsCount) * 100)) : 0}%`
              }}
            />
          </div>
        </div>

        {/* Student Profile Card */}
        {currentUser ? (
          <div className="pt-1 flex items-center justify-between bg-[#151a24] border border-[#232b3b] rounded-lg px-2.5 py-1.5">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-200 shrink-0 shadow-sm">
                {currentUser.name
                  ? currentUser.name.slice(0, 2).toUpperCase()
                  : currentUser.email.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-[11px] font-semibold text-zinc-200 truncate">
                  {currentUser.name || currentUser.email.split('@')[0]}
                </span>
                <span className="text-[9px] text-zinc-400 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Cloud Synced</span>
                </span>
              </div>
            </div>

            {onSignOut && (
              <button
                onClick={onSignOut}
                className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className="w-full py-1.5 px-2 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold rounded-lg text-xs flex items-center justify-center space-x-1.5 transition shadow-sm"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In / Enroll</span>
            </button>
          )
        )}
      </div>
    </aside>
  );
};


