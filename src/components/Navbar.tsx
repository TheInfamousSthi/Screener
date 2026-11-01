import React from 'react';
import { BarChart3, Sun, Moon, ShieldCheck, RefreshCw } from 'lucide-react';

interface NavbarProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onClearCache: () => void;
  isClearingCache: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  darkMode,
  setDarkMode,
  onClearCache,
  isClearingCache,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-colors duration-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Screener.in Financial Analyzer
              </h1>
              <span className="hidden rounded-md bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 sm:inline-block">
                Live Screener Source
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quarterly Financial Data Scraping & Side-by-Side Comparison
            </p>
          </div>
        </div>

        {/* Right Tools: Politeness, Clear Cache & Dark/Light Toggle */}
        <div className="flex items-center gap-2.5">
          {/* Politeness Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 rounded-full px-2.5 py-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Rate-limit polite (400ms delay)</span>
          </div>

          {/* Clear Cache */}
          <button
            onClick={onClearCache}
            disabled={isClearingCache}
            title="Clear cache and re-fetch"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${isClearingCache ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Clear Cache</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-amber-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
          >
            {darkMode ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4 text-slate-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
