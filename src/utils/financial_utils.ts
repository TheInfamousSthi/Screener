/**
 * Utility functions for parsing, formatting, aligning, and calculating
 * quarterly financial metrics for Screener.in data.
 */

export interface QuarterSummary {
  latestQuarter: string;
  latestProfit: number | null;
  prevQuarter: string;
  qoqChange: number | null;
  qoqChangePct: number | null;
  yoyQuarter: string;
  yoyChange: number | null;
  yoyChangePct: number | null;
}

export interface CompanyQuarterData {
  query: string;
  name: string;
  url: string;
  found: boolean;
  error?: string | null;
  fromCache?: boolean;
  quarters: string[];
  netProfit: string[];
  allRows: Record<string, string[]>;
  summary?: QuarterSummary;
}

/**
 * Parses financial strings like "13,934", "-150", "26%", "(45.2)" into numeric floats.
 */
export function parseFinancialNumber(valStr: string | null | undefined): number | null {
  if (!valStr || typeof valStr !== 'string') return null;
  let clean = valStr.trim();
  if (!clean || clean === '-' || clean.toLowerCase() === 'na') return null;

  let isNegative = false;
  if (clean.startsWith('(') && clean.endsWith(')')) {
    isNegative = true;
    clean = clean.slice(1, -1).trim();
  }

  clean = clean.replace(/[₹%,\s]/g, '');
  const num = parseFloat(clean);
  if (isNaN(num)) return null;
  return isNegative ? -num : num;
}

/**
 * Formats a numeric value into standard Indian rupee crore or percentage notation.
 */
export function formatFinancialValue(
  val: number | null | undefined,
  isPercentage: boolean = false,
  unit: string = 'Cr'
): string {
  if (val === null || val === undefined || isNaN(val)) return '-';
  if (isPercentage) {
    return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
  }

  const isNeg = val < 0;
  const absVal = Math.abs(val);
  const formatted =
    absVal % 1 !== 0
      ? absVal.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : absVal.toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const unitPart = unit ? ` ${unit}` : '';
  return isNeg ? `-₹ ${formatted}${unitPart}` : `₹ ${formatted}${unitPart}`;
}

/**
 * Calculates Quarter-over-Quarter (QoQ) and Year-over-Year (YoY) performance deltas.
 */
export function calculateQuarterSummary(
  quarters: string[],
  values: string[]
): QuarterSummary {
  if (!quarters || !values || quarters.length === 0 || values.length === 0) {
    return {
      latestQuarter: 'N/A',
      latestProfit: null,
      prevQuarter: 'N/A',
      qoqChange: null,
      qoqChangePct: null,
      yoyQuarter: 'N/A',
      yoyChange: null,
      yoyChangePct: null,
    };
  }

  const latestQuarter = quarters[quarters.length - 1];
  const latestProfit = parseFinancialNumber(values[values.length - 1]);

  // QoQ: Compare with quarters[length - 2]
  const prevQuarter = quarters.length >= 2 ? quarters[quarters.length - 2] : 'N/A';
  const prevProfit = quarters.length >= 2 ? parseFinancialNumber(values[values.length - 2]) : null;

  let qoqChange: number | null = null;
  let qoqChangePct: number | null = null;
  if (latestProfit !== null && prevProfit !== null) {
    qoqChange = latestProfit - prevProfit;
    if (prevProfit !== 0) {
      qoqChangePct = (qoqChange / Math.abs(prevProfit)) * 100;
    }
  }

  // YoY: Compare with quarters[length - 5] (4 quarters prior)
  const yoyQuarter = quarters.length >= 5 ? quarters[quarters.length - 5] : 'N/A';
  const yoyProfit = quarters.length >= 5 ? parseFinancialNumber(values[values.length - 5]) : null;

  let yoyChange: number | null = null;
  let yoyChangePct: number | null = null;
  if (latestProfit !== null && yoyProfit !== null) {
    yoyChange = latestProfit - yoyProfit;
    if (yoyProfit !== 0) {
      yoyChangePct = (yoyChange / Math.abs(yoyProfit)) * 100;
    }
  }

  return {
    latestQuarter,
    latestProfit,
    prevQuarter,
    qoqChange,
    qoqChangePct,
    yoyQuarter,
    yoyChange,
    yoyChangePct,
  };
}

