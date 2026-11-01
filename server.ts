import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  alignCompaniesQuarters,
  calculateQuarterSummary,
  CompanyQuarterData,
} from './src/utils/financial_utils.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// In-memory cache for fast lookups
interface CacheEntry {
  timestamp: number;
  data: CompanyQuarterData;
}
const companyCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

// Politeness rate limiter
let lastRequestTime = 0;
async function politeDelay(delayMs: number = 400) {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < delayMs) {
    await new Promise((resolve) => setTimeout(resolve, delayMs - timeSinceLast));
  }
  lastRequestTime = Date.now();
}

/**
 * Searches company on Screener.in API
 */
async function searchScreener(query: string): Promise<{ name: string; url: string; id?: number } | null> {
  await politeDelay(350);
  const searchUrl = `https://www.screener.in/api/company/search/?q=${encodeURIComponent(query.trim())}`;
  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`Screener search returned status ${res.status} for "${query}"`);
      return null;
    }

    const data = (await res.json()) as Array<{ name: string; url: string; id: number }>;
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }
    return null;
  } catch (err) {
    console.error(`Error searching Screener for "${query}":`, err);
    return null;
  }
}

/**
 * Parses the HTML from a Screener.in company page to extract quarters table
 */
function parseQuartersHtml(html: string): { quarters: string[]; rows: Record<string, string[]> } | null {
  const quartersMatch = html.match(/<section[^>]*id=["']quarters["'][^>]*>([\s\S]*?)<\/section>/i);
  if (!quartersMatch) return null;

  const sectionHtml = quartersMatch[1];

  // 1. Quarters headers
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

  // 2. Rows
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
      const val = cells[i][1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      values.push(val);
    }
    rows[cleanTitle] = values;
  }

  return { quarters, rows };
}

/**
 * Scrapes a single company or returns cached/fallback data
 */
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
      error: `Company '${query}' was not found on Screener.in. Check spelling or try ticker symbol (e.g., TCS, INFY, RELIANCE).`,
      quarters: [],
      netProfit: [],
      allRows: {},
    };
  }

  const companyUrl = match.url.startsWith('/') ? `https://www.screener.in${match.url}` : `https://www.screener.in/${match.url}`;

  await politeDelay(450);
  try {
    const res = await fetch(companyUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      return {
        query,
        name: match.name,
        url: match.url,
        found: true,
        error: `HTTP ${res.status} error fetching company page for ${match.name}.`,
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

    // Store in cache
    companyCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
  } catch (err: any) {
    return {
      query,
      name: match.name,
      url: match.url,
      found: true,
      error: `Network error retrieving ${match.name}: ${err.message || String(err)}`,
      quarters: [],
      netProfit: [],
      allRows: {},
    };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // -------------------------------------------------------------
  // API: Search Autocomplete Suggestions
  // -------------------------------------------------------------
  app.get('/api/search', async (req: Request, res: Response) => {
    const query = (req.query.q as string) || '';
    if (!query || query.length < 2) {
      return res.json([]);
    }

    try {
      await politeDelay(250);
      const url = `https://www.screener.in/api/company/search/?q=${encodeURIComponent(query)}`;
      const screenerRes = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      if (screenerRes.ok) {
        const data = await screenerRes.json();
        return res.json(data);
      }
      return res.json([]);
    } catch {
      return res.json([]);
    }
  });

  // -------------------------------------------------------------
  // API: Scrape and Compare Companies
  // -------------------------------------------------------------
  app.post('/api/scrape', async (req: Request, res: Response) => {
    const { companies, metric = 'Net Profit', forceRefresh = false, maxQuarters = 8 } = req.body;

    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one company name.' });
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
      allQuartersAvailable: comparison.quarters,
    });
  });

  // -------------------------------------------------------------
  // API: Cache Management
  // -------------------------------------------------------------
  app.post('/api/cache/clear', (_req: Request, res: Response) => {
    companyCache.clear();
    res.json({ success: true, message: 'Server cache cleared.' });
  });

  // -------------------------------------------------------------
  // API: Python Source Code Reader for Phases 1-4
  // -------------------------------------------------------------
  app.get('/api/python-source/:phase', (req: Request, res: Response) => {
    const phase = req.params.phase;
    const fileMap: Record<string, string> = {
      phase1: 'phase1_core.py',
      phase2: 'phase2_tabulate.py',
      phase3_streamlit: 'phase3_streamlit.py',
      phase3_tkinter: 'phase3_tkinter.py',
      phase4: 'phase4_full.py',
      requirements: 'requirements.txt',
      readme: 'README.md',
    };

    const targetFile = fileMap[phase];
    if (!targetFile) {
      return res.status(404).json({ error: 'Unknown phase file.' });
    }

    const filePath = path.resolve(__dirname, targetFile);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return res.json({
      fileName: targetFile,
      content,
    });
  });

  // -------------------------------------------------------------
  // API: Live Python Execution (Runs the actual Python script)
  // -------------------------------------------------------------
  app.post('/api/run-python', async (req: Request, res: Response) => {
    const { phase = 'phase4', companies = ['TCS', 'INFY'], metric = 'Net Profit' } = req.body;
    const companyArgs = companies.map((c: string) => `"${c.replace(/"/g, '')}"`).join(' ');

    let cmd = `python3 phase4_full.py --companies ${companyArgs} --metric "${metric}"`;
    if (phase === 'phase1') {
      cmd = `python3 phase1_core.py ${companyArgs}`;
    } else if (phase === 'phase2') {
      cmd = `python3 phase2_tabulate.py ${companyArgs}`;
    }

    try {
      const { stdout, stderr } = await execAsync(cmd, { cwd: __dirname, timeout: 25000 });
      return res.json({
        cmd,
        stdout,
        stderr,
        success: true,
      });
    } catch (err: any) {
      return res.json({
        cmd,
        stdout: err.stdout || '',
        stderr: err.stderr || err.message,
        success: false,
      });
    }
  });

  // -------------------------------------------------------------
  // Vite Integration (Dev) / Static Files (Prod)
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Financial Scraper Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
