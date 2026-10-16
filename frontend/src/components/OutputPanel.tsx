import React, { useState } from 'react';
import {
  Terminal as TerminalIcon,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  X,
  Play
} from 'lucide-react';
import type { SubmitResult, RunResult } from '../types';

interface OutputPanelProps {
  submitResult: SubmitResult | null;
  runResult: RunResult | null;
  customStdin: string;
  onChangeCustomStdin: (val: string) => void;
  activeTab: 'tests' | 'console';
  onChangeTab: (tab: 'tests' | 'console') => void;
  onRunCustomStdin?: () => void;
  isRunning?: boolean;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  submitResult,
  runResult,
  customStdin,
  onChangeCustomStdin,
  activeTab,
  onChangeTab,
  onRunCustomStdin,
  isRunning = false
}) => {
  const [selectedTestCaseIndex, setSelectedTestCaseIndex] = useState<number>(0);
  const [collapsedSummary, setCollapsedSummary] = useState<boolean>(false);
  const [expandedTestCases, setExpandedTestCases] = useState<Record<number, boolean>>({});

  const toggleExpand = (idx: number) => {
    setExpandedTestCases((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // Helper to format string with visual return newline symbol ↵
  const formatWithNewlines = (text: string | null | undefined) => {
    if (text === null || text === undefined) return <span className="text-slate-500 italic">None</span>;
    if (text === '') return <span className="text-slate-500 italic">[Empty String]</span>;

    const lines = text.split('\n');
    return lines.map((line, i) => (
      <span key={i} className="block leading-relaxed">
        {line}
        {i < lines.length - 1 && <span className="text-slate-500 font-sans select-none opacity-70">↵</span>}
      </span>
    ));
  };

  // Compute test case stats
  const visibleTests = submitResult?.results.filter((r) => !r.is_hidden) || [];
  const hiddenTests = submitResult?.results.filter((r) => r.is_hidden) || [];

  const passedVisible = visibleTests.filter((r) => r.passed).length;
  const totalVisible = visibleTests.length;

  const passedHidden = hiddenTests.filter((r) => r.passed).length;
  const totalHidden = hiddenTests.length;

  // Calculate average and maximum execution times
  const durations = submitResult?.results.map((r) => r.duration_ms) || [];
  const maxDurationMs = durations.length > 0 ? Math.max(...durations) : 0;
  const avgDurationMs =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

  const currentResult = submitResult?.results[selectedTestCaseIndex] || submitResult?.results[0];

  return (
    <div className="h-full flex flex-col bg-[#10141f] border-t border-[#1e273a] select-none text-slate-200 overflow-hidden font-sans">
      {/* Test Cases View */}
      {activeTab === 'tests' && (
        <div className="flex-1 flex flex-col overflow-hidden p-3.5 space-y-3">
          {/* Top Summary Metrics & Badges (Matching Screenshot) */}
          {!collapsedSummary && submitResult && (
            <div className="bg-[#141a27] rounded-lg p-3 border border-[#212b3e] flex items-center justify-between gap-3 shrink-0 relative">
              {/* Close summary cross icon */}
              <button
                onClick={() => setCollapsedSummary(true)}
                className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
                title="Dismiss metrics"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center space-x-6 pr-6">
                {/* Average Time Card */}
                <div className="space-y-0.5">
                  <div className="text-[11px] text-slate-400 font-medium">Average time</div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-bold text-indigo-400">
                      {(avgDurationMs / 1000).toFixed(3)} s
                    </span>
                    {/* Sparkline icon */}
                    <svg className="w-5 h-3.5 text-indigo-400" viewBox="0 0 24 14" fill="none">
                      <path d="M1 12 L7 4 L13 9 L19 2 L23 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="text-[10px] font-mono text-indigo-300/70">
                    {avgDurationMs.toFixed(2)} ms
                  </div>
                </div>

                {/* Maximum Time Card */}
                <div className="space-y-0.5 border-l border-[#242f46] pl-6">
                  <div className="text-[11px] text-slate-400 font-medium">Maximum time</div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-bold text-pink-400">
                      {(maxDurationMs / 1000).toFixed(3)} s
                    </span>
                    {/* Sparkline icon */}
                    <svg className="w-5 h-3.5 text-pink-400" viewBox="0 0 24 14" fill="none">
                      <path d="M1 13 L6 10 L12 2 L18 11 L23 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="text-[10px] font-mono text-pink-300/70">
                    {maxDurationMs.toFixed(2)} ms
                  </div>
                </div>
              </div>

              {/* Right Side Badges: Green if all passed, Red if failed */}
              <div className="flex flex-col space-y-1.5 shrink-0 pr-4">
                {/* Visible test cases badge */}
                <div
                  className={`flex items-center space-x-2 px-3 py-1 rounded-md text-xs font-semibold border transition ${
                    passedVisible === totalVisible && totalVisible > 0
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {passedVisible === totalVisible && totalVisible > 0 ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span>
                    {passedVisible} out of {totalVisible} shown test cases
                  </span>
                </div>

                {/* Hidden test cases badge */}
                {totalHidden > 0 ? (
                  <div
                    className={`flex items-center space-x-2 px-3 py-1 rounded-md text-xs font-semibold border transition ${
                      passedHidden === totalHidden
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {passedHidden === totalHidden ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    )}
                    <span>
                      {passedHidden} out of {totalHidden} hidden test cases
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 px-3 py-1 rounded-md text-xs font-medium border bg-[#141b29] border-[#253249] text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                    <span>Hidden tests evaluated on SUBMIT</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Test Case Details & Output Comparison */}
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1">
            {!submitResult ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-xs">No tests executed yet.</p>
                <p className="text-[11px] text-slate-600">
                  Click <span className="text-emerald-400 font-semibold">SUBMIT</span> in the bottom toolbar or top editor bar to run all test cases.
                </p>
              </div>
            ) : currentResult ? (
              <div className="space-y-2.5">
                {/* Arguments / Input row (matching screenshot) */}
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-400 font-semibold">
                    Command line arguments:
                  </span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium">
                    {currentResult.input !== null && currentResult.input !== undefined
                      ? currentResult.input.trim() || '[empty input]'
                      : '[hidden input]'}
                  </span>
                </div>

                {/* Expected Output block */}
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400">
                    Expected output
                  </div>
                  <div className="bg-[#0b0e15] p-2.5 rounded-md border border-[#1e2638] font-mono text-xs text-slate-200 select-text overflow-x-auto whitespace-pre">
                    {formatWithNewlines(currentResult.expected_output)}
                  </div>
                </div>

                {/* Actual Output block */}
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                    <span>Actual output</span>
                    {currentResult.passed ? (
                      <span className="text-emerald-400 text-[10px] font-bold">MATCH</span>
                    ) : (
                      <span className="text-rose-400 text-[10px] font-bold">MISMATCH</span>
                    )}
                  </div>
                  <div
                    className={`p-2.5 rounded-md border font-mono text-xs select-text overflow-x-auto whitespace-pre ${
                      currentResult.passed
                        ? 'bg-[#0b0e15] border-[#1e2638] text-emerald-300'
                        : 'bg-rose-950/20 border-rose-900/50 text-rose-200'
                    }`}
                  >
                    {formatWithNewlines(currentResult.actual_output)}
                  </div>
                  {currentResult.stderr && (
                    <div className="p-2 rounded bg-rose-950/30 border border-rose-900/60 font-mono text-[11px] text-rose-300 whitespace-pre-wrap select-text">
                      {currentResult.stderr}
                    </div>
                  )}
                </div>

                {/* Collapsible Test Cases Accordion List (matching screenshot "Test case 2 0ms v") */}
                <div className="pt-2 border-t border-[#1e273a] space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    All Test Cases ({submitResult.results.length})
                  </div>

                  <div className="space-y-1">
                    {submitResult.results.map((tc, idx) => (
                      <div
                        key={idx}
                        className={`rounded-md border transition ${
                          selectedTestCaseIndex === idx
                            ? 'bg-[#182030] border-[#303f5d]'
                            : 'bg-[#121723] border-[#1c2436] hover:bg-[#161d2c]'
                        }`}
                      >
                        <div
                          onClick={() => {
                            setSelectedTestCaseIndex(idx);
                            toggleExpand(idx);
                          }}
                          className="px-3 py-2 flex items-center justify-between cursor-pointer text-xs"
                        >
                          <div className="flex items-center space-x-2">
                            {tc.passed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            )}
                            <span className="font-semibold text-slate-200">
                              Test case {idx + 1}
                            </span>
                            {tc.is_hidden && (
                              <span className="text-[10px] text-slate-500 font-mono">
                                (hidden)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                              {tc.duration_ms.toFixed(0)} ms
                            </span>
                            {expandedTestCases[idx] ? (
                              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {expandedTestCases[idx] && (
                          <div className="px-3 pb-3 pt-1 border-t border-[#1e273a] text-xs font-mono space-y-2 bg-[#0d121c]/60">
                            <div>
                              <span className="text-slate-500 text-[10px] font-sans">Input: </span>
                              <pre className="text-slate-300 text-xs mt-0.5 overflow-x-auto whitespace-pre">
                                {tc.input !== null ? tc.input : '[Hidden]'}
                              </pre>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] font-sans">Expected: </span>
                              <pre className="text-slate-300 text-xs mt-0.5 overflow-x-auto whitespace-pre">
                                {tc.expected_output !== null ? tc.expected_output : '[Hidden]'}
                              </pre>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] font-sans">Actual: </span>
                              <pre
                                className={`text-xs mt-0.5 overflow-x-auto whitespace-pre ${
                                  tc.passed ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {tc.actual_output !== null ? tc.actual_output : '[None]'}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Terminal View */}
      {activeTab === 'console' && (
        <div className="flex-1 flex flex-col overflow-hidden p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center space-x-1.5">
              <TerminalIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Standard Input (stdin):</span>
            </span>
            {onRunCustomStdin && (
              <button
                onClick={onRunCustomStdin}
                disabled={isRunning}
                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-medium flex items-center space-x-1 transition disabled:opacity-50"
              >
                <Play className="w-3 h-3" />
                <span>Run with Stdin</span>
              </button>
            )}
          </div>

          <textarea
            value={customStdin}
            onChange={(e) => onChangeCustomStdin(e.target.value)}
            placeholder="Type custom inputs here to test standard input..."
            className="w-full h-20 bg-[#0d121c] border border-[#212b3e] rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
          />

          <div className="flex-1 flex flex-col overflow-hidden space-y-1">
            <div className="text-[11px] font-semibold text-slate-400">
              Terminal Output:
            </div>
            <pre className="flex-1 bg-[#0b0e15] border border-[#1e2638] rounded p-2.5 font-mono text-xs text-slate-200 overflow-y-auto whitespace-pre-wrap select-text">
              {runResult?.stdout ? (
                runResult.stdout
              ) : runResult?.stderr ? (
                <span className="text-rose-400">{runResult.stderr}</span>
              ) : (
                <span className="text-slate-600 italic">No output yet. Enter stdin and click Run with Stdin.</span>
              )}
            </pre>
          </div>
        </div>
      )}

      {/* Bottom Switcher Tabs (Matching Screenshot: >_ Terminal, ▦ Test cases) */}
      <div className="h-9 px-3 bg-[#0d111a] border-t border-[#1d2538] flex items-center space-x-2 shrink-0">
        <button
          onClick={() => onChangeTab('console')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition ${
            activeTab === 'console'
              ? 'bg-slate-800 text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TerminalIcon className="w-3.5 h-3.5" />
          <span>Terminal</span>
        </button>

        <button
          onClick={() => onChangeTab('tests')}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-semibold transition ${
            activeTab === 'tests'
              ? submitResult && !submitResult.all_passed
                ? 'bg-rose-700/80 text-white font-bold shadow-md shadow-rose-600/30'
                : 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {submitResult ? (
            submitResult.all_passed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-rose-200" />
            )
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          <span>Test cases</span>
          {submitResult && (
            <span
              className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                submitResult.all_passed
                  ? 'bg-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/80 text-rose-100 border border-rose-400/40'
              }`}
            >
              {submitResult.passed_tests}/{submitResult.total_tests}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
