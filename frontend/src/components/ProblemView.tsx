import React, { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  RotateCcw,
  Link2,
  Maximize2,
  FileEdit,
  KeyRound,
  Eye,
  AlertCircle,
  Copy,
  Check,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink
} from 'lucide-react';
import type { QuestionDetail } from '../types';

interface ProblemViewProps {
  question: QuestionDetail | null;
  bankId: string;
  onCopyToStdin: (inputStr: string) => void;
  onLoadSolutionToEditor: (code: string) => void;
  isOwnerMode?: boolean;
  onFetchSolution: () => Promise<void>;
  displayIndex?: string;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  isSolved?: boolean;
}

export const ProblemView: React.FC<ProblemViewProps> = ({
  question,
  onCopyToStdin,
  onLoadSolutionToEditor,
  onFetchSolution,
  isOwnerMode = false,
  displayIndex = '1.1.1',
  isDarkMode = true,
  onToggleDarkMode,
  isSolved = false
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [fontSizeIndex, setFontSizeIndex] = useState<number>(1); // 0: sm, 1: base, 2: lg
  const [showSolutionConfirm, setShowSolutionConfirm] = useState(false);
  const [solutionRevealed, setSolutionRevealed] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [userNotes, setUserNotes] = useState<string>('');
  const startTimeRef = React.useRef<number>(Date.now());
  const [timerSeconds, setTimerSeconds] = useState<number>(0); // Starts from zero
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);
  const [revealedHints, setRevealedHints] = useState<Record<number, boolean>>({});
  const [hintsExpanded, setHintsExpanded] = useState<boolean>(false);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt?: string } | null>(null);
  const currentQIdRef = React.useRef<string | null>(null);

  // Close lightbox on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Format mm:ss
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Reset or initialize state on question switch or solve transition
  useEffect(() => {
    if (!question?.question_id) return;
    const qId = question.question_id;

    if (currentQIdRef.current !== qId) {
      // Switched to a new question
      currentQIdRef.current = qId;
      if (isSolved) {
        const savedTime = localStorage.getItem(`codementor_solved_time_${qId}`);
        const parsed = savedTime ? parseInt(savedTime, 10) : 0;
        setTimerSeconds(parsed > 0 ? parsed : 25);
        setIsTimerRunning(false);
      } else {
        startTimeRef.current = Date.now();
        setTimerSeconds(0);
        setIsTimerRunning(true);
      }

      // Load local note if exists
      const savedNote = localStorage.getItem(`codementor_note_${qId}`);
      setUserNotes(savedNote || '');
      setSolutionRevealed(false);
      setShowSolutionConfirm(false);
      setRevealedHints({});
    } else {
      // Same question, but isSolved changed to true upon submission
      if (isSolved) {
        const elapsed = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
        setTimerSeconds((prev) => {
          const finalTime = prev > 0 ? prev : elapsed;
          localStorage.setItem(`codementor_solved_time_${qId}`, String(finalTime));
          return finalTime;
        });
        setIsTimerRunning(false);
      }
    }
  }, [question?.question_id, isSolved]);

  // Timer interval: ticks up only while running and not solved
  useEffect(() => {
    let interval: any;
    if (isTimerRunning && !isSolved) {
      interval = setInterval(() => {
        const elapsed = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
        setTimerSeconds(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, isSolved]);

  if (!question) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-sm bg-[#0e131d]">
        Select a problem from the left navigation tree to view details
      </div>
    );
  }

  const fontSizes = ['text-[13px] leading-relaxed', 'text-[14px] leading-relaxed', 'text-[16px] leading-relaxed'];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSaveNotes = (val: string) => {
    setUserNotes(val);
    if (question?.question_id) {
      localStorage.setItem(`codementor_note_${question.question_id}`, val);
    }
  };

  const isSolutionVisible = Boolean(isOwnerMode || solutionRevealed);

  const handleRevealSolution = async () => {
    if (!question.reference_solution) {
      await onFetchSolution();
    }
    setSolutionRevealed(true);
    setShowSolutionConfirm(false);
  };

  // Helper to parse and render markdown images and diagrams in problem statements
  const renderProblemStatement = (text: string) => {
    if (!text) return null;

    // Matches ![alt](src) or <img ... src="..." ... />
    const imgRegex = /!\[(.*?)\]\((.*?)\)|<img\s+[^>]*src=["']([^"']+)["'][^>]*>/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyIndex = 0;

    while ((match = imgRegex.exec(text)) !== null) {
      const textBefore = text.substring(lastIndex, match.index);
      if (textBefore) {
        elements.push(
          <div key={`text-${keyIndex++}`} className="whitespace-pre-wrap leading-relaxed">
            {textBefore}
          </div>
        );
      }

      const alt = match[1] || '';
      const src = match[2] || match[3] || '';

      if (src) {
        elements.push(
          <div key={`img-${keyIndex++}`} className="my-5 flex flex-col items-center select-none">
            <div
              className="group relative rounded-xl overflow-hidden border border-slate-700/80 bg-white p-3 shadow-2xl transition-all duration-200 hover:border-cyan-500/60 max-w-2xl w-full cursor-zoom-in"
              onClick={() => setLightboxImage({ src, alt })}
            >
              <img
                src={src}
                alt={alt || 'Problem Diagram'}
                className="w-full h-auto object-contain transition-transform duration-200 group-hover:scale-[1.01]"
                loading="lazy"
              />
              <div className="absolute top-3 right-3 bg-slate-900/85 backdrop-blur-sm text-cyan-400 text-[11px] font-medium px-2.5 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1.5 border border-slate-700 shadow">
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Click to enlarge</span>
              </div>
            </div>
            {alt && (
              <p className="mt-2.5 text-xs text-slate-400 font-mono text-center flex items-center justify-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block animate-pulse"></span>
                <span>{alt}</span>
              </p>
            )}
          </div>
        );
      }

      lastIndex = imgRegex.lastIndex;
    }

    const textAfter = text.substring(lastIndex);
    if (textAfter) {
      elements.push(
        <div key={`text-${keyIndex++}`} className="whitespace-pre-wrap leading-relaxed">
          {textAfter}
        </div>
      );
    }

    return elements.length > 0 ? elements : <div className="whitespace-pre-wrap leading-relaxed">{text}</div>;
  };

  // Format problem title with hierarchy numbering (e.g. 1.1.1. Armstrong)
  const formattedTitle = `${displayIndex}. ${question.title}`;

  return (
    <div className="h-full flex flex-col bg-[#0f141f] border-r border-[#1d2538] text-slate-200 select-text overflow-hidden">
      {/* Center Column Header (matching screenshot) */}
      <div className="h-11 px-4 bg-[#131926] border-b border-[#1e273a] flex items-center justify-between shrink-0 select-none">
        {/* Title */}
        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
          <h1 className="text-sm font-bold text-slate-100 truncate tracking-tight">
            {formattedTitle}
          </h1>
        </div>

        {/* Right utility toolbar: Timer badge, AA, Theme, Notes, Reload, Link, Maximize */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Timer pill: starts at 00:00, counts up, stops only when solution is solved */}
          <div
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold transition select-none ${
              isSolved
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/60 shadow-sm'
                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            }`}
            title={
              isSolved
                ? `Solved in ${formatTimer(Math.max(1, timerSeconds))}`
                : 'Elapsed Problem Time (running)'
            }
          >
            {isSolved ? (
              <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
            <span>{formatTimer(isSolved ? Math.max(1, timerSeconds) : timerSeconds)}</span>
            {isSolved && (
              <span className="text-[10px] uppercase font-sans font-extrabold text-emerald-300 tracking-wider">
                Solved
              </span>
            )}
          </div>

          {/* AA Font size adjuster */}
          <button
            onClick={() => setFontSizeIndex((prev) => (prev + 1) % 3)}
            className="w-7 h-7 rounded hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center text-xs font-bold font-serif transition"
            title="Adjust text size (AA)"
          >
            AA
          </button>

          {/* Theme icon */}
          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 flex items-center justify-center transition"
              title="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          {/* Notes icon */}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`w-7 h-7 rounded flex items-center justify-center transition ${
              showNotes ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Question notes"
          >
            <FileEdit className="w-3.5 h-3.5" />
          </button>

          {/* Reset timer to 0 */}
          <button
            onClick={() => {
              if (question?.question_id) {
                localStorage.removeItem(`codementor_solved_time_${question.question_id}`);
              }
              startTimeRef.current = Date.now();
              setTimerSeconds(0);
              setIsTimerRunning(true);
            }}
            className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
            title="Reset timer to 00:00"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
            title="Copy problem link"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5" />}
          </button>

          {/* Fullscreen / expand */}
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
            title="Toggle fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* User Notes Drawer (if opened) */}
      {showNotes && (
        <div className="p-3 bg-[#161c2a] border-b border-[#242f46] space-y-2 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Scratchpad & Notes:</span>
            <span className="text-[10px] text-slate-500">Auto-saved</span>
          </div>
          <textarea
            value={userNotes}
            onChange={(e) => handleSaveNotes(e.target.value)}
            placeholder="Write personal thoughts, algorithm hints, or edge cases here..."
            className="w-full h-20 bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none font-mono"
          />
        </div>
      )}

      {/* Problem Content (matching screenshot typography & structure) */}
      <div className={`flex-1 overflow-y-auto p-6 space-y-5 ${fontSizes[fontSizeIndex]} text-slate-300`}>
        {/* Main Problem Statement */}
        <div className="space-y-3">
          <div className="text-slate-100 font-normal leading-relaxed">
            {renderProblemStatement(question.problem_statement)}
          </div>

          {question.objective && (
            <div className="text-slate-400 text-xs italic pl-3 border-l-2 border-cyan-500/40">
              {question.objective}
            </div>
          )}
        </div>

        {/* Editorial / Examples section (formatted like the screenshot) */}
        {question.sample_inputs && question.sample_inputs.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              For example:
            </h3>

            {question.sample_inputs.map((inp, idx) => (
              <div
                key={idx}
                className="bg-[#141a27] rounded-lg p-3.5 border border-[#212b3e] space-y-2 font-mono text-xs"
              >
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span className="text-cyan-400 font-semibold font-sans">
                    Sample {idx + 1}:
                  </span>
                  <button
                    onClick={() => {
                      onCopyToStdin(inp);
                      setCopiedIndex(idx);
                      setTimeout(() => setCopiedIndex(null), 2000);
                    }}
                    className="text-slate-400 hover:text-white flex items-center space-x-1"
                    title="Copy sample input to stdin"
                  >
                    {copiedIndex === idx ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>Copy Input</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="text-slate-400 text-[11px] font-sans">Input:</div>
                  <pre className="text-slate-200 bg-[#0d121c] p-2 rounded border border-[#1d2638] overflow-x-auto whitespace-pre">
                    {inp}
                  </pre>
                </div>

                {question.sample_outputs && question.sample_outputs[idx] && (
                  <div className="space-y-1 pt-1">
                    <div className="text-slate-400 text-[11px] font-sans">Output:</div>
                    <pre className="text-emerald-300 bg-[#0d121c] p-2 rounded border border-[#1d2638] overflow-x-auto whitespace-pre">
                      {question.sample_outputs[idx]}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Input / Output Format Specifications */}
        {(question.input_format || question.output_format) && (
          <div className="space-y-2.5 pt-2 border-t border-[#1e273a]">
            {question.input_format && (
              <div>
                <span className="text-xs font-bold text-slate-300">Input format: </span>
                <span className="text-xs text-slate-400 whitespace-pre-wrap">{question.input_format}</span>
              </div>
            )}
            {question.output_format && (
              <div>
                <span className="text-xs font-bold text-slate-300">Output format: </span>
                <span className="text-xs text-slate-400 whitespace-pre-wrap">{question.output_format}</span>
              </div>
            )}
          </div>
        )}

        {/* Constraints block (matching screenshot) */}
        {question.constraints && (
          <div className="space-y-2 pt-2 border-t border-[#1e273a]">
            <h4 className="text-xs font-bold text-slate-400 tracking-wide">
              Constraints to be followed:
            </h4>
            <div className="font-mono text-xs font-semibold text-slate-200 bg-[#141b28] px-3.5 py-2.5 rounded-md border border-[#232d42] whitespace-pre-line">
              {question.constraints}
            </div>
          </div>
        )}

        {/* Progressive Hints (collapsible) */}
        {question.hints && question.hints.length > 0 && (
          <div className="pt-2 border-t border-[#1e273a] space-y-2">
            <button
              onClick={() => setHintsExpanded(!hintsExpanded)}
              className="flex items-center justify-between w-full text-xs font-semibold text-amber-300 hover:text-amber-200 py-1"
            >
              <span className="flex items-center space-x-1.5">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Hints ({question.hints.length})</span>
              </span>
              {hintsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {hintsExpanded && (
              <div className="space-y-2 pl-1">
                {question.hints.map((hint, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-[#171d2b] rounded border border-amber-500/20 text-xs text-slate-300 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-400 text-[11px]">
                        Hint {idx + 1}
                      </span>
                      <button
                        onClick={() =>
                          setRevealedHints((prev) => ({
                            ...prev,
                            [idx]: !prev[idx],
                          }))
                        }
                        className="text-[11px] text-amber-300 hover:underline"
                      >
                        {revealedHints[idx] ? 'Hide' : 'Reveal'}
                      </button>
                    </div>
                    {revealedHints[idx] ? (
                      <p className="text-slate-200 pt-1 leading-relaxed whitespace-pre-wrap">{hint}</p>
                    ) : (
                      <p className="text-slate-500 italic text-[11px]">Click reveal to view hint</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reference Solution Section (matching screenshot capability) */}
        <div className="border border-purple-900/40 rounded-lg p-3.5 bg-purple-950/10 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <KeyRound className="w-3.5 h-3.5 text-purple-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                Reference Solution
              </h3>
            </div>

            {!isSolutionVisible && (
              <button
                onClick={() => {
                  if (isOwnerMode) {
                    handleRevealSolution();
                  } else {
                    setShowSolutionConfirm(true);
                  }
                }}
                className="flex items-center space-x-1.5 text-xs font-medium px-2.5 py-1 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded transition"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Reveal Solution</span>
              </button>
            )}
          </div>

          {/* Confirm reveal */}
          {showSolutionConfirm && (
            <div className="p-2.5 bg-slate-900 border border-purple-600/60 rounded space-y-2">
              <p className="text-xs text-amber-300 flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Try solving this problem yourself first! Are you sure?</span>
              </p>
              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={handleRevealSolution}
                  className="text-xs px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded transition"
                >
                  Yes, Show Solution
                </button>
                <button
                  onClick={() => setShowSolutionConfirm(false)}
                  className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isSolutionVisible && question.reference_solution && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-purple-300 font-medium">
                  Official Solution:
                </span>
                <button
                  onClick={() => onLoadSolutionToEditor(question.reference_solution!)}
                  className="text-xs text-purple-200 hover:text-white bg-purple-900/60 hover:bg-purple-800 px-2 py-0.5 rounded border border-purple-700/60 transition"
                >
                  Load Solution into Editor
                </button>
              </div>
              <pre className="bg-[#0b0e15] p-3 rounded border border-purple-900/50 font-mono text-xs text-purple-200 overflow-x-auto whitespace-pre leading-relaxed">
                {question.reference_solution}
              </pre>
            </div>
          )}

          {isSolutionVisible && !question.reference_solution && (
            <p className="text-xs italic text-slate-500">
              No reference solution was provided for this question in the CSV.
            </p>
          )}
        </div>
      </div>

      {/* Diagram Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="px-4 py-2.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold text-slate-200 truncate pr-4">
                {lightboxImage.alt || 'Problem Diagram Preview'}
              </span>
              <div className="flex items-center space-x-2 shrink-0">
                <a
                  href={lightboxImage.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center space-x-1.5 transition text-xs"
                  title="Open original image in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Tab</span>
                </a>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="w-7 h-7 rounded hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Image container */}
            <div className="p-4 overflow-auto max-h-[calc(92vh-60px)] flex items-center justify-center bg-white">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.alt || 'Full size diagram'}
                className="max-w-full max-h-[80vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