/**
 * Sorts quarter labels chronologically (e.g. ['Dec 2023', 'Mar 2024', 'Jun 2024']).
 */
export function sortQuartersChronologically(quarters: string[]): string[] {
  const monthMap: Record<string, number> = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
  };

  return [...quarters].sort((a, b) => {
    const partsA = a.trim().split(/\s+/);
    const partsB = b.trim().split(/\s+/);
    const yearA = parseInt(partsA[1], 10) || 0;
    const yearB = parseInt(partsB[1], 10) || 0;
    if (yearA !== yearB) return yearA - yearB;

    const mA = monthMap[partsA[0]] || 0;
    const mB = monthMap[partsB[0]] || 0;
    return mA - mB;
  });
}

/**
 * Aligns quarters across multiple companies to build a side-by-side comparison matrix.
 */
export function alignCompaniesQuarters(
  companies: CompanyQuarterData[],
  metric: string = 'Net Profit',
  maxQuarters: number = 8
): {
  quarters: string[];
  rows: Array<{
    company: string;
    query: string;
    values: Array<{ quarter: string; raw: string; num: number | null }>;
  }>;
} {
  const unionSet = new Set<string>();
  companies.forEach((comp) => {
    if (comp.found && !comp.error && comp.quarters) {
      comp.quarters.forEach((q) => unionSet.add(q));
    }
  });

  const sortedAll = sortQuartersChronologically(Array.from(unionSet));
  const selectedQuarters = sortedAll.slice(-maxQuarters);

  const rows = companies.map((comp) => {
    const series = comp.allRows?.[metric] || comp.netProfit || [];
    const qMap = new Map<string, string>();
    comp.quarters?.forEach((q, idx) => {
      qMap.set(q, series[idx] || '-');
    });

    const values = selectedQuarters.map((q) => {
      const raw = qMap.get(q) || '-';
      return {
        quarter: q,
        raw,
        num: parseFinancialNumber(raw),
      };
    });

    return {
      company: comp.name || comp.query,
      query: comp.query,
      values,
    };
  });

  return {
    quarters: selectedQuarters,
    rows,
  };
}

/**
 * Generates formatted CSV string for export.
 */
export function generateComparisonCsv(
  quarters: string[],
  rows: Array<{ company: string; values: Array<{ raw: string }> }>,
  metric: string
): string {
  const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;

  const headerRow = [escapeCsv(`Company (${metric})`), ...quarters.map(escapeCsv)].join(',');
  const dataRows = rows.map((r) => {
    return [escapeCsv(r.company), ...r.values.map((v) => escapeCsv(v.raw))].join(',');
  });

  return [headerRow, ...dataRows].join('\r\n');
}

/**
 * Extracts the last 4 quarters' reporting numbers for a company card.
 */
export function getLast4QuartersData(
  company: CompanyQuarterData,
  metric: string = 'Net Profit'
): Array<{ quarter: string; raw: string; num: number | null }> {
  if (!company.quarters || company.quarters.length === 0) return [];
  const series = company.allRows?.[metric] || company.netProfit || [];
  const total = company.quarters.length;
  const count = Math.min(4, total);
  const startIdx = total - count;

  const result: Array<{ quarter: string; raw: string; num: number | null }> = [];
  for (let i = startIdx; i < total; i++) {
    const q = company.quarters[i];
    const raw = series[i] || '-';
    result.push({
      quarter: q,
      raw,
      num: parseFinancialNumber(raw),
    });
  }
  return result;
}
