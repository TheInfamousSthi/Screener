"""
Phase 1: Core Logic - Screener.in Financial Data Scraper
-------------------------------------------------------
Features:
- Search company by name/symbol using Screener's search API
- Resolve company page and fetch consolidated / standalone page
- Navigate to the Quarters table section
- Robustly parse Net Profit and all surrounding quarterly figures
- Polite scraping: Realistic browser User-Agent and request delay (rate-limiting respect)
- Graceful error handling for missing companies, network errors, and missing data
"""

import sys
import time
import json
import urllib.request
import urllib.parse
import urllib.error
import re
from typing import Dict, List, Optional, Any

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
BASE_URL = "https://www.screener.in"
REQUEST_DELAY_SECONDS = 0.6  # Politeness delay to prevent rate limiting


class ScreenerScraperCore:
    def __init__(self, delay_seconds: float = REQUEST_DELAY_SECONDS):
        self.delay_seconds = delay_seconds
        self.headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

    def _polite_wait(self):
        """Enforce respectful delay between HTTP requests."""
        if self.delay_seconds > 0:
            time.sleep(self.delay_seconds)

    def search_company(self, query: str) -> Optional[Dict[str, Any]]:
        """
        Query Screener search API to resolve company name to its page URL.
        Returns first matching company dictionary: {'name': ..., 'url': ...} or None.
        """
        self._polite_wait()
        encoded_query = urllib.parse.quote(query.strip())
        search_url = f"{BASE_URL}/api/company/search/?q={encoded_query}"
        
        req = urllib.request.Request(
            search_url,
            headers={**self.headers, "X-Requested-With": "XMLHttpRequest"}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                if response.status != 200:
                    return None
                data = json.loads(response.read().decode("utf-8"))
                if not data or not isinstance(data, list):
                    return None
                return data[0]  # Closest match
        except urllib.error.URLError as e:
            print(f"[!] Network error searching for '{query}': {e}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"[!] Unexpected error searching for '{query}': {e}", file=sys.stderr)
            return None

    def fetch_company_html(self, relative_url: str) -> Optional[str]:
        """Fetch full HTML page for the given company relative URL."""
        self._polite_wait()
        full_url = f"{BASE_URL}{relative_url}" if relative_url.startswith("/") else f"{BASE_URL}/{relative_url}"
        req = urllib.request.Request(full_url, headers=self.headers)
        
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                if response.status != 200:
                    return None
                return response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            print(f"[!] HTTP {e.code} error fetching '{full_url}': {e.reason}", file=sys.stderr)
            return None
        except urllib.error.URLError as e:
            print(f"[!] Network error connecting to '{full_url}': {e}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"[!] Error fetching company page: {e}", file=sys.stderr)
            return None

    def parse_quarters_section(self, html_content: str) -> Optional[Dict[str, Any]]:
        """
        Extract quarterly table data from the company HTML page.
        Returns dictionary with:
          - 'quarters': List[str] (e.g. ['Sep 2023', 'Dec 2023', ...])
          - 'rows': Dict[str, List[str]] (e.g. {'Sales': [...], 'Net Profit': [...]})
        """
        if not html_content:
            return None

        # Locate section with id="quarters"
        quarters_match = re.search(
            r'<section[^>]*id=[\'"]quarters[\'"][^>]*>(.*?)</section>',
            html_content,
            re.DOTALL | re.IGNORECASE
        )
        if not quarters_match:
            return None
        
        section_html = quarters_match.group(1)

        # 1. Parse table headers (Quarters)
        thead_match = re.search(r'<thead>(.*?)</thead>', section_html, re.DOTALL | re.IGNORECASE)
        quarters = []
        if thead_match:
            th_cells = re.findall(r'<th[^>]*>(.*?)</th>', thead_match.group(1), re.DOTALL | re.IGNORECASE)
            for th in th_cells:
                clean_text = re.sub(r'<[^>]+>', '', th).strip()
                # Exclude empty header or button text
                if clean_text and not clean_text.lower().startswith("raw"):
                    quarters.append(clean_text)

        # 2. Parse table rows (Sales, Expenses, Operating Profit, Net Profit, EPS, etc.)
        rows: Dict[str, List[str]] = {}
        tbody_match = re.search(r'<tbody>(.*?)</tbody>', section_html, re.DOTALL | re.IGNORECASE)
        table_html = tbody_match.group(1) if tbody_match else section_html
        
        tr_matches = re.findall(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL | re.IGNORECASE)
        for tr in tr_matches:
            cells = re.findall(r'<(?:td|th)[^>]*>(.*?)</(?:td|th)>', tr, re.DOTALL | re.IGNORECASE)
            if not cells:
                continue

            # First cell is row title
            raw_title = re.sub(r'<[^>]+>', '', cells[0])
            clean_title = (
                raw_title.replace("&nbsp;", " ")
                .replace("+", "")
                .replace("  ", " ")
                .strip()
            )

            # Skip utility rows like 'Raw PDF'
            if not clean_title or "raw pdf" in clean_title.lower():
                continue

            # Remaining cells are the quarterly figures
            quarter_values = []
            for cell in cells[1:]:
                clean_val = re.sub(r'<[^>]+>', '', cell).replace("&nbsp;", " ").strip()
                quarter_values.append(clean_val)

            rows[clean_title] = quarter_values

        return {
            "quarters": quarters,
            "rows": rows,
        }

    def scrape_company(self, query: str) -> Dict[str, Any]:
        """
        Execute full Phase 1 pipeline for a single company query.
        Returns a normalized result object with status, company name, url, quarters, rows, or error.
        """
        print(f"[*] Searching for '{query}' on Screener.in...")
        match = self.search_company(query)
        if not match:
            return {
                "query": query,
                "found": False,
                "error": f"Company '{query}' was not found on Screener.in.",
            }

        company_name = match.get("name", query)
        company_url = match.get("url", "")
        print(f"[✓] Found: {company_name} ({company_url})")

        print(f"[*] Fetching quarterly data for {company_name}...")
        html = self.fetch_company_html(company_url)
        if not html:
            return {
                "query": query,
                "name": company_name,
                "url": company_url,
                "found": True,
                "error": f"Failed to download company page for {company_name}.",
            }

        parsed = self.parse_quarters_section(html)
        if not parsed or not parsed.get("rows"):
            return {
                "query": query,
                "name": company_name,
                "url": company_url,
                "found": True,
                "error": f"Quarters financial table could not be found on {company_name}'s page.",
            }

        net_profit_series = parsed["rows"].get("Net Profit", [])
        return {
            "query": query,
            "name": company_name,
            "url": company_url,
            "found": True,
            "quarters": parsed["quarters"],
            "net_profit": net_profit_series,
            "all_rows": parsed["rows"],
            "error": None,
        }

    def scrape_multiple(self, queries: List[str]) -> List[Dict[str, Any]]:
        """Scrape multiple companies sequentially with politeness delays."""
        results = []
        for q in queries:
            if not q.strip():
                continue
            res = self.scrape_company(q.strip())
            results.append(res)
        return results


def main():
    """Command-line demonstration of Phase 1."""
    args = sys.argv[1:]
    if not args:
        print("Usage: python3 phase1_core.py <Company1> [Company2 ...]")
        print("Example: python3 phase1_core.py TCS INFY")
        print("\nRunning default demo with 'TCS'...")
        args = ["TCS"]

    scraper = ScreenerScraperCore(delay_seconds=0.5)
    results = scraper.scrape_multiple(args)

    for item in results:
        print("\n" + "=" * 60)
        if not item.get("found"):
            print(f"FAILED: {item.get('error')}")
            continue
        if item.get("error"):
            print(f"ERROR: {item.get('error')}")
            continue

        print(f"Company: {item['name']}")
        print(f"Screener URL: {BASE_URL}{item['url']}")
        quarters = item["quarters"]
        print(f"Quarters Available ({len(quarters)}): {', '.join(quarters[-4:])}")
        
        np_values = item.get("net_profit", [])
        print(f"Quarterly Net Profit (Latest 4 quarters):")
        for q, v in zip(quarters[-4:], np_values[-4:]):
            print(f"  {q}: ₹ {v} Cr")
        
        print("\nAll Available Line Items Extracted:")
        for row_name in item["all_rows"].keys():
            print(f"  - {row_name}")


if __name__ == "__main__":
    main()
