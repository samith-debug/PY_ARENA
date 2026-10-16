import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Play,
  CheckCircle2,
  ChevronDown,
  X,
  FileCode2,
  FolderOpen
} from 'lucide-react';

interface EditorPanelProps {
  code: string;
  onChangeCode: (newCode: string) => void;
  onRunVisibleTests: () => void;
  onRunAllTests: () => void;
  onResetCode: () => void;
  onLoadStarterCode: () => void;
  onLoadReferenceSolution: () => void;
  isRunning: boolean;
  questionId?: string;
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  code,
  onChangeCode,
  onRunVisibleTests,
  onRunAllTests,
  onResetCode,
  onLoadStarterCode,
  onLoadReferenceSolution,
  isRunning,
  questionId = 'M02-01'
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showSolutionConfirm, setShowSolutionConfirm] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);

  // Derive file name like CTP3341.py or M02-01.py
  const fileName = `${questionId ? questionId.replace('-', '') : 'CTP3341'}.py`;

  return (
    <div className="h-full flex flex-row bg-[#0c0f17] text-slate-200 select-none overflow-hidden">
      {/* Slim vertical Explorer strip on left edge (matching screenshot) */}
      <div className="w-7 bg-[#0b0e15] border-r border-[#1a2130] flex flex-col items-center justify-between py-3 shrink-0">
        <button
          onClick={() => setExplorerOpen(!explorerOpen)}
          className="flex flex-col items-center space-y-2 text-slate-400 hover:text-white transition group"
          title="Toggle Explorer"
        >
          <FolderOpen className="w-3.5 h-3.5 mb-1 text-slate-400 group-hover:text-cyan-400" />
          <span
            className="text-[10px] font-medium tracking-widest uppercase text-slate-400 group-hover:text-slate-200"
            style={{
              writingMode: 'vertical-lr',
              transform: 'rotate(180deg)',
            }}
          >
            Explorer
          </span>
        </button>
      </div>

      {/* Explorer Drawer (if toggled open) */}
      {explorerOpen && (
        <div className="w-48 bg-[#0f1420] border-r border-[#1c2436] p-3 text-xs space-y-2 shrink-0 animate-in slide-in-from-left duration-150">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Files</span>
            <button onClick={() => setExplorerOpen(false)} className="text-slate-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-[#1c2538] text-cyan-300 font-mono text-xs">
              <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
              <span>{fileName}</span>
            </div>
          </div>
          <div className="pt-2 border-t border-[#1c2436] space-y-1 text-[11px]">
            <button
              onClick={onLoadStarterCode}
              className="w-full text-left px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
            >
              Reset to Starter
            </button>
            <button
              onClick={() => setShowSolutionConfirm(true)}
              className="w-full text-left px-2 py-1 rounded hover:bg-purple-900/30 text-purple-300 hover:text-purple-200"
            >
              Load Solution
            </button>
          </div>
        </div>
      )}

      {/* Main Editor Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Editor Top Bar (matching screenshot: File tab, PYTHON dropdown, Run circle, Green SUBMIT) */}
        <div className="h-10 bg-[#121724] border-b border-[#1c2436] px-3 flex items-center justify-between shrink-0">
          {/* File tab on left */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-t-md bg-[#0c0f17] border-t-2 border-zinc-400 text-xs font-medium text-zinc-200">
              {/* Python file icon */}
              <div className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[10px] text-zinc-400 font-mono">
                {'</>'}
              </div>
              <span className="font-mono text-xs">{fileName}</span>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="text-zinc-500 hover:text-zinc-300 ml-1"
                title="Reset code"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Right Toolbar: Language selector, Play icon, SUBMIT button */}
          <div className="flex items-center space-x-2">
            {/* Language dropdown */}
            <div className="flex items-center space-x-1 px-2.5 py-1 bg-[#151923] rounded-md text-zinc-300 text-xs font-medium border border-[#232b3b] cursor-default">
              <span>PYTHON</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </div>

            {/* Run Play Button (neutral solid) */}
            <button
              onClick={onRunVisibleTests}
              disabled={isRunning}
              className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center justify-center transition disabled:opacity-50"
              title="Run visible test cases"
            >
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            </button>

            {/* Solid SUBMIT Button */}
            <button
              onClick={onRunAllTests}
              disabled={isRunning}
              className="flex items-center space-x-1.5 px-3.5 py-1 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition shadow-sm disabled:opacity-50"
              title="Submit code for full evaluation"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>SUBMIT</span>
            </button>
          </div>
        </div>

        {/* Confirmation reset modal / bar */}
        {showResetConfirm && (
          <div className="p-2 bg-rose-950/40 border-b border-rose-800/60 flex items-center justify-between text-xs text-rose-200">
            <span>Reset your code back to the initial template?</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  onResetCode();
                  setShowResetConfirm(false);
                }}
                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium"
              >
                Reset
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Confirmation solution load modal / bar */}
        {showSolutionConfirm && (
          <div className="p-2 bg-purple-950/50 border-b border-purple-800/60 flex items-center justify-between text-xs text-purple-200">
            <span>Replace editor code with the reference solution?</span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  onLoadReferenceSolution();
                  setShowSolutionConfirm(false);
                }}
                className="px-2 py-0.5 bg-purple-600 hover:bg-purple-500 text-white rounded font-medium"
              >
                Load Solution
              </button>
              <button
                onClick={() => setShowSolutionConfirm(false)}
                className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Monaco Editor */}
        <div className="flex-1 min-h-0 relative">
          <Editor
            height="100%"
            defaultLanguage="python"
            theme="vs-dark"
            value={code}
            onChange={(val) => onChangeCode(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, Monaco, monospace",
              fontLigatures: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              insertSpaces: true,
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              wordWrap: 'on',
              folding: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              bracketPairColorization: { enabled: true }
            }}
          />
        </div>
      </div>
    </div>
  );
};
