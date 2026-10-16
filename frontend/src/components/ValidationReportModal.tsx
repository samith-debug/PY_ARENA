import React from 'react';
import {
  X,
  FileCheck,
  AlertTriangle,
  AlertCircle,
  Download,
  CheckCircle2
} from 'lucide-react';
import type { ValidationReport } from '../types';
import { getExportValidationReportUrl } from '../api';

interface ValidationReportModalProps {
  bankId: string;
  report: ValidationReport | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ValidationReportModal: React.FC<ValidationReportModalProps> = ({
  bankId,
  report,
  isOpen,
  onClose
}) => {
  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <FileCheck className="w-5 h-5 text-indigo-400" />
            <div>
              <h2 className="font-bold text-sm text-slate-100">
                CSV Import Validation Report
              </h2>
              <p className="text-[11px] text-slate-400">{report.filename}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
              <span className="text-[11px] text-slate-400 block mb-0.5">Total Questions</span>
              <span className="text-lg font-bold text-slate-100">{report.total_questions}</span>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
              <span className="text-[11px] text-slate-400 block mb-0.5">Valid Questions</span>
              <span className="text-lg font-bold text-emerald-400">{report.valid_questions}</span>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
              <span className="text-[11px] text-slate-400 block mb-0.5">Total Test Cases</span>
              <span className="text-lg font-bold text-slate-100">{report.total_test_cases}</span>
              <span className="text-[10px] text-slate-500 block">
                {report.visible_test_cases} visible, {report.hidden_test_cases} hidden
              </span>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
              <span className="text-[11px] text-slate-400 block mb-0.5">Issues Found</span>
              <span
                className={`text-lg font-bold ${
                  report.issues.length === 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {report.issues.length}
              </span>
            </div>
          </div>

          {/* Duplicate IDs Alert */}
          {report.duplicate_ids.length > 0 && (
            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/60 space-y-1">
              <div className="flex items-center space-x-1.5 text-rose-400 text-xs font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>Duplicate Question IDs Detected:</span>
              </div>
              <p className="text-xs text-rose-300">
                {report.duplicate_ids.join(', ')}
              </p>
            </div>
          )}

          {/* Missing Required Fields Alert */}
          {report.missing_required_fields.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/60 space-y-1">
              <div className="flex items-center space-x-1.5 text-amber-400 text-xs font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>Missing Required Fields:</span>
              </div>
              <ul className="list-disc list-inside text-xs text-amber-300 space-y-0.5">
                {report.missing_required_fields.map((mf, i) => (
                  <li key={i}>{mf}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Malformed JSON Cells Table */}
          {report.malformed_json_cells.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>Malformed JSON Test Cases ({report.malformed_json_cells.length})</span>
              </h3>
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Question ID</th>
                      <th className="p-2.5">Column</th>
                      <th className="p-2.5">Error</th>
                      <th className="p-2.5">Raw Cell Content</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono">
                    {report.malformed_json_cells.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-2.5 text-slate-300">{m.row_number}</td>
                        <td className="p-2.5 text-indigo-400 font-bold">{m.question_id}</td>
                        <td className="p-2.5 text-slate-400">{m.column}</td>
                        <td className="p-2.5 text-rose-400 font-sans">{m.error}</td>
                        <td className="p-2.5 text-slate-500 max-w-xs truncate">{m.raw_preview}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* All Issues Log */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Detailed Issues Log ({report.issues.length})
            </h3>
            {report.issues.length === 0 ? (
              <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>All CSV records, columns, and test-case JSON arrays validated cleanly!</span>
              </div>
            ) : (
              <div className="border border-slate-800 rounded-lg divide-y divide-slate-800 max-h-60 overflow-y-auto">
                {report.issues.map((issue, idx) => (
                  <div key={idx} className="p-2.5 text-xs flex items-start space-x-2">
                    {issue.severity === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 pt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 pt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        {issue.question_id && (
                          <span className="font-mono font-bold text-indigo-400">
                            [{issue.question_id}]
                          </span>
                        )}
                        {issue.row_number && (
                          <span className="text-[11px] text-slate-500 font-mono">
                            Row {issue.row_number}
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            issue.severity === 'error'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {issue.severity}
                        </span>
                      </div>
                      <p className="text-slate-300 mt-0.5">{issue.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Downloads */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Export validation report to preserve schema verification artifacts.
          </span>
          <div className="flex items-center space-x-2">
            <a
              href={getExportValidationReportUrl(bankId, 'json')}
              download={`${report.filename}_validation_report.json`}
              className="flex items-center space-x-1 text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </a>
            <a
              href={getExportValidationReportUrl(bankId, 'csv')}
              download={`${report.filename}_validation_report.csv`}
              className="flex items-center space-x-1 text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
