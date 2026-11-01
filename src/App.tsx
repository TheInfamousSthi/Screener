import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { CompanySearchInput } from './components/CompanySearchInput';
import { PerformanceSummaryCards } from './components/PerformanceSummaryCards';
import { SideBySideTable } from './components/SideBySideTable';
import { QuarterlyTrendChart } from './components/QuarterlyTrendChart';
import { CompanyFullBreakdown } from './components/CompanyFullBreakdown';
import { CompanyQuarterData, alignCompaniesQuarters } from './utils/financial_utils';
import { Loader2, AlertCircle } from 'lucide-react';

export default function App() {
  // Theme state: dark / light mode with localStorage persistence
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('screener_theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('screener_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('screener_theme', 'light');
    }
  }, [darkMode]);

  const [companies, setCompanies] = useState<string[]>(['TCS', 'Infosys']);
  const [metric, setMetric] = useState<string>('Net Profit');
  const [maxQuarters, setMaxQuarters] = useState<number>(8);
  const [forceRefresh, setForceRefresh] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [companiesData, setCompaniesData] = useState<CompanyQuarterData[]>([]);
  const [selectedBreakdownCompany, setSelectedBreakdownCompany] = useState<string>('');
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);

  // Fetch financial data from Screener API
  const handleFetchFinancials = useCallback(
    async (
      targetCompanies = companies,
      targetMetric = metric,
      targetQuarters = maxQuarters,
      targetForceRefresh = forceRefresh
    ) => {
      if (!targetCompanies || targetCompanies.length === 0) return;

      setIsLoading(true);
      setGeneralError(null);

      try {
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companies: targetCompanies,
            metric: targetMetric,
            maxQuarters: targetQuarters,
            forceRefresh: targetForceRefresh,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Server returned HTTP ${res.status}`);
        }

        const data = await res.json();
        const results = data.results || [];
        setCompaniesData(results);

        const successful = results.filter((c: CompanyQuarterData) => c.found && !c.error);
        if (successful.length > 0 && !selectedBreakdownCompany) {
          setSelectedBreakdownCompany(successful[0].name);
        }
      } catch (err: any) {
        console.error('Fetch error:', err);
        setGeneralError(err.message || 'Failed to fetch financial data from Screener.in.');
      } finally {
        setIsLoading(false);
      }
    },
    [companies, metric, maxQuarters, forceRefresh, selectedBreakdownCompany]
  );

  // Initial load
  useEffect(() => {
    handleFetchFinancials(['TCS', 'Infosys'], 'Net Profit', 8, false);
  }, []);

  // INSTANT CLIENT-SIDE ALIGNMENT:
  // When metric or maxQuarters change, recalculate side-by-side alignment in memory!
  // This makes metric and quarters switching instantaneous with zero lag!
  const comparison = useMemo(() => {
    const successful = companiesData.filter((r) => r.found && !r.error);
    if (successful.length === 0) {
      return { quarters: [], rows: [] };
    }
    return alignCompaniesQuarters(successful, metric, maxQuarters);
  }, [companiesData, metric, maxQuarters]);

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await fetch('/api/cache/clear', { method: 'POST' });
      await handleFetchFinancials(companies, metric, maxQuarters, true);
    } catch (err) {
      console.error('Failed to clear cache:', err);
    } finally {
      setIsClearingCache(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      <Navbar
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onClearCache={handleClearCache}
        isClearingCache={isClearingCache}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Search Input Bar */}
        <CompanySearchInput
          companies={companies}
          setCompanies={setCompanies}
          metric={metric}
          setMetric={setMetric}
          maxQuarters={maxQuarters}
          setMaxQuarters={setMaxQuarters}
          forceRefresh={forceRefresh}
          setForceRefresh={setForceRefresh}
          onFetch={() => handleFetchFinancials(companies, metric, maxQuarters, forceRefresh)}
          isLoading={isLoading}
        />

        {/* General Network Error Banner */}
        {generalError && (
          <div className="flex items-center gap-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-4 text-xs font-medium text-red-800 dark:text-red-300 shadow-xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
            <span>{generalError}</span>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-8 text-center text-blue-800 dark:text-blue-300">
            <Loader2 className="h-7 w-7 animate-spin text-blue-600 dark:text-blue-400 mb-2" />
            <div className="text-sm font-semibold">
              Connecting to Screener.in & Parsing Financial Quarters...
            </div>
            <div className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
              Polite rate-limiting delay active (400ms per request)
            </div>
          </div>
        )}

        {/* Performance Summary Cards with 4-Quarter Trend Strip */}
        {companiesData.length > 0 && !isLoading && (
          <PerformanceSummaryCards
            companies={companiesData}
            onSelectCompanyTab={(compName) => setSelectedBreakdownCompany(compName)}
            metric={metric}
          />
        )}

        {/* Aligned Side-by-Side Comparison Table with Genuine Excel XML Export */}
        {comparison.quarters.length > 0 && comparison.rows.length > 0 && !isLoading && (
          <SideBySideTable
            quarters={comparison.quarters}
            rows={comparison.rows}
            metric={metric}
            onSelectCompany={(compName) => setSelectedBreakdownCompany(compName)}
          />
        )}

        {/* Quarterly Trend Chart with Auto-Zoom for Small Profit Figures */}
        {comparison.quarters.length > 0 && comparison.rows.length > 0 && !isLoading && (
          <QuarterlyTrendChart
            quarters={comparison.quarters}
            rows={comparison.rows}
            metric={metric}
          />
        )}

        {/* Detailed Full Financial Statement Breakdown */}
        {companiesData.length > 0 && !isLoading && (
          <CompanyFullBreakdown
            companies={companiesData}
            selectedCompanyName={selectedBreakdownCompany}
            onSelectCompanyName={(compName) => setSelectedBreakdownCompany(compName)}
            maxQuarters={maxQuarters}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Screener.in Financial Data Scraper & Side-by-Side Comparison
          </div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500">
            Source: <a href="https://www.screener.in" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Screener.in</a> • Respecting terms & fair use.
          </div>
        </div>
      </footer>
    </div>
  );
}
