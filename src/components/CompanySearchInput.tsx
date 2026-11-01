import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Sparkles, SlidersHorizontal, ArrowRight, X } from 'lucide-react';

interface CompanySearchInputProps {
  companies: string[];
  setCompanies: (comps: string[]) => void;
  metric: string;
  setMetric: (metric: string) => void;
  maxQuarters: number;
  setMaxQuarters: (n: number) => void;
  forceRefresh: boolean;
  setForceRefresh: (val: boolean) => void;
  onFetch: () => void;
  isLoading: boolean;
}

const PRESETS = [
  { label: 'IT Leaders', companies: ['TCS', 'Infosys', 'Wipro'] },
  { label: 'Auto Giants', companies: ['Tata Motors', 'Maruti Suzuki', 'Mahindra & Mahindra'] },
  { label: 'Top Banks', companies: ['HDFC Bank', 'ICICI Bank', 'State Bank of India'] },
  { label: 'FMCG Leaders', companies: ['ITC', 'Hindustan Unilever', 'Nestle India'] },
];

const METRICS = [
  { key: 'Net Profit', label: 'Quarterly Net Profit' },
  { key: 'Sales', label: 'Sales / Revenue' },
  { key: 'Operating Profit', label: 'Operating Profit (EBITDA)' },
  { key: 'OPM %', label: 'Operating Margin (OPM %)' },
  { key: 'Profit before tax', label: 'Profit Before Tax (PBT)' },
  { key: 'EPS in Rs', label: 'Earnings Per Share (EPS)' },
  { key: 'Expenses', label: 'Quarterly Expenses' },
];

export const CompanySearchInput: React.FC<CompanySearchInputProps> = ({
  companies,
  setCompanies,
  metric,
  setMetric,
  maxQuarters,
  setMaxQuarters,
  forceRefresh,
  setForceRefresh,
  onFetch,
  isLoading,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ name: string; url: string }>>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch autocomplete suggestions with debounce
  useEffect(() => {
    const trimmed = inputValue.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(Array.isArray(data) ? data.slice(0, 6) : []);
          setShowSuggestions(true);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearchingSuggestions(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inputValue]);

  const addCompany = (compName: string) => {
    const clean = compName.trim();
    if (clean && !companies.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      setCompanies([...companies, clean]);
    }
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeCompany = (index: number) => {
    setCompanies(companies.filter((_, idx) => idx !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.includes(',')) {
        const parts = inputValue.split(',').map((p) => p.trim()).filter(Boolean);
        const newComps = [...companies];
        for (const p of parts) {
          if (!newComps.some((c) => c.toLowerCase() === p.toLowerCase())) {
            newComps.push(p);
          }
        }
        setCompanies(newComps);
        setInputValue('');
        setShowSuggestions(false);
      } else if (inputValue.trim()) {
        addCompany(inputValue.trim());
      } else if (companies.length > 0) {
        onFetch();
      }
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 p-5 shadow-sm transition-colors">
      {/* Preset Chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          Quick Presets:
        </span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => setCompanies(preset.companies)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/60 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            {preset.label} ({preset.companies.join(', ')})
          </button>
        ))}
      </div>

      {/* Main Input Box with Badges */}
      <div ref={containerRef} className="relative">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 p-2 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-950 transition-all">
          <div className="pl-1.5 text-slate-400 dark:text-slate-500">
            <Search className="h-4 w-4" />
          </div>

          {/* Active Company Badges */}
          {companies.map((comp, idx) => (
            <span
              key={comp + idx}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-100/90 dark:bg-blue-900/60 px-2.5 py-1 text-xs font-semibold text-blue-900 dark:text-blue-100 border border-blue-200 dark:border-blue-800"
            >
              <span>{comp}</span>
              <button
                type="button"
                onClick={() => removeCompany(idx)}
                aria-label={`Remove ${comp}`}
                className="rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {/* Text Input */}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              companies.length === 0
                ? "Type company name or ticker (e.g. TCS, Infosys, Reliance) and press Enter..."
                : "Add another company or symbol..."
            }
            className="min-w-[200px] flex-1 border-none bg-transparent px-2 py-1 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
          />

          {isSearchingSuggestions && (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400 mr-2" />
          )}

          {/* Action Button */}
          <button
            onClick={onFetch}
            disabled={isLoading || (companies.length === 0 && !inputValue.trim())}
            className="flex items-center gap-2 rounded-lg bg-blue-600 dark:bg-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-95 disabled:pointer-events-none disabled:opacity-50 transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Fetching Screener...</span>
              </>
            ) : (
              <>
                <span>Fetch Financial Data</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-lg">
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Screener.in Matching Results:
            </div>
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => addCompany(item.name)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-900 dark:hover:text-blue-200 transition-colors"
              >
                <span className="font-medium text-slate-900 dark:text-white">{item.name}</span>
                <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">{item.url}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Control Filters Toolbar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-700/80 pt-3">
        {/* Metric Selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="metric-select" className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            Comparison Metric:
          </label>
          <select
            id="metric-select"
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-sm focus:border-blue-500 focus:outline-none"
          >
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Quarters Count & Cache Toggle */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <span>Show Quarters:</span>
            <div className="flex rounded-md bg-slate-100 dark:bg-slate-700/60 p-0.5">
              {[4, 6, 8, 12].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setMaxQuarters(num)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-all ${
                    maxQuarters === num
                      ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-xs font-bold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  {num}Q
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Force Live Refresh</span>
          </label>
        </div>
      </div>
    </div>
  );
};
