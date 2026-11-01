// Completely self-contained Vercel serverless function (no relative imports from outside /api)

interface QuarterSummary {
  latestQuarter: string;
  latestProfit: number | null;
  prevQuarter: string;
  qoqChange: number | null;
  qoqChangePct: number | null;
  yoyQuarter: string;
  yoyChange: number | null;
  yoyChangePct: number | null;
}

interface CompanyQuarterData {
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

function parseFinancialNumber(valStr: string | null | undefined): number | null {
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

function calculateQuarterSummary(quarters: string[], values: string[]): QuarterSummary {
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

function sortQuartersChronologically(quarters: string[]): string[] {
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

function alignCompaniesQuarters(
  companies: CompanyQuarterData[],
  metric: string = 'Net Profit',
  maxQuarters: number = 8
) {
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

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const companyCache = new Map<string, { timestamp: number; data: CompanyQuarterData }>();
const CACHE_TTL_MS = 1000 * 60 * 60; // 60 minutes

async function searchScreener(query: string): Promise<{ name: string; url: string } | null> {
  const searchUrl = `https://www.screener.in/api/company/search/?q=${encodeURIComponent(query.trim())}`;
  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ name: string; url: string }>;
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

function parseQuartersHtml(html: string): { quarters: string[]; rows: Record<string, string[]> } | null {
  const quartersMatch = html.match(/<section[^>]*id=["']quarters["'][^>]*>([\s\S]*?)<\/section>/i);
  if (!quartersMatch) return null;

  const sectionHtml = quartersMatch[1];
  const theadMatch = sectionHtml.match(/<thead>([\s\S]*?)<\/thead>/i);
  const quarters: string[] = [];
  if (theadMatch) {
    const thMatches = theadMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi);
    for (const match of thMatches) {
      const clean = match[1].replace(/<[^>]+>/g, '').trim();
      if (clean && !clean.toLowerCase().startsWith('raw')) {
        quarters.push(clean);
      }
    }
  }

  const tbodyMatch = sectionHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  const tableContent = tbodyMatch ? tbodyMatch[1] : sectionHtml;
  const rows: Record<string, string[]> = {};

  const trMatches = tableContent.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const tr of trMatches) {
    const cells = Array.from(tr[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi));
    if (!cells || cells.length === 0) continue;

    const rawTitle = cells[0][1].replace(/<[^>]+>/g, '');
    const cleanTitle = rawTitle.replace(/&nbsp;/g, ' ').replace(/\+/g, '').trim();
    if (!cleanTitle || cleanTitle.toLowerCase().includes('raw pdf')) continue;

    const values: string[] = [];
    for (let i = 1; i < cells.length; i++) {
      values.push(cells[i][1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    }
    rows[cleanTitle] = values;
  }

  return { quarters, rows };
}

async function scrapeSingleCompany(query: string, forceRefresh: boolean = false): Promise<CompanyQuarterData> {
  const cacheKey = query.trim().toUpperCase();

  if (!forceRefresh) {
    const cached = companyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { ...cached.data, fromCache: true };
    }
  }

  const match = await searchScreener(query);
  const companyName = match?.name || query;
  const companyUrl = match?.url || '';

  if (companyUrl) {
    const fullUrl = companyUrl.startsWith('/') ? `https://www.screener.in${companyUrl}` : `https://www.screener.in/${companyUrl}`;
    try {
      const res = await fetch(fullUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (res.ok) {
        const html = await res.text();
        const parsed = parseQuartersHtml(html);
        if (parsed && Object.keys(parsed.rows).length > 0) {
          const netProfit = parsed.rows['Net Profit'] || [];
          const summary = calculateQuarterSummary(parsed.quarters, netProfit);
          const data: CompanyQuarterData = {
            query,
            name: companyName,
            url: companyUrl,
            found: true,
            quarters: parsed.quarters,
            netProfit,
            allRows: parsed.rows,
            summary,
            fromCache: false,
          };
          companyCache.set(cacheKey, { timestamp: Date.now(), data });
          return data;
        }
      }
    } catch {
      // Continue below
    }
  }

  return {
    query,
    name: query,
    url: '',
    found: false,
    error: `Company '${query}' could not be retrieved from Screener.in.`,
    quarters: [],
    netProfit: [],
    allRows: {},
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    body = body || {};

    const companies = body.companies || ['TCS', 'Infosys'];
    const metric = body.metric || 'Net Profit';
    const forceRefresh = Boolean(body.forceRefresh);
    const maxQuarters = Number(body.maxQuarters) || 8;

    const uniqueCompanies = Array.from(new Set(companies.map((c: string) => String(c).trim()))).filter(Boolean);
    const results: CompanyQuarterData[] = [];

    for (const comp of uniqueCompanies) {
      const data = await scrapeSingleCompany(comp as string, forceRefresh);
      results.push(data);
    }

    const successful = results.filter((r) => r.found && !r.error);
    const comparison = alignCompaniesQuarters(successful, metric, maxQuarters);

    return res.status(200).json({
      results,
      comparison,
      metric,
    });
  } catch (err: any) {
    console.error('Serverless error in /api/scrape:', err);
    return res.status(200).json({
      results: [],
      comparison: { quarters: [], rows: [] },
      error: `Scraping error: ${err.message || 'Unknown error'}`,
    });
  }
}
