import React, { useState, useMemo } from 'react';
import { BarChart2, LineChart as LineChartIcon, Eye, EyeOff, ZoomIn, Percent, Layers } from 'lucide-react';

interface QuarterlyTrendChartProps {
  quarters: string[];
  rows: Array<{
    company: string;
    query: string;
    values: Array<{ quarter: string; raw: string; num: number | null }>;
  }>;
  metric: string;
}

const PALETTE = [
  { stroke: '#2563eb', fill: '#3b82f6', bg: 'bg-blue-600', text: 'text-blue-600' }, // Blue
  { stroke: '#059669', fill: '#10b981', bg: 'bg-emerald-600', text: 'text-emerald-600' }, // Emerald
  { stroke: '#d97706', fill: '#f59e0b', bg: 'bg-amber-600', text: 'text-amber-600' }, // Amber
  { stroke: '#7c3aed', fill: '#8b5cf6', bg: 'bg-purple-600', text: 'text-purple-600' }, // Purple
  { stroke: '#e11d48', fill: '#f43f5e', bg: 'bg-rose-600', text: 'text-rose-600' }, // Rose
  { stroke: '#0891b2', fill: '#06b6d4', bg: 'bg-cyan-600', text: 'text-cyan-600' }, // Cyan
];

export const QuarterlyTrendChart: React.FC<QuarterlyTrendChartProps> = ({
  quarters,
  rows,
  metric,
}) => {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [scaleMode, setScaleMode] = useState<'fit' | 'zero' | 'indexed'>('fit');
  const [hoveredPoint, setHoveredPoint] = useState<{
    company: string;
    quarter: string;
    val: number | null;
    raw: string;
    displayVal: string;
    x: number;
    y: number;
  } | null>(null);

  const [hiddenCompanies, setHiddenCompanies] = useState<Record<string, boolean>>({});

  const toggleCompanyVisibility = (company: string) => {
    setHiddenCompanies((prev) => ({
      ...prev,
      [company]: !prev[company],
    }));
  };

  const activeRows = useMemo(
    () => rows.filter((r) => !hiddenCompanies[r.company]),
    [rows, hiddenCompanies]
  );

  // Compute processed values depending on scale mode
  const { processedRows, chartMin, chartMax, yUnit } = useMemo(() => {
    if (!activeRows || activeRows.length === 0 || quarters.length === 0) {
      return { processedRows: [], chartMin: 0, chartMax: 100, yUnit: 'Cr' };
    }

    if (scaleMode === 'indexed') {
      // Rebase each company's earliest available positive value to 100
      let minIndexed = Infinity;
      let maxIndexed = -Infinity;

      const pRows = activeRows.map((r) => {
        // Find baseline (first non-zero valid number)
        let baseVal = 1;
        for (const v of r.values) {
          if (v.num !== null && !isNaN(v.num) && v.num !== 0) {
            baseVal = Math.abs(v.num);
            break;
          }
        }

        const newValues = r.values.map((v) => {
          if (v.num === null || isNaN(v.num)) {
            return { ...v, plotVal: null, displayVal: '-' };
          }
          const indexed = (v.num / baseVal) * 100;
          if (indexed < minIndexed) minIndexed = indexed;
          if (indexed > maxIndexed) maxIndexed = indexed;
          return {
            ...v,
            plotVal: indexed,
            displayVal: `${indexed.toFixed(1)} (Base 100)`,
          };
        });

        return { ...r, values: newValues };
      });

      if (minIndexed === Infinity) minIndexed = 80;
      if (maxIndexed === -Infinity) maxIndexed = 120;
      const span = maxIndexed - minIndexed || 20;

      return {
        processedRows: pRows,
        chartMin: Math.max(0, minIndexed - span * 0.15),
        chartMax: maxIndexed + span * 0.15,
        yUnit: 'idx',
      };
    }

    // Standard absolute numbers
    let minVal = Infinity;
    let maxVal = -Infinity;

    const pRows = activeRows.map((r) => {
      const newValues = r.values.map((v) => {
        if (v.num !== null && !isNaN(v.num)) {
          if (v.num < minVal) minVal = v.num;
          if (v.num > maxVal) maxVal = v.num;
        }
        return {
          ...v,
          plotVal: v.num,
          displayVal: v.raw ? `₹ ${v.raw} Cr` : '-',
        };
      });
      return { ...r, values: newValues };
    });

    if (minVal === Infinity) minVal = 0;
    if (maxVal === -Infinity) maxVal = 100;

    const span = maxVal - minVal || 10;
    let cMin = 0;
    let cMax = maxVal + span * 0.12;

    if (scaleMode === 'fit') {
      // Auto Zoom: fits range tight to data so small numbers (e.g. 100-140) expand fully
      cMin = minVal < 0 ? minVal - Math.abs(span) * 0.1 : Math.max(0, minVal - span * 0.18);
    } else {
      // Zero Baseline
      cMin = minVal < 0 ? minVal - Math.abs(span) * 0.1 : 0;
    }

    return {
      processedRows: pRows,
      chartMin: cMin,
      chartMax: cMax,
      yUnit: 'Cr',
    };
  }, [activeRows, scaleMode, quarters]);

  if (!quarters || quarters.length === 0 || !rows || rows.length === 0) {
    return null;
  }

  const effectiveSpan = chartMax - chartMin || 1;

  // SVG dimensions
  const svgWidth = 860;
  const svgHeight = 290;
  const padLeft = 70;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 45;

  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const getY = (val: number) => {
    const norm = (val - chartMin) / effectiveSpan;
    return padTop + plotHeight - norm * plotHeight;
  };

  const getX = (index: number) => {
    if (quarters.length <= 1) return padLeft + plotWidth / 2;
    return padLeft + (index / (quarters.length - 1)) * plotWidth;
  };

  // Y-axis tick intervals (5 ticks)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const val = chartMin + ratio * effectiveSpan;
    return { val, y: getY(val) };
  });

  const formatTickLabel = (val: number) => {
    if (scaleMode === 'indexed') return `${val.toFixed(0)}`;
    if (Math.abs(val) >= 10000) return `${(val / 1000).toFixed(0)}k`;
    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`;
    if (Math.abs(val) >= 10) return `${val.toFixed(0)}`;
    return `${val.toFixed(1)}`;
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/90 p-5 shadow-sm transition-colors">
      {/* Chart Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Quarterly Trend: <span className="text-blue-600 dark:text-blue-400">{metric}</span>
            </h2>
            {scaleMode === 'fit' && (
              <span className="rounded bg-blue-50 dark:bg-blue-900/50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                Auto-Zoom (Clear for small profits)
              </span>
            )}
            {scaleMode === 'indexed' && (
              <span className="rounded bg-purple-50 dark:bg-purple-900/50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                Indexed to 100 (Relative Trajectory)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Compare trends across quarters. Auto-Zoom ensures small figures (e.g. 100s, 10s) are distinct and visible.
          </p>
        </div>

        {/* Controls: Chart Type & Scaling Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scale Mode Selector */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-700/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => setScaleMode('fit')}
              title="Auto Zoom: Dynamic range so small figures are clear and not crushed to zero"
              className={`flex items-center gap-1 rounded px-2 py-1 font-medium transition-all ${
                scaleMode === 'fit'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ZoomIn className="h-3 w-3" />
              <span>Auto-Zoom</span>
            </button>

            <button
              type="button"
              onClick={() => setScaleMode('zero')}
              title="Zero Baseline: Starts scale at 0"
              className={`rounded px-2 py-1 font-medium transition-all ${
                scaleMode === 'zero'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Zero-Base</span>
            </button>

            <button
              type="button"
              onClick={() => setScaleMode('indexed')}
              title="Rebased to 100: compare growth rates of small vs large companies"
              className={`flex items-center gap-1 rounded px-2 py-1 font-medium transition-all ${
                scaleMode === 'indexed'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Percent className="h-3 w-3" />
              <span>Base 100</span>
            </button>
          </div>

          {/* Toggle Line / Bar */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-700/60 p-1 text-xs">
            <button
              type="button"
              onClick={() => setChartType('line')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-all ${
                chartType === 'line'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LineChartIcon className="h-3.5 w-3.5" />
              <span>Line</span>
            </button>

            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 font-medium transition-all ${
                chartType === 'bar'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span>Bar</span>
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[650px] overflow-visible select-none"
        >
          {/* Grid lines & Y-axis labels */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={tick.y}
                x2={svgWidth - padRight}
                y2={tick.y}
                stroke="currentColor"
                className="text-slate-100 dark:text-slate-700/60"
                strokeWidth="1.2"
                strokeDasharray={tick.val === 0 ? 'none' : '4 4'}
              />
              <text
                x={padLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="text-[10px] fill-slate-400 dark:fill-slate-500 font-mono"
              >
                {formatTickLabel(tick.val)}
              </text>
            </g>
          ))}

          {/* Zero baseline if in bounds */}
          {chartMin <= 0 && chartMax >= 0 && (
            <line
              x1={padLeft}
              y1={getY(0)}
              x2={svgWidth - padRight}
              y2={getY(0)}
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-600"
              strokeWidth="1.5"
            />
          )}

          {/* X Axis Labels (Quarters) */}
          {quarters.map((q, idx) => (
            <text
              key={q}
              x={getX(idx)}
              y={svgHeight - 12}
              textAnchor="middle"
              className="text-[10px] fill-slate-500 dark:fill-slate-400 font-medium"
            >
              {q}
            </text>
          ))}

          {/* LINE CHART RENDERING */}
          {chartType === 'line' &&
            processedRows.map((r, rIdx) => {
              const color = PALETTE[rIdx % PALETTE.length];
              const points: Array<{
                x: number;
                y: number;
                plotVal: number;
                raw: string;
                displayVal: string;
                q: string;
              }> = [];

              r.values.forEach((v, qIdx) => {
                if (v.plotVal !== null && !isNaN(v.plotVal)) {
                  points.push({
                    x: getX(qIdx),
                    y: getY(v.plotVal),
                    plotVal: v.plotVal,
                    raw: v.raw,
                    displayVal: v.displayVal,
                    q: quarters[qIdx],
                  });
                }
              });

              if (points.length < 1) return null;

              const pathData = points
                .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
                .join(' ');

              return (
                <g key={r.company}>
                  {/* Line */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={color.stroke}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-200"
                  />

                  {/* Nodes on each quarter */}
                  {points.map((pt, pIdx) => (
                    <circle
                      key={pIdx}
                      cx={pt.x}
                      cy={pt.y}
                      r="4.5"
                      fill={color.stroke}
                      stroke="#ffffff"
                      strokeWidth="2"
                      className="cursor-pointer transition-transform hover:scale-175 dark:stroke-slate-900"
                      onMouseEnter={() =>
                        setHoveredPoint({
                          company: r.company,
                          quarter: pt.q,
                          val: pt.plotVal,
                          raw: pt.raw,
                          displayVal: pt.displayVal,
                          x: pt.x,
                          y: pt.y,
                        })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  ))}
                </g>
              );
            })}

          {/* GROUPED BAR CHART RENDERING */}
          {chartType === 'bar' &&
            quarters.map((q, qIdx) => {
              const groupCenterX = getX(qIdx);
              const totalActive = processedRows.length;
              const barWidth = Math.min(22, 50 / totalActive);
              const groupWidth = totalActive * barWidth + (totalActive - 1) * 2;
              const startX = groupCenterX - groupWidth / 2;

              return (
                <g key={q}>
                  {processedRows.map((r, rIdx) => {
                    const color = PALETTE[rIdx % PALETTE.length];
                    const valObj = r.values[qIdx];
                    if (valObj?.plotVal === null || valObj?.plotVal === undefined) return null;

                    const plotVal = valObj.plotVal;
                    const y = getY(plotVal);
                    const baseZeroY = getY(Math.max(chartMin, 0));
                    // Ensure at least 4px height so small values remain clearly visible and hoverable
                    const calculatedHeight = Math.abs(baseZeroY - y);
                    const barHeight = Math.max(4, calculatedHeight);
                    const barY = plotVal >= 0 ? y : baseZeroY;
                    const barX = startX + rIdx * (barWidth + 2);

                    return (
                      <rect
                        key={r.company}
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={barHeight}
                        rx="2"
                        fill={color.fill}
                        opacity={0.88}
                        className="cursor-pointer transition-opacity hover:opacity-100"
                        onMouseEnter={() =>
                          setHoveredPoint({
                            company: r.company,
                            quarter: q,
                            val: plotVal,
                            raw: valObj.raw,
                            displayVal: valObj.displayVal,
                            x: barX + barWidth / 2,
                            y: barY,
                          })
                        }
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}
                </g>
              );
            })}

          {/* Hover Tooltip inside SVG */}
          {hoveredPoint && (
            <g transform={`translate(${hoveredPoint.x}, ${Math.max(38, hoveredPoint.y - 12)})`}>
              <rect
                x="-70"
                y="-38"
                width="140"
                height="34"
                rx="6"
                className="fill-slate-900 dark:fill-slate-950 stroke-slate-700"
                strokeWidth="1"
                opacity="0.96"
              />
              <text
                x="0"
                y="-23"
                textAnchor="middle"
                fill="#ffffff"
                className="text-[10px] font-bold"
              >
                {hoveredPoint.company.length > 20
                  ? hoveredPoint.company.slice(0, 18) + '...'
                  : hoveredPoint.company}
              </text>
              <text
                x="0"
                y="-10"
                textAnchor="middle"
                fill="#93c5fd"
                className="text-[9px] font-mono"
              >
                {hoveredPoint.quarter}: {hoveredPoint.displayVal}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend with Interactive Company Filter Chips */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 border-t border-slate-100 dark:border-slate-700/60 pt-3">
        {rows.map((r, idx) => {
          const color = PALETTE[idx % PALETTE.length];
          const isHidden = hiddenCompanies[r.company];

          return (
            <button
              key={r.company}
              type="button"
              onClick={() => toggleCompanyVisibility(r.company)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                isHidden
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 line-through'
                  : 'bg-slate-50 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: isHidden ? '#94a3b8' : color.stroke }}
              />
              <span>{r.company}</span>
              {isHidden ? (
                <EyeOff className="h-3 w-3 text-slate-400" />
              ) : (
                <Eye className="h-3 w-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
