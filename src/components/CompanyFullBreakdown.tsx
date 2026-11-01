import React, { useState } from 'react';
import { Layers, ArrowUpRight } from 'lucide-react';
import { CompanyQuarterData } from '../utils/financial_utils';

interface CompanyFullBreakdownProps {
  companies: CompanyQuarterData[];
  selectedCompanyName?: string;
  onSelectCompanyName?: (name: string) => void;
  maxQuarters?: number;
}

const LINE_ITEM_ORDER = [
  'Sales',
  'Expenses',
  'Operating Profit',
  'OPM %',
  'Other Income',
  'Interest',
  'Depreciation',
  'Profit before tax',
  'Tax %',
  'Net Profit',
  'EPS in Rs',
];

export const CompanyFullBreakdown: React.FC<CompanyFullBreakdownProps> = ({
  companies,
  selectedCompanyName,
  onSelectCompanyName,
  maxQuarters = 8,
}) => {
  const successful = companies.filter((c) => c.found && !c.error);
  const [internalSelected, setInternalSelected] = useState<string>(
    successful[0]?.name || ''
  );

  const activeName = selectedCompanyName || internalSelected || successful[0]?.name || '';
  const currentCompany = successful.find((c) => c.name === activeName) || successful[0];

  if (!currentCompany) return null;

  const quarters = (currentCompany.quarters || []).slice(-maxQuarters);
  const allRows = currentCompany.allRows || {};

  // Sort rows: prioritized items first, then others
  const rowKeys = Object.keys(allRows);
  const sortedRowKeys: string[] = [];

  LINE_ITEM_ORDER.forEach((item) => {
    if (rowKeys.includes(item)) {
      sortedRowKeys.push(item);
    }
  });

  rowKeys.forEach((item) => {
    if (!sortedRowKeys.includes(item)) {
      sortedRowKeys.push(item);
    }
  });

  const handleTabClick = (name: string) => {
    if (onSelectCompanyName) {
      onSelectCompanyName(name);
    } else {
      setInternalSelected(name);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 shadow-sm overflow-hidden transition-colors">
      {/* Header with Company Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/60 px-5 pt-3.5 pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Full Quarterly Financial Statement Breakdown
            </h2>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            All rows extracted live from Screener.in
          </span>
        </div>

        {/* Company Selection Tabs */}
        <div className="flex flex-wrap gap-1">
          {successful.map((comp) => {
            const isSelected = comp.name === activeName;
            return (
              <button
                key={comp.name}
                type="button"
                onClick={() => handleTabClick(comp.name)}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'border-blue-600 dark:border-blue-400 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-xs'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{comp.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto p-0">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-100/60 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider">
              <th className="sticky left-0 z-10 bg-slate-100/95 dark:bg-slate-900/95 py-2.5 px-4 font-bold text-slate-900 dark:text-white min-w-[220px]">
                Line Item (Rs. Cr)
              </th>
              {quarters.map((q) => (
                <th key={q} className="py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-300 min-w-[100px]">
                  {q}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
            {sortedRowKeys.map((rowName) => {
              const fullSeries = allRows[rowName] || [];
              const slicedVals = fullSeries.slice(-maxQuarters);
              const isHighlight = rowName === 'Net Profit' || rowName === 'Operating Profit' || rowName === 'Sales';

              return (
                <tr
                  key={rowName}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                    isHighlight ? 'bg-blue-50/20 dark:bg-blue-950/20 font-semibold' : ''
                  }`}
                >
                  <td
                    className={`sticky left-0 z-10 bg-white dark:bg-slate-800 py-2.5 px-4 font-sans text-xs border-r border-slate-100 dark:border-slate-700/80 ${
                      isHighlight
                        ? 'font-bold text-blue-950 dark:text-blue-300 bg-blue-50/30 dark:bg-slate-800'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {rowName}
                  </td>
                  {slicedVals.map((val, idx) => {
                    const isNeg = val && val.startsWith('-');
                    return (
                      <td
                        key={idx}
                        className={`py-2.5 px-3 text-right text-xs ${
                          isNeg
                            ? 'text-rose-600 dark:text-rose-400 font-medium'
                            : isHighlight
                            ? 'text-slate-950 dark:text-white font-bold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {val || '-'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/40 px-4 py-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span>Source: Screener.in ({currentCompany.name})</span>
        {currentCompany.url && (
          <a
            href={`https://www.screener.in${currentCompany.url}#quarters`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>View Quarters Tab on Screener</span>
            <ArrowUpRight className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
};
