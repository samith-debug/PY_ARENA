import React, { useRef } from 'react';
import {
  Code2,
  Upload,
  GitCompare,
  ShieldAlert,
  ShieldCheck,
  FileCheck,
  Sun,
  Moon,
  ChevronDown,
  Layers,
  LogOut,
  LogIn,
  Trophy
} from 'lucide-react';
import type { QuestionBankMeta, User } from '../types';

interface NavbarProps {
  banks: QuestionBankMeta[];
  currentBankId: string | null;
  onSelectBank: (id: string) => void;
  onUploadFile: (file: File) => void;
  isOwnerMode: boolean;
  onToggleOwnerMode: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenCompare: () => void;
  onOpenValidationReport: () => void;
  currentBankReportIssuesCount: number;
  currentUser: User | null;
  onSignOut: () => void;
  onOpenAuth: () => void;
  solvedCount?: number;
  totalQuestionsCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  banks,
  currentBankId,
  onSelectBank,
  onUploadFile,
  isOwnerMode,
  onToggleOwnerMode,
  isDarkMode,
  onToggleDarkMode,
  onOpenCompare,
  onOpenValidationReport,
  currentBankReportIssuesCount,
  currentUser,
  onSignOut,
  onOpenAuth,
  solvedCount = 0,
  totalQuestionsCount = 0
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const currentBank = banks.find((b) => b.id === currentBankId);

  // Initials for avatar
  const initials = currentUser?.name
    ? currentUser.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : currentUser?.email?.slice(0, 2).toUpperCase() || 'ST';

  return (
    <header className="h-14 border-b border-slate-700/60 bg-slate-900/90 backdrop-blur px-4 flex items-center justify-between z-20 select-none">
      {/* Brand & Bank Switcher */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-slate-100 text-sm tracking-wide">
                PyArena
              </span>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Practice Lab
              </span>
            </div>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-700 mx-1" />

        {/* Bank selector */}
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-slate-400" />
          <div className="relative">
            <select
              value={currentBankId || ''}
              onChange={(e) => onSelectBank(e.target.value)}
              className="appearance-none bg-slate-800 text-slate-200 text-xs font-medium pl-3 pr-8 py-1.5 rounded-md border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[240px] truncate"
            >
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.filename} ({b.total_questions} Qs)
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Upload CSV Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center space-x-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 px-2.5 py-1.5 rounded-md border border-slate-700 transition"
          title="Upload new coding question CSV file"
        >
          <Upload className="w-3.5 h-3.5 text-indigo-400" />
          <span>Import CSV</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Middle & Right Actions */}
      <div className="flex items-center space-x-3">
        {/* CSV Compare Action */}
        <button
          onClick={onOpenCompare}
          disabled={banks.length < 2}
          className={`flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition ${
            banks.length >= 2
              ? 'text-purple-300 bg-purple-950/40 border-purple-800/50 hover:bg-purple-900/50 hover:border-purple-700'
              : 'text-slate-500 bg-slate-800/40 border-slate-800 cursor-not-allowed'
          }`}
          title={
            banks.length < 2
              ? 'Upload at least 2 CSV files to compare versions'
              : 'Compare two CSV versions field-by-field'
          }
        >
          <GitCompare className="w-3.5 h-3.5 text-purple-400" />
          <span>Compare CSV Versions</span>
          {banks.length >= 2 && (
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          )}
        </button>

        {/* Validation Report Button */}
        {currentBank && (
          <button
            onClick={onOpenValidationReport}
            className={`flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition ${
              currentBankReportIssuesCount > 0
                ? 'text-amber-300 bg-amber-950/40 border-amber-800/60 hover:bg-amber-900/50'
                : 'text-emerald-300 bg-emerald-950/40 border-emerald-800/60 hover:bg-emerald-900/50'
            }`}
            title="Inspect CSV parsing and validation report"
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Validation</span>
            {currentBankReportIssuesCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-300 text-[10px] font-bold">
                {currentBankReportIssuesCount} issues
              </span>
            ) : (
              <span className="text-[10px] text-emerald-400 font-medium">Valid</span>
            )}
          </button>
        )}

        <div className="h-4 w-px bg-slate-700" />

        {/* Student Progress Badge */}
        {currentUser && (
          <div
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium"
            title={`${solvedCount} solved out of ${totalQuestionsCount} course questions`}
          >
            <Trophy className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {solvedCount}
              {totalQuestionsCount > 0 ? ` / ${totalQuestionsCount}` : ''} Solved
            </span>
          </div>
        )}

        {/* Student Account Badge / Sign In Button */}
        {currentUser ? (
          <div className="flex items-center space-x-2 pl-1">
            <div className="flex items-center space-x-2 px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                {initials}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-medium text-slate-200 leading-none max-w-[110px] truncate">
                  {currentUser.name || currentUser.email.split('@')[0]}
                </span>
                <span className="text-[9px] text-slate-400 leading-none mt-0.5 max-w-[110px] truncate">
                  {currentUser.email}
                </span>
              </div>
            </div>

            <button
              onClick={onSignOut}
              className="p-1.5 text-slate-400 hover:text-red-300 hover:bg-red-950/30 border border-transparent hover:border-red-800/40 rounded-md transition"
              title="Sign Out from Course"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}

        <div className="h-4 w-px bg-slate-700" />

        {/* Owner / Admin Mode Toggle */}
        <button
          onClick={onToggleOwnerMode}
          className={`flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition ${
            isOwnerMode
              ? 'text-amber-300 bg-amber-500/20 border-amber-500/50 hover:bg-amber-500/30 ring-1 ring-amber-500/40'
              : 'text-slate-400 bg-slate-800/50 border-slate-700/60 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
          title={
            isOwnerMode
              ? 'Owner Mode ACTIVE: Hidden tests & solutions are inspectable'
              : 'Student Mode: Hidden test fixtures protected server-side'
          }
        >
          {isOwnerMode ? (
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>{isOwnerMode ? 'Admin' : 'Student'}</span>
        </button>

        {/* Dark / Light Mode Toggle */}
        <button
          onClick={onToggleDarkMode}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
