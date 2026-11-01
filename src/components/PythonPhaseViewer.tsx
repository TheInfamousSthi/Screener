import React, { useState, useEffect } from 'react';
import {
  Code2,
  Terminal,
  Copy,
  Check,
  Download,
  Play,
  Loader2,
  CheckCircle2,
  FileCode,
  Sparkles,
} from 'lucide-react';

export const PythonPhaseViewer: React.FC = () => {
  const [activePhase, setActivePhase] = useState<'phase1' | 'phase2' | 'phase3_streamlit' | 'phase3_tkinter' | 'phase4' | 'requirements' | 'readme'>('phase1');
  const [codeContent, setCodeContent] = useState<string>('Loading python source...');
  const [copied, setCopied] = useState(false);
  const [isLoadingCode, setIsLoadingCode] = useState(false);

  // Live Python execution state
  const [testCompanies, setTestCompanies] = useState('TCS, INFY');
  const [isRunningPython, setIsRunningPython] = useState(false);
  const [pythonOutput, setPythonOutput] = useState<{
    cmd?: string;
    stdout?: string;
    stderr?: string;
    success?: boolean;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingCode(true);

    fetch(`/api/python-source/${activePhase}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setCodeContent(data.content || 'Code not available.');
          setIsLoadingCode(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setCodeContent(`Error loading file: ${err.message}`);
          setIsLoadingCode(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activePhase]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleDownload = () => {
    const filenameMap: Record<string, string> = {
      phase1: 'phase1_core.py',
      phase2: 'phase2_tabulate.py',
      phase3_streamlit: 'phase3_streamlit.py',
      phase3_tkinter: 'phase3_tkinter.py',
      phase4: 'phase4_full.py',
      requirements: 'requirements.txt',
      readme: 'README.md',
    };
    const filename = filenameMap[activePhase] || 'script.py';
    const blob = new Blob([codeContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRunPythonInContainer = async () => {
    setIsRunningPython(true);
    setPythonOutput(null);

    const comps = testCompanies.split(',').map((c) => c.trim()).filter(Boolean);

    try {
      const res = await fetch('/api/run-python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: activePhase === 'phase1' ? 'phase1' : activePhase === 'phase2' ? 'phase2' : 'phase4',
          companies: comps.length > 0 ? comps : ['TCS', 'INFY'],
          metric: 'Net Profit',
        }),
      });
      const data = await res.json();
      setPythonOutput(data);
    } catch (err: any) {
      setPythonOutput({
        cmd: 'python3',
        stderr: err.message,
        success: false,
      });
    } finally {
      setIsRunningPython(false);
    }
  };

  const PHASES = [
    {
      id: 'phase1',
      title: 'Phase 1: Core Logic',
      file: 'phase1_core.py',
      badge: 'Zero External Deps',
      desc: 'Search & extract pipeline, HTTP parsing, realistic headers, politeness delays, and error handling.',
    },
    {
      id: 'phase2',
      title: 'Phase 2: Tabulate & Align',
      file: 'phase2_tabulate.py',
      badge: 'Side-by-Side',
      desc: 'Multi-company quarter chronological union, aligned matrix, number formatting, QoQ & YoY calculations.',
    },
    {
      id: 'phase3_streamlit',
      title: 'Phase 3: Streamlit UI',
      file: 'phase3_streamlit.py',
      badge: 'Web GUI',
      desc: 'Streamlit dashboard with inputs, metrics, deltas, and reactive dataframes.',
    },
    {
      id: 'phase3_tkinter',
      title: 'Phase 3: Tkinter GUI',
      file: 'phase3_tkinter.py',
      badge: 'Desktop Native',
      desc: 'Standard-library Python Tkinter GUI with threaded worker, Treeview tables, and zero pip dependencies.',
    },
    {
      id: 'phase4',
      title: 'Phase 4: Full App & CLI',
      file: 'phase4_full.py',
      badge: 'Complete Suite',
      desc: 'Isolated TTL caching, CSV & Excel export, Matplotlib quarterly profit chart, and CLI runner.',
    },
    {
      id: 'requirements',
      title: 'Requirements',
      file: 'requirements.txt',
      badge: 'pip packages',
      desc: 'Complete list of dependencies for optional advanced features.',
    },
    {
      id: 'readme',
      title: 'Documentation',
      file: 'README.md',
      badge: 'Guide',
      desc: 'Execution instructions, ethics, and API architecture.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Phase Navigation Tabs */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {PHASES.map((p) => {
          const isSelected = activePhase === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setActivePhase(p.id as any)}
              className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50/70 shadow-sm ring-1 ring-blue-500'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <span className="font-mono text-xs font-bold text-slate-800">
                  {p.file}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {p.badge}
                </span>
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-900">
                {p.title}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">
                {p.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Code Viewer Panel */}
      <div className="rounded-2xl border border-slate-200 bg-slate-900 shadow-lg overflow-hidden">
        {/* Code Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-5 py-3">
          <div className="flex items-center gap-2 text-slate-300">
            <FileCode className="h-4 w-4 text-blue-400" />
            <span className="font-mono text-xs font-bold text-white">
              {PHASES.find((p) => p.id === activePhase)?.file}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  <span>Copy Code</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download File</span>
            </button>
          </div>
        </div>

        {/* Code Display Area */}
        <div className="relative max-h-[520px] overflow-auto p-4 font-mono text-xs text-slate-200 leading-relaxed bg-[#0c1222]">
          {isLoadingCode ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span>Loading source code...</span>
            </div>
          ) : (
            <pre className="whitespace-pre overflow-x-auto selection:bg-blue-600/40">
              {codeContent}
            </pre>
          )}
        </div>
      </div>

      {/* Live In-Container Python Runner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Live Python Terminal Execution
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Executes the actual Python script directly in the backend container
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={testCompanies}
              onChange={(e) => setTestCompanies(e.target.value)}
              placeholder="e.g. TCS, INFY"
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            onClick={handleRunPythonInContainer}
            disabled={isRunningPython}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {isRunningPython ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Running Python...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Execute in Terminal</span>
              </>
            )}
          </button>
        </div>

        {/* Console Output Display */}
        {pythonOutput && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-200 shadow-inner">
            <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2 text-[11px] text-slate-400">
              <span className="text-emerald-400 font-bold">$ {pythonOutput.cmd}</span>
              <span className={pythonOutput.success ? 'text-emerald-400' : 'text-rose-400'}>
                {pythonOutput.success ? '✓ Exited with code 0' : '✗ Failed'}
              </span>
            </div>

            {pythonOutput.stdout && (
              <pre className="whitespace-pre overflow-x-auto text-emerald-200">
                {pythonOutput.stdout}
              </pre>
            )}

            {pythonOutput.stderr && (
              <pre className="mt-2 whitespace-pre overflow-x-auto text-rose-300">
                {pythonOutput.stderr}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
