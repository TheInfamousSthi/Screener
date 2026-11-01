import React from 'react';
import { BookOpen, CheckCircle, Terminal, Layers, ShieldCheck, Download, Code, ArrowRight } from 'lucide-react';

export const DocumentationViewer: React.FC = () => {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Overview Hero */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              System Architecture & Implementation Guide
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              A comprehensive guide to scraping, normalizing, tabulating, and visualizing quarterly company financial data from Screener.in across 4 modular phases.
            </p>
          </div>
        </div>

        {/* Quick Highlights */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t border-slate-100 pt-5">
          <div className="rounded-xl bg-slate-50 p-3">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Phase 1</span>
            <div className="font-bold text-slate-900 mt-0.5">Core Scraper</div>
            <p className="text-xs text-slate-500 mt-1">Zero-dependency urllib parser with rate-limit respect.</p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Phase 2</span>
            <div className="font-bold text-slate-900 mt-0.5">Tabulation & Alignment</div>
            <p className="text-xs text-slate-500 mt-1">Multi-company chronological quarter alignment & QoQ/YoY.</p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Phase 3</span>
            <div className="font-bold text-slate-900 mt-0.5">GUI Frontends</div>
            <p className="text-xs text-slate-500 mt-1">Streamlit web app & Tkinter desktop GUI.</p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <span className="text-[11px] font-semibold uppercase text-slate-400">Phase 4</span>
            <div className="font-bold text-slate-900 mt-0.5">Exports & Charts</div>
            <p className="text-xs text-slate-500 mt-1">CSV/Excel export, TTL cache, and Matplotlib trendline.</p>
          </div>
        </div>
      </div>

      {/* Phase 1 Walkthrough */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">Phase 1</span>
          <h3 className="text-base font-bold text-slate-900">Core Search-and-Extract Pipeline</h3>
        </div>

        <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-600">
          <p>
            Phase 1 is implemented in <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800">phase1_core.py</code>.
            It uses Python standard library modules (<code className="font-mono">urllib.request</code>, <code className="font-mono">json</code>, <code className="font-mono">re</code>), requiring zero external pip installations.
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Search Resolution:</strong> Calls Screener's autocomplete API (<code className="font-mono">https://www.screener.in/api/company/search/?q=&lt;query&gt;</code>) to resolve ambiguous user queries (e.g., &quot;TCS&quot; or &quot;Tata Motors&quot;) into the official canonical path (<code className="font-mono">/company/TCS/consolidated/</code>).
            </li>
            <li>
              <strong>HTML Table Extraction:</strong> Uses regex-based DOM parsing to isolate the <code className="font-mono">&lt;section id=&quot;quarters&quot;&gt;</code> card. It parses the table headers (<code className="font-mono">&lt;thead&gt;</code>) for the quarter names (e.g. Sep 2024, Dec 2024), and reads each row in the table body.
            </li>
            <li>
              <strong>Line Items Extracted:</strong> Net Profit, Sales, Expenses, Operating Profit, OPM %, Other Income, Interest, Depreciation, Profit before tax, Tax %, and EPS in Rs.
            </li>
            <li>
              <strong>Polite Scraping:</strong> Injects a browser <code className="font-mono">User-Agent</code> header and a strict <code className="font-mono">time.sleep(0.5)</code> delay between HTTP requests to protect Screener&apos;s servers.
            </li>
            <li>
              <strong>Error Handling:</strong> Missing companies, HTTP errors (404/429/500), or pages without quarterly results return structured error dictionaries without crashing.
            </li>
          </ul>

          <div className="mt-3 rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-emerald-400">
            $ python3 phase1_core.py TCS INFY
          </div>
        </div>
      </div>

      {/* Phase 2 Walkthrough */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Phase 2</span>
          <h3 className="text-base font-bold text-slate-900">Tabulation, Chronological Alignment & Performance Deltas</h3>
        </div>

        <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-600">
          <p>
            Phase 2 (<code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800">phase2_tabulate.py</code>) structures and presents the extracted data cleanly:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Chronological Quarter Union & Alignment:</strong> When comparing multiple companies, each company may report different sets of quarters. Phase 2 builds a unified calendar-ordered list of quarters and aligns each company&apos;s figures into a side-by-side comparison matrix.
            </li>
            <li>
              <strong>Consistent Indian Number Formatting:</strong> Formats currency in standard Crores (<code className="font-mono">₹ 13,934 Cr</code>), thousands separators, percentages (<code className="font-mono">24.5%</code>), and negative figures (<code className="font-mono">-₹ 450 Cr</code> or <code className="font-mono">(450)</code>).
            </li>
            <li>
              <strong>QoQ & YoY Calculations:</strong> Computes the most recent quarter&apos;s Net Profit, Quarter-over-Quarter (QoQ) change and growth %, and Year-over-Year (YoY, 4-quarter lag) change and growth %.
            </li>
            <li>
              <strong>Zero Dependency ASCII Table:</strong> Includes a built-in pure-Python table generator that renders clear bordered tables without requiring the <code className="font-mono">tabulate</code> library.
            </li>
          </ul>

          <div className="mt-3 rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-emerald-400">
            $ python3 phase2_tabulate.py &quot;TCS, Infosys, Wipro&quot;
          </div>
        </div>
      </div>

      {/* Phase 3 Walkthrough */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Phase 3</span>
          <h3 className="text-base font-bold text-slate-900">Graphical User Interfaces (Streamlit & Tkinter)</h3>
        </div>

        <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-600">
          <p>
            Phase 3 provides clean graphical user interfaces for users who prefer visual interaction:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-bold text-slate-900 mb-1">Option A: Streamlit Web UI</div>
              <p className="text-[11px] text-slate-500 mb-2">
                Modern responsive web app with company chips, metric selector, KPI delta cards, and expandable dataframes.
              </p>
              <div className="rounded bg-slate-900 p-2 font-mono text-[11px] text-amber-300">
                pip install streamlit pandas<br />
                streamlit run phase3_streamlit.py
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-bold text-slate-900 mb-1">Option B: Tkinter Desktop GUI</div>
              <p className="text-[11px] text-slate-500 mb-2">
                Standard-library native desktop window with multi-threading, Treeview tables, and zero extra pip installations.
              </p>
              <div className="rounded bg-slate-900 p-2 font-mono text-[11px] text-amber-300">
                python3 phase3_tkinter.py
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Phase 4 Walkthrough */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700">Phase 4</span>
          <h3 className="text-base font-bold text-slate-900">Extra Features: Caching, CSV/Excel Export & Visual Charts</h3>
        </div>

        <div className="mt-4 space-y-3 text-xs leading-relaxed text-slate-600">
          <p>
            Phase 4 (<code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800">phase4_full.py</code>) adds isolated production capabilities:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Isolated TTL Caching:</strong> Stores parsed JSON files in <code className="font-mono">~/.screener_scraper_cache/</code> with a 4-hour expiration window. Subsequent requests for the same company return in 0.05 seconds with zero outbound traffic to Screener.
            </li>
            <li>
              <strong>CSV & Excel Export:</strong> Enables one-command file export (<code className="font-mono">--export-csv</code> and <code className="font-mono">--export-excel</code>) with RFC 4180 quotation handling.
            </li>
            <li>
              <strong>Matplotlib Trend Visualization:</strong> Plots multi-company quarterly trajectories with high-res PNG export, alongside a fallback ASCII terminal sparkline.
            </li>
            <li>
              <strong>Full Command-Line Interface (CLI):</strong>
              <div className="mt-2 rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-purple-300">
                python3 phase4_full.py --companies TCS INFY WIPRO --export-csv comparison.csv --chart-file trend.png
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Politeness & Ethics */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-xs">
        <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Politeness, Fair Use & Site Respect</span>
        </div>
        <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
          Screener.in provides extraordinary value to the Indian investing community. This scraper is designed to respect their infrastructure: it uses sequential request delays (minimum 400ms between hits), includes a transparent User-Agent header, avoids deep recursive crawling, and aggressively caches responses to minimize server load.
        </p>
      </div>
    </div>
  );
};
