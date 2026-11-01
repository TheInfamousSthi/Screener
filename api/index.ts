import express, { Request, Response } from 'express';
import {
  alignCompaniesQuarters,
  calculateQuarterSummary,
  CompanyQuarterData,
} from '../src/utils/financial_utils';

const app = express();
app.use(express.json());

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Cache in serverless memory
const companyCache = new Map<string, { timestamp: number; data: CompanyQuarterData }>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

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
  } catch (err) {
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

async function scrapeCompanyData(query: string, forceRefresh: boolean = false): Promise<CompanyQuarterData> {
  const cacheKey = query.trim().toUpperCase();

  if (!forceRefresh) {
    const cached = companyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { ...cached.data, fromCache: true };
    }
  }

  const match = await searchScreener(query);
  if (!match) {
    return {
      query,
      name: query,
      url: '',
      found: false,
      error: `Company '${query}' was not found on Screener.in.`,
      quarters: [],
      netProfit: [],
      allRows: {},
    };
  }

  const companyUrl = match.url.startsWith('/') ? `https://www.screener.in${match.url}` : `https://www.screener.in/${match.url}`;

  try {
    const res = await fetch(companyUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      return {
        query,
        name: match.name,
        url: match.url,
        found: true,
        error: `HTTP ${res.status} error fetching company page.`,
        quarters: [],
        netProfit: [],
        allRows: {},
      };
    }

    const html = await res.text();
    const parsed = parseQuartersHtml(html);
    if (!parsed || Object.keys(parsed.rows).length === 0) {
      return {
        query,
        name: match.name,
        url: match.url,
        found: true,
        error: `Quarters financial data table not found for ${match.name}.`,
        quarters: [],
        netProfit: [],
        allRows: {},
      };
    }

    const netProfitSeries = parsed.rows['Net Profit'] || [];
    const summary = calculateQuarterSummary(parsed.quarters, netProfitSeries);

    const result: CompanyQuarterData = {
      query,
      name: match.name,
      url: match.url,
      found: true,
      quarters: parsed.quarters,
      netProfit: netProfitSeries,
      allRows: parsed.rows,
      summary,
      fromCache: false,
    };

    companyCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch (err: any) {
    return {
      query,
      name: match.name,
      url: match.url,
      found: true,
      error: `Network error retrieving data: ${err.message}`,
      quarters: [],
      netProfit: [],
      allRows: {},
    };
  }
}

// Router routes (supporting both /api/search and /search when mounted)
app.get(['/api/search', '/search'], async (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  if (!query || query.length < 2) return res.json([]);
  try {
    const data = await searchScreener(query);
    return res.json(data ? [data] : []);
  } catch {
    return res.json([]);
  }
});

app.post(['/api/scrape', '/scrape'], async (req: Request, res: Response) => {
  const { companies, metric = 'Net Profit', forceRefresh = false, maxQuarters = 8 } = req.body;
  if (!companies || !Array.isArray(companies) || companies.length === 0) {
    return res.status(400).json({ error: 'Please provide company names.' });
  }

  const uniqueCompanies = Array.from(new Set(companies.map((c: string) => c.trim()))).filter(Boolean);
  const results: CompanyQuarterData[] = [];

  for (const comp of uniqueCompanies) {
    const data = await scrapeCompanyData(comp, forceRefresh);
    results.push(data);
  }

  const successful = results.filter((r) => r.found && !r.error);
  const comparison = alignCompaniesQuarters(successful, metric, maxQuarters);

  return res.json({
    results,
    comparison,
    metric,
  });
});

app.post(['/api/cache/clear', '/cache/clear'], (_req: Request, res: Response) => {
  companyCache.clear();
  res.json({ success: true });
});

export default app;
