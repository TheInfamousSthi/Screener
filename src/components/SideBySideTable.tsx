import React, { useState } from 'react';
import { Download, FileSpreadsheet, Copy, Check, Table2, Info } from 'lucide-react';
import { generateComparisonCsv } from '../utils/financial_utils';
import { generateStyledExcelXml } from '../utils/excel_export';

interface SideBySideTableProps {
  quarters: string[];
  rows: Array<{
    company: string;
    query: string;
    values: Array<{ quarter: string; raw: string; num: number | null }>;
  }>;
  metric: string;
  onSelectCompany?: (companyName: string) => void;
}

export const SideBySideTable: React.FC<SideBySideTableProps> = ({
  quarters,
  rows,
  metric,
  onSelectCompany,
}) => {
  const [copied, setCopied] = useState(false);

  if (!quarters || quarters.length === 0 || !rows || rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 p-8 text-center text-slate-500 dark:text-slate-400">
        <Table2 className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-sm">No comparison data available. Enter companies and click Fetch Financial Data.</p>
      </div>
    );
  }

  // Find max value per quarter column to highlight leader
  const maxPerQuarter: Record<string, number> = {};
  quarters.forEach((q, qIdx) => {
    let max = -Infinity;
    rows.forEach((r) => {
      const val = r.values[qIdx]?.num;
      if (val !== null && val !== undefined && val > max) {
        max = val;
      }
    });
    if (max !== -Infinity) {
      maxPerQuarter[q] = max;
    }
  });

  // Export handlers
  const handleDownloadCsv = () => {
    const csvContent = generateComparisonCsv(quarters, rows, metric);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `screener_${metric.toLowerCase().replace(/[^a-z0-9]/g, '_')}_comparison.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcelTable = () => {
    // Generate genuine styled SpreadsheetML table
    const xmlContent = generateStyledExcelXml(quarters, rows, metric);
    const blob = new Blob([xmlContent], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `screener_${metric.toLowerCase().replace(/[^a-z0-9]/g, '_')}_table.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    const csvContent = generateComparisonCsv(quarters, rows, metric);
    try {
      await navigator.clipboard.writeText(csvContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 shadow-sm overflow-hidden transition-colors">
      {/* Header & Export Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/60 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Side-by-Side Comparison: <span className="text-blue-600 dark:text-blue-400">{metric}</span>
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
            (Chronologically aligned across {quarters.length} quarters)
          </span>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCsv}
            title="Download formatted CSV file"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>CSV</span>
          </button>

          <button
            onClick={handleDownloadExcelTable}
            title="Download styled Excel table with bold headers, colors & real numbers"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/80 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 shadow-xs transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Excel Table (.xls)</span>
          </button>

          <button
            onClick={handleCopyToClipboard}
            title="Copy table data as text"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-500" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table Surface */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-100/60 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider">
              <th className="sticky left-0 z-20 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-xs py-3 px-4 font-bold text-slate-900 dark:text-white min-w-[200px]">
                Company Name
              </th>
              {quarters.map((q) => (
                <th key={q} className="py-3 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 min-w-[105px]">
                  {q}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row, rIdx) => {
              return (
                <tr
                  key={row.company + rIdx}
                  className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors group"
                >
                  {/* Sticky Company Column */}
                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-800 group-hover:bg-blue-50/40 dark:group-hover:bg-slate-800 py-3 px-4 font-semibold text-slate-900 dark:text-white border-r border-slate-100 dark:border-slate-700/80 transition-colors">
                    <button
                      type="button"
                      onClick={() => onSelectCompany?.(row.company)}
                      className="text-left font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none"
                    >
                      {row.company}
                    </button>
                  </td>

                  {/* Quarter Values */}
                  {row.values.map((valObj, vIdx) => {
                    const raw = valObj.raw;
                    const num = valObj.num;
                    const quarter = quarters[vIdx];
                    const isMax = num !== null && maxPerQuarter[quarter] === num && rows.length > 1;
                    const isNegative = num !== null && num < 0;

                    return (
                      <td
                        key={quarter + vIdx}
                        className={`py-3 px-3 text-right font-mono transition-colors ${
                          isNegative
                            ? 'text-rose-600 dark:text-rose-400 font-medium'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {raw === '-' || !raw ? (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        ) : (
                          <span
                            className={
                              isMax
                                ? 'rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                                : ''
                            }
                          >
                            {isNegative ? `(${raw.replace('-', '')})` : raw}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Note */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 px-4 py-2.5 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          <span>Values in ₹ Crores unless metric is percentage (OPM %) or EPS (₹ per share).</span>
        </div>
        {rows.length > 1 && (
          <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>Green badge indicates highest value in that quarter</span>
          </div>
        )}
      </div>
    </div>
  );
};
