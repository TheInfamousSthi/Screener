"""
Phase 4: Extra Features - Screener Financial Data Scraper
---------------------------------------------------------
Features added cleanly on top of Phases 1-3:
1. Result Caching (TTL-based disk/memory cache to minimize site requests)
2. CSV and Excel Export (export side-by-side tables with one command)
3. Net Profit Trend Chart (Matplotlib line/bar visualization + ASCII sparkline fallback)
4. Comprehensive CLI supporting all features
"""

import sys
import os
import json
import time
import csv
import argparse
from typing import Dict, List, Optional, Tuple, Any

from phase1_core import ScreenerScraperCore, BASE_URL
from phase2_tabulate import (
    ScreenerTabulator,
    calculate_quarter_summary,
    format_currency_inr,
    format_ascii_table,
    parse_financial_number,
)

CACHE_DIR = os.path.expanduser("~/.screener_scraper_cache")
DEFAULT_CACHE_TTL_SECONDS = 3600 * 4  # 4 hours


# ==============================================================================
# Feature 1: Isolated Caching Layer
# ==============================================================================
class ScreenerCache:
    """
    Isolated disk-backed JSON cache with Time-To-Live (TTL).
    Saves results to prevent repetitive scraping of the same company.
    """
    def __init__(self, cache_dir: str = CACHE_DIR, ttl_seconds: int = DEFAULT_CACHE_TTL_SECONDS):
        self.cache_dir = cache_dir
        self.ttl_seconds = ttl_seconds
        os.makedirs(self.cache_dir, exist_ok=True)

    def _get_cache_path(self, key: str) -> str:
        safe_key = "".join(c if c.isalnum() else "_" for c in key.lower())
        return os.path.join(self.cache_dir, f"{safe_key}.json")

    def get(self, key: str) -> Optional[Dict[str, Any]]:
        path = self._get_cache_path(key)
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                payload = json.load(f)
            cached_time = payload.get("_cached_at", 0)
            if (time.time() - cached_time) > self.ttl_seconds:
                # Expired
                return None
            return payload.get("data")
        except Exception:
            return None

    def set(self, key: str, data: Dict[str, Any]):
        path = self._get_cache_path(key)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump({"_cached_at": time.time(), "data": data}, f, indent=2)
        except Exception as e:
            print(f"[!] Warning: Failed to write cache for {key}: {e}", file=sys.stderr)

    def clear(self):
        """Purge all cached files."""
        if os.path.exists(self.cache_dir):
            for fname in os.listdir(self.cache_dir):
                if fname.endswith(".json"):
                    try:
                        os.remove(os.path.join(self.cache_dir, fname))
                    except Exception:
                        pass


# ==============================================================================
# Feature 2: Isolated Export Utilities (CSV & Excel)
# ==============================================================================
def export_table_to_csv(headers: List[str], rows: List[List[str]], filepath: str) -> str:
    """Export tabulated data directly to a clean CSV file."""
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)
    return os.path.abspath(filepath)


def export_table_to_excel(headers: List[str], rows: List[List[str]], filepath: str) -> str:
    """
    Export tabulated data to an Excel file.
    Uses openpyxl / pandas if installed; otherwise falls back gracefully to CSV.
    """
    try:
        import pandas as pd
        df = pd.DataFrame(rows, columns=headers)
        df.to_excel(filepath, index=False)
        return os.path.abspath(filepath)
    except ImportError:
        # Fallback to CSV if openpyxl/pandas not installed
        csv_fallback = filepath if filepath.endswith(".csv") else filepath + ".csv"
        print("[*] pandas/openpyxl not found. Exporting to CSV instead...")
        return export_table_to_csv(headers, rows, csv_fallback)


