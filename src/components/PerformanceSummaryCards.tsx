import React from 'react';
import { ExternalLink, TrendingUp, TrendingDown, Clock, AlertTriangle, Percent, Calendar } from 'lucide-react';
import { CompanyQuarterData, formatFinancialValue, getLast4QuartersData } from '../utils/financial_utils';

interface PerformanceSummaryCardsProps {
  companies: CompanyQuarterData[];
  onSelectCompanyTab?: (companyName: string) => void;
  metric?: string;
}

export const PerformanceSummaryCards: React.FC<PerformanceSummaryCardsProps> = ({
  companies,
  onSelectCompanyTab,
  metric = 'Net Profit',
}) => {
  const successful = companies.filter((c) => c.found && !c.error);
  const failed = companies.filter((c) => !c.found || c.error);

  if (companies.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Error alerts if any company failed */}
      {failed.length > 0 && (
        <div className="space-y-2">
          {failed.map((fail, idx) => (
            <div
              key={fail.query + idx}
              className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/40 p-3.5 text-xs text-red-900 dark:text-red-300 shadow-xs"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <span className="font-semibold text-red-950 dark:text-red-200">Lookup Notice: </span>
                <span>{fail.error || `Could not resolve "${fail.query}" on Screener.in.`}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Successful Company Performance Cards */}
      {successful.length > 0 && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">
              Recent Quarter Financial Summaries & 4-Quarter Trajectory
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Figures in ₹ Crores (Sourced from Screener.in)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {successful.map((comp) => {
              const summary = comp.summary;
              const opmList = comp.allRows?.['OPM %'] || [];
              const latestOpm = opmList.length > 0 ? opmList[opmList.length - 1] : null;

              const isQoqPositive = (summary?.qoqChange || 0) >= 0;
              const isYoyPositive = (summary?.yoyChange || 0) >= 0;

              // Last 4 quarters data
              const last4 = getLast4QuartersData(comp, metric);

              return (
                <div
                  key={comp.name}
                  className="relative flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 p-4 shadow-sm hover:border-blue-400 dark:hover:border-blue-500 transition-all"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3
                          className="truncate text-sm font-bold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
                          onClick={() => onSelectCompanyTab?.(comp.name)}
                          title={comp.name}
                        >
                          {comp.name}
                        </h3>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            Latest: <strong className="text-slate-700 dark:text-slate-200">{summary?.latestQuarter || 'N/A'}</strong>
                          </span>
                          {comp.fromCache ? (
                            <span className="rounded bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.2 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                              ⚡ Cached
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                              🌐 Live
                            </span>
                          )}
                        </div>
                      </div>

                      {comp.url && (
                        <a
                          href={`https://www.screener.in${comp.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View company on Screener.in"
                          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-blue-600 transition-colors"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>

                    {/* Main KPI: Latest Metric Value */}
                    <div className="mt-3 border-t border-slate-100 dark:border-slate-700/70 pt-2.5">
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Quarterly {metric} ({summary?.latestQuarter})
                      </div>
                      <div className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        {formatFinancialValue(summary?.latestProfit)}
                      </div>
                    </div>

                    {/* QoQ & YoY Changes */}
                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                      {/* QoQ */}
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-2 border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">QoQ Change</div>
                        <div className="mt-0.5 flex items-center gap-1 font-semibold">
                          {summary?.qoqChange !== null ? (
                            <>
                              {isQoqPositive ? (
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                              )}
                              <span className={isQoqPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                                {formatFinancialValue(summary?.qoqChange)}
                              </span>
                              <span className={`text-[10px] font-normal ${isQoqPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                ({summary?.qoqChangePct ? (summary.qoqChangePct > 0 ? `+${summary.qoqChangePct.toFixed(1)}%` : `${summary.qoqChangePct.toFixed(1)}%`) : '0%'})
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </div>

                      {/* YoY */}
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-2 border border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">YoY Change</div>
                        <div className="mt-0.5 flex items-center gap-1 font-semibold">
                          {summary?.yoyChange !== null ? (
                            <>
                              {isYoyPositive ? (
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <TrendingDown className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                              )}
                              <span className={isYoyPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                                {formatFinancialValue(summary?.yoyChange)}
                              </span>
                              <span className={`text-[10px] font-normal ${isYoyPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                ({summary?.yoyChangePct ? (summary.yoyChangePct > 0 ? `+${summary.yoyChangePct.toFixed(1)}%` : `${summary.yoyChangePct.toFixed(1)}%`) : '0%'})
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* NEW: Last 4 Quarters Trajectory Mini-Grid */}
                    {last4.length > 0 && (
                      <div className="mt-3 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/40 p-2.5">
                        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-blue-500" />
                            Last 4 Quarters Trend ({metric})
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 text-center">
                          {last4.map((qItem, qIdx) => {
                            const isLatest = qIdx === last4.length - 1;
                            const isNeg = qItem.num !== null && qItem.num < 0;

                            return (
                              <div
                                key={qItem.quarter}
                                className={`rounded p-1 transition-colors ${
                                  isLatest
                                    ? 'bg-blue-100/70 dark:bg-blue-900/40 font-bold border border-blue-200 dark:border-blue-800'
                                    : 'bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700'
                                }`}
                              >
                                <div className="text-[9px] text-slate-500 dark:text-slate-400 truncate">
                                  {qItem.quarter}
                                </div>
                                <div
                                  className={`text-[11px] font-mono mt-0.5 truncate ${
                                    isNeg
                                      ? 'text-rose-600 dark:text-rose-400 font-bold'
                                      : isLatest
                                      ? 'text-blue-900 dark:text-blue-200 font-bold'
                                      : 'text-slate-800 dark:text-slate-200'
                                  }`}
                                  title={`${qItem.quarter}: ₹ ${qItem.raw} Cr`}
                                >
                                  {qItem.raw !== '-' ? qItem.raw : '-'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Operating Margin Footer */}
                  {latestOpm && (
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-700/60 pt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Percent className="h-3 w-3 text-slate-400" />
                        Operating Margin (OPM):
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{latestOpm}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
