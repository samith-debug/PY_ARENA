import React, { useState } from 'react';
import {
  X,
  GitCompare,
  PlusCircle,
  MinusCircle,
  FileEdit,
  CheckCircle2,
  Download,
  Search,
  Loader2
} from 'lucide-react';
import type { QuestionBankMeta, CompareResult } from '../types';
import { compareBanks } from '../api';

interface CompareModalProps {
  banks: QuestionBankMeta[];
  isOpen: boolean;
  onClose: () => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  banks,
  isOpen,
  onClose
}) => {
  const [bank1Id, setBank1Id] = useState<string>(banks[0]?.id || '');
  const [bank2Id, setBank2Id] = useState<string>(banks[1]?.id || '');
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDiffs, setExpandedDiffs] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const handleRunCompare = async () => {
    if (!bank1Id || !bank2Id || bank1Id === bank2Id) return;
    setIsLoading(true);
    try {
      const res = await compareBanks(bank1Id, bank2Id);
      setCompareResult(res);
    } catch (err: any) {
      alert(`Comparison failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (qid: string) => {
    setExpandedDiffs((prev) => ({ ...prev, [qid]: !prev[qid] }));
  };

  const filteredDiffs = (compareResult?.diffs || []).filter((d) => {
    if (filterType !== 'all' && d.diff_type !== filterType) return false;
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      const matchId = d.question_id.toLowerCase().includes(s);
      const matchTitle1 = d.title_1?.toLowerCase().includes(s);
      const matchTitle2 = d.title_2?.toLowerCase().includes(s);
      if (!matchId && !matchTitle1 && !matchTitle2) return false;
    }
    return true;
  });

  const exportJson = () => {
    if (!compareResult) return;
    const blob = new Blob([JSON.stringify(compareResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `csv_comparison_${compareResult.bank_1_name}_vs_${compareResult.bank_2_name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <GitCompare className="w-5 h-5 text-purple-400" />
            <h2 className="font-bold text-sm text-slate-100">
              CSV Question Bank Version Comparison
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bank Selectors Toolbar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Base CSV (Version A):
              </label>
              <select
                value={bank1Id}
                onChange={(e) => setBank1Id(e.target.value)}
                className="bg-slate-800 text-xs px-2.5 py-1.5 rounded border border-slate-700 text-slate-200 focus:outline-none"
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.filename}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-500 font-bold pt-4">vs</span>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Target CSV (Version B):
              </label>
              <select
                value={bank2Id}
                onChange={(e) => setBank2Id(e.target.value)}
                className="bg-slate-800 text-xs px-2.5 py-1.5 rounded border border-slate-700 text-slate-200 focus:outline-none"
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.filename}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-4">
              <button
                onClick={handleRunCompare}
                disabled={isLoading || !bank1Id || !bank2Id || bank1Id === bank2Id}
                className="flex items-center space-x-1.5 text-xs font-semibold px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white rounded transition"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />}
                <span>Compare Versions</span>
              </button>
            </div>
          </div>

          {compareResult && (
            <div className="flex items-center space-x-2 pt-4">
              <button
                onClick={exportJson}
                className="flex items-center space-x-1 text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
              >
                <Download className="w-3.5 h-3.5 text-purple-400" />
                <span>Export Diff (JSON)</span>
              </button>
            </div>
          )}
        </div>

        {/* Comparison Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!compareResult ? (
            <div className="py-16 text-center text-xs text-slate-500">
              Select two CSV versions and click "Compare Versions" to view changes.
            </div>
          ) : (
            <>
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-[11px] text-slate-400 block mb-0.5">Base Version (A)</span>
                  <span className="text-sm font-bold text-slate-200">
                    {compareResult.summary.bank_1_total} Qs
                  </span>
                </div>
                <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                  <span className="text-[11px] text-slate-400 block mb-0.5">Target Version (B)</span>
                  <span className="text-sm font-bold text-slate-200">
                    {compareResult.summary.bank_2_total} Qs
                  </span>
                </div>
                <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-lg">
                  <span className="text-[11px] text-purple-300 block mb-0.5">Modified Questions</span>
                  <span className="text-sm font-bold text-purple-400">
                    {compareResult.summary.modified}
                  </span>
                </div>
                <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-lg">
                  <span className="text-[11px] text-emerald-300 block mb-0.5">Identical Questions</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {compareResult.summary.identical}
                  </span>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-medium">Filter:</span>
                  {['all', 'modified', 'added', 'removed', 'unchanged'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`text-xs px-2.5 py-1 rounded capitalize font-medium transition ${
                        filterType === type
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search diff by ID or Title..."
                    className="w-full bg-slate-950 border border-slate-800 rounded text-xs pl-8 pr-3 py-1 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Diff Cards List */}
              <div className="space-y-2">
                {filteredDiffs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No questions match the selected filter.
                  </div>
                ) : (
                  filteredDiffs.map((d) => {
                    const isExpanded = expandedDiffs[d.question_id] ?? (d.diff_type === 'modified');

                    return (
                      <div
                        key={d.question_id}
                        className={`rounded-lg border overflow-hidden transition ${
                          d.diff_type === 'modified'
                            ? 'border-purple-800/60 bg-purple-950/10'
                            : d.diff_type === 'added'
                            ? 'border-emerald-800/60 bg-emerald-950/10'
                            : d.diff_type === 'removed'
                            ? 'border-rose-800/60 bg-rose-950/10'
                            : 'border-slate-800 bg-slate-950/30'
                        }`}
                      >
                        <button
                          onClick={() => toggleExpand(d.question_id)}
                          className="w-full text-left p-3 flex items-center justify-between hover:bg-slate-800/20"
                        >
                          <div className="flex items-center space-x-2.5">
                            {d.diff_type === 'modified' && (
                              <FileEdit className="w-4 h-4 text-purple-400" />
                            )}
                            {d.diff_type === 'added' && (
                              <PlusCircle className="w-4 h-4 text-emerald-400" />
                            )}
                            {d.diff_type === 'removed' && (
                              <MinusCircle className="w-4 h-4 text-rose-400" />
                            )}
                            {d.diff_type === 'unchanged' && (
                              <CheckCircle2 className="w-4 h-4 text-slate-500" />
                            )}

                            <span className="font-mono text-xs font-bold text-slate-200">
                              {d.question_id}
                            </span>
                            <span className="text-xs text-slate-300 font-medium">
                              {d.title_2 || d.title_1 || 'Untitled'}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                d.diff_type === 'modified'
                                  ? 'bg-purple-500/20 text-purple-300'
                                  : d.diff_type === 'added'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : d.diff_type === 'removed'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {d.diff_type}
                              {d.changed_fields.length > 0 && ` (${d.changed_fields.join(', ')})`}
                            </span>
                          </div>
                        </button>

                        {/* Detailed Field Diffs */}
                        {isExpanded && d.field_diffs && Object.keys(d.field_diffs).length > 0 && (
                          <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 space-y-3 font-mono text-xs">
                            {Object.entries(d.field_diffs).map(([fieldName, diffObj]: [string, any]) => (
                              <div key={fieldName} className="space-y-1">
                                <span className="text-indigo-400 font-bold uppercase text-[10px] font-sans">
                                  Field: {fieldName}
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                  <div className="p-2 rounded bg-slate-900 border border-slate-800">
                                    <span className="text-[10px] text-slate-500 block mb-0.5 font-sans">
                                      Version A ({compareResult.bank_1_name}):
                                    </span>
                                    <pre className="text-slate-300 whitespace-pre-wrap">
                                      {typeof diffObj.bank_1 === 'object'
                                        ? JSON.stringify(diffObj.bank_1, null, 2)
                                        : String(diffObj.bank_1 || '<empty>')}
                                    </pre>
                                  </div>

                                  <div className="p-2 rounded bg-purple-950/20 border border-purple-900/60">
                                    <span className="text-[10px] text-purple-400 block mb-0.5 font-sans">
                                      Version B ({compareResult.bank_2_name}):
                                    </span>
                                    <pre className="text-purple-200 whitespace-pre-wrap">
                                      {typeof diffObj.bank_2 === 'object'
                                        ? JSON.stringify(diffObj.bank_2, null, 2)
                                        : String(diffObj.bank_2 || '<empty>')}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