# ==============================================================================
# Feature 3: Isolated Chart Generation
# ==============================================================================
def plot_quarterly_chart(
    companies: List[Dict[str, Any]],
    metric: str = "Net Profit",
    output_image: Optional[str] = None,
    max_quarters: int = 8,
    show_gui: bool = True
) -> Optional[str]:
    """
    Generate a chart of Net Profit (or chosen metric) over quarters.
    Requires matplotlib. Returns the saved image path or displays plot window.
    """
    try:
        import matplotlib.pyplot as plt
    except ImportError:
        print("[!] Matplotlib is not installed. Run 'pip install matplotlib' for charts.")
        print("[*] Rendering terminal ASCII trend instead:\n")
        render_ascii_sparklines(companies, metric=metric, max_quarters=max_quarters)
        return None

    # Determine aligned quarters
    all_quarters_set = set()
    for comp in companies:
        if comp.get("found") and not comp.get("error"):
            all_quarters_set.update(comp.get("quarters", []))

    if not all_quarters_set:
        return None

    month_order = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
                   "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}

    def q_key(q_str: str):
        parts = q_str.strip().split()
        if len(parts) == 2 and parts[0] in month_order and parts[1].isdigit():
            return (int(parts[1]), month_order[parts[0]])
        return (9999, q_str)

    sorted_quarters = sorted(list(all_quarters_set), key=q_key)[-max_quarters:]

    fig, ax = plt.subplots(figsize=(10, 5.5), dpi=120)

    for comp in companies:
        if not comp.get("found") or comp.get("error"):
            continue
        c_name = comp.get("name", comp.get("query"))
        c_quarters = comp.get("quarters", [])
        c_series = comp.get("all_rows", {}).get(metric, comp.get("net_profit", []))
        q_map = dict(zip(c_quarters, c_series))

        y_vals = []
        for q in sorted_quarters:
            raw = q_map.get(q)
            num = parse_financial_number(raw) if raw else None
            y_vals.append(num)

        ax.plot(sorted_quarters, y_vals, marker="o", linewidth=2.5, label=c_name)

    ax.set_title(f"Quarterly {metric} Trend (₹ Crores)", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Quarter", fontsize=11)
    ax.set_ylabel("₹ Crores", fontsize=11)
    ax.grid(True, linestyle="--", alpha=0.5)
    ax.legend(loc="best")
    plt.xticks(rotation=25)
    plt.tight_layout()

    if output_image:
        plt.savefig(output_image, dpi=150)
        plt.close(fig)
        return os.path.abspath(output_image)
    elif show_gui:
        plt.show()
    return None


def render_ascii_sparklines(companies: List[Dict[str, Any]], metric: str = "Net Profit", max_quarters: int = 6):
    """Fallback text trendline when matplotlib is not available."""
    spark_chars = [" ", "▂", "▃", "▄", "▅", "▆", "▇", "█"]
    for comp in companies:
        if not comp.get("found") or comp.get("error"):
            continue
        name = comp.get("name", comp.get("query"))
        raw_vals = comp.get("all_rows", {}).get(metric, [])[-max_quarters:]
        nums = [parse_financial_number(v) or 0.0 for v in raw_vals]
        if not nums:
            continue
        min_v, max_v = min(nums), max(nums)
        span = (max_v - min_v) if max_v != min_v else 1.0
        spark = ""
        for n in nums:
            idx = int(((n - min_v) / span) * (len(spark_chars) - 1))
            spark += spark_chars[max(0, min(len(spark_chars) - 1, idx))]
        print(f"  {name[:28].ljust(30)}: [{spark}] (Latest: ₹ {nums[-1]:,.0f} Cr)")


# ==============================================================================
# Cached Scraper Integration
# ==============================================================================
class CachedScreenerScraper(ScreenerScraperCore):
    def __init__(self, delay_seconds: float = 0.5, use_cache: bool = True, ttl_seconds: int = DEFAULT_CACHE_TTL_SECONDS):
        super().__init__(delay_seconds=delay_seconds)
        self.use_cache = use_cache
        self.cache = ScreenerCache(ttl_seconds=ttl_seconds)

    def scrape_company(self, query: str) -> Dict[str, Any]:
        cleaned_key = query.strip().upper()
        if self.use_cache:
            cached_data = self.cache.get(cleaned_key)
            if cached_data:
                print(f"[CACHE HIT] Loaded '{query}' from local cache.")
                cached_data["from_cache"] = True
                return cached_data

        result = super().scrape_company(query)
        if self.use_cache and result.get("found") and not result.get("error"):
            self.cache.set(cleaned_key, result)
        return result


# ==============================================================================
# Phase 4 CLI Runner
# ==============================================================================
def main():
    parser = argparse.ArgumentParser(
        description="Phase 4: Screener.in Scraper with Caching, Side-by-Side Comparison, CSV/Excel Export & Charts"
    )
    parser.add_argument(
        "-c", "--companies",
        nargs="+",
        default=["TCS", "INFY"],
        help="List of company names or symbols (e.g. -c TCS INFY WIPRO)"
    )
    parser.add_argument(
        "-m", "--metric",
        default="Net Profit",
        choices=["Net Profit", "Sales", "Expenses", "Operating Profit", "OPM %", "EPS in Rs"],
        help="Financial metric for comparison table & chart"
    )
    parser.add_argument(
        "--quarters",
        type=int,
        default=8,
        help="Number of recent quarters to show (default: 8)"
    )
    parser.add_argument(
        "--export-csv",
        metavar="FILEPATH",
        help="Export comparison table to CSV file (e.g. --export-csv comparison.csv)"
    )
    parser.add_argument(
        "--export-excel",
        metavar="FILEPATH",
        help="Export comparison table to Excel file (.xlsx)"
    )
    parser.add_argument(
        "--chart",
        action="store_true",
        help="Display or save trend chart of the metric"
    )
    parser.add_argument(
        "--chart-file",
        metavar="IMAGEPATH",
        help="Save trend chart to image file (e.g. chart.png)"
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Bypass local cache and force live scrape"
    )
    parser.add_argument(
        "--clear-cache",
        action="store_true",
        help="Clear local cache and exit"
    )

    args = parser.parse_args()

    if args.clear_cache:
        cache = ScreenerCache()
        cache.clear()
        print("[✓] Local cache successfully cleared.")
        return

    scraper = CachedScreenerScraper(use_cache=not args.no_cache)
    tabulator = ScreenerTabulator(scraper)

    print(f"\n[*] Querying {len(args.companies)} companies: {', '.join(args.companies)}...")
    companies_data = scraper.scrape_multiple(args.companies)

    headers, rows, summaries = tabulator.align_and_combine_companies(
        companies_data, metric=args.metric, max_quarters=args.quarters
    )

    print("\n" + "=" * 80)
    print(f"SIDE-BY-SIDE QUARTERLY {args.metric.upper()} COMPARISON (₹ Crores)")
    print("=" * 80)
    print(format_ascii_table(headers, rows))

    print("\n" + "-" * 80)
    print("QUARTERLY PERFORMANCE SUMMARIES (QoQ & YoY)")
    print("-" * 80)
    for s in summaries:
        print(tabulator.render_summary_text(s))

    # Export CSV if requested
    if args.export_csv:
        csv_path = export_table_to_csv(headers, rows, args.export_csv)
        print(f"\n[✓] Exported CSV to: {csv_path}")

    # Export Excel if requested
    if args.export_excel:
        excel_path = export_table_to_excel(headers, rows, args.export_excel)
        print(f"\n[✓] Exported Excel to: {excel_path}")

    # Chart if requested
    if args.chart or args.chart_file:
        img_path = plot_quarterly_chart(
            companies_data,
            metric=args.metric,
            output_image=args.chart_file,
            max_quarters=args.quarters,
            show_gui=(not args.chart_file)
        )
        if img_path:
            print(f"[✓] Saved chart image to: {img_path}")


if __name__ == "__main__":
    main()
