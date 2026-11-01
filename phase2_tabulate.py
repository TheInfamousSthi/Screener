"""
Phase 2: Improve and Tabulate - Screener Financial Data Scraper
--------------------------------------------------------------
Features:
- Single company: Pretty-printed table of quarterly Net Profit and related figures
- Multiple companies: Combined side-by-side comparison table with quarters aligned across companies
- Consistent financial formatting: units in ₹ Cr, thousands separators, negative numbers formatted cleanly
- Summary per company: Most recent quarter's net profit, QoQ (Quarter-over-Quarter) change & %, and YoY change
- Zero mandatory dependencies: includes built-in ASCII table formatter, with optional 'tabulate' library support
"""

import sys
import re
from typing import Dict, List, Optional, Tuple, Any
from phase1_core import ScreenerScraperCore, BASE_URL


def parse_financial_number(raw_str: str) -> Optional[float]:
    """
    Parse a formatted financial string (e.g. '12,502', '-150', '26%', '(54)') into a float.
    Returns None if parsing fails.
    """
    if not raw_str or not isinstance(raw_str, str):
        return None
    cleaned = raw_str.strip()
    if not cleaned or cleaned == "-" or cleaned.lower() == "na":
        return None
    
    # Handle parentheses for negatives like (120)
    is_paren_negative = False
    if cleaned.startswith("(") and cleaned.endswith(")"):
        is_paren_negative = True
        cleaned = cleaned[1:-1].strip()

    # Strip currency, percent, commas
    cleaned = cleaned.replace("₹", "").replace("%", "").replace(",", "").strip()
    try:
        val = float(cleaned)
        return -val if is_paren_negative else val
    except ValueError:
        return None


def format_currency_inr(val: Optional[float], is_percentage: bool = False, unit: str = "Cr") -> str:
    """Format numbers cleanly: e.g. '₹ 12,345 Cr', '-₹ 450 Cr', '24.5%'."""
    if val is None:
        return "-"
    if is_percentage:
        return f"{val:+.1f}%" if val != 0 else "0.0%"

    abs_val = abs(val)
    formatted = f"{abs_val:,.1f}" if abs_val % 1 != 0 else f"{int(abs_val):,}"
    unit_str = f" {unit}" if unit else ""
    if val < 0:
        return f"-₹ {formatted}{unit_str}"
    return f"₹ {formatted}{unit_str}"


def calculate_quarter_summary(quarters: List[str], values: List[str]) -> Dict[str, Any]:
    """
    Calculate most recent quarter's net profit, QoQ change, and YoY change.
    """
    if not quarters or not values or len(quarters) != len(values):
        return {
            "latest_quarter": "N/A",
            "latest_profit": None,
            "prev_quarter": "N/A",
            "qoq_change": None,
            "qoq_change_pct": None,
            "yoy_quarter": "N/A",
            "yoy_change": None,
            "yoy_change_pct": None,
        }

    latest_q = quarters[-1]
    latest_val = parse_financial_number(values[-1])

    # QoQ change (against index -2)
    prev_q = quarters[-2] if len(quarters) >= 2 else "N/A"
    prev_val = parse_financial_number(values[-2]) if len(values) >= 2 else None
    
    qoq_change = None
    qoq_pct = None
    if latest_val is not None and prev_val is not None:
        qoq_change = latest_val - prev_val
        if prev_val != 0:
            qoq_pct = (qoq_change / abs(prev_val)) * 100

    # YoY change (4 quarters ago: index -5)
    yoy_q = quarters[-5] if len(quarters) >= 5 else "N/A"
    yoy_val = parse_financial_number(values[-5]) if len(values) >= 5 else None

    yoy_change = None
    yoy_pct = None
    if latest_val is not None and yoy_val is not None:
        yoy_change = latest_val - yoy_val
        if yoy_val != 0:
            yoy_pct = (yoy_change / abs(yoy_val)) * 100

    return {
        "latest_quarter": latest_q,
        "latest_profit": latest_val,
        "prev_quarter": prev_q,
        "qoq_change": qoq_change,
        "qoq_change_pct": qoq_pct,
        "yoy_quarter": yoy_q,
        "yoy_change": yoy_change,
        "yoy_change_pct": yoy_pct,
    }


def format_ascii_table(headers: List[str], rows: List[List[str]]) -> str:
    """Built-in pure-Python ASCII table generator."""
    if not headers:
        return ""
    col_widths = [len(h) for h in headers]
    for row in rows:
        for idx, cell in enumerate(row):
            if idx < len(col_widths):
                col_widths[idx] = max(col_widths[idx], len(str(cell)))

    # Formatting borders
    separator = "+" + "+".join("-" * (w + 2) for w in col_widths) + "+"
    
    lines = [separator]
    # Header row
    header_str = "|" + "|".join(f" {headers[i].center(col_widths[i])} " for i in range(len(headers))) + "|"
    lines.append(header_str)
    lines.append(separator)

    # Data rows
    for row in rows:
        padded = []
        for i in range(len(headers)):
            cell_text = str(row[i]) if i < len(row) else ""
            # Left align first column, right align numeric columns
            if i == 0:
                padded.append(f" {cell_text.ljust(col_widths[i])} ")
            else:
                padded.append(f" {cell_text.rjust(col_widths[i])} ")
        lines.append("|" + "|".join(padded) + "|")

    lines.append(separator)
    return "\n".join(lines)


class ScreenerTabulator:
    def __init__(self, scraper: Optional[ScreenerScraperCore] = None):
        self.scraper = scraper or ScreenerScraperCore()

    def build_single_company_table(self, company_data: Dict[str, Any], max_quarters: int = 8) -> str:
        """
        Build a clear table showing quarterly Net Profit and surrounding figures for a company.
        """
        if not company_data.get("found") or company_data.get("error"):
            return f"Error for {company_data.get('query')}: {company_data.get('error')}"

        quarters = company_data.get("quarters", [])[-max_quarters:]
        all_rows = company_data.get("all_rows", {})

        headers = ["Financial Metric (Rs. Cr)"] + quarters
        table_rows = []

        # Order of metrics to display
        metric_priority = [
            "Sales", "Expenses", "Operating Profit", "OPM %",
            "Other Income", "Interest", "Depreciation",
            "Profit before tax", "Tax %", "Net Profit", "EPS in Rs"
        ]

        # Prioritized rows first, then any others
        seen = set()
        for metric in metric_priority:
            if metric in all_rows:
                seen.add(metric)
                vals = all_rows[metric][-max_quarters:]
                table_rows.append([metric] + vals)

        for metric, vals in all_rows.items():
            if metric not in seen:
                table_rows.append([metric] + vals[-max_quarters:])

        return format_ascii_table(headers, table_rows)

    def align_and_combine_companies(
        self,
        companies: List[Dict[str, Any]],
        metric: str = "Net Profit",
        max_quarters: int = 8
    ) -> Tuple[List[str], List[List[str]], List[Dict[str, Any]]]:
        """
        Align quarters across multiple companies to produce a side-by-side comparison table.
        Returns:
          - headers: ['Company', 'Q1', 'Q2', ...]
          - rows: [[company_name, val_q1, val_q2, ...], ...]
          - summaries: list of QoQ/YoY summary dicts per company
        """
        # 1. Determine common chronological union of quarters
        all_quarters_set = set()
        for comp in companies:
            if comp.get("found") and not comp.get("error"):
                all_quarters_set.update(comp.get("quarters", []))

        if not all_quarters_set:
            return [], [], []

        # Screener format usually: 'Mon YYYY', e.g., 'Dec 2023', 'Mar 2024'
        # Sort them chronologically
        month_order = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
                       "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}

        def quarter_sort_key(q_str: str):
            parts = q_str.strip().split()
            if len(parts) == 2 and parts[0] in month_order and parts[1].isdigit():
                return (int(parts[1]), month_order[parts[0]])
            return (9999, q_str)

        sorted_quarters = sorted(list(all_quarters_set), key=quarter_sort_key)
        # Keep latest `max_quarters`
        selected_quarters = sorted_quarters[-max_quarters:]

        headers = ["Company"] + selected_quarters
        rows = []
        summaries = []

        for comp in companies:
            if not comp.get("found") or comp.get("error"):
                rows.append([comp.get("query", "Unknown")] + ["Error / Not Found"] * len(selected_quarters))
                summaries.append({
                    "company": comp.get("query", "Unknown"),
                    "error": comp.get("error", "Unknown error")
                })
                continue

            name = comp.get("name", comp.get("query", ""))
            comp_quarters = comp.get("quarters", [])
            comp_rows = comp.get("all_rows", {})
            series = comp_rows.get(metric, comp.get("net_profit", []))

            # Build a lookup mapping quarter -> value
            q_map = dict(zip(comp_quarters, series))

            # Form row
            row = [name]
            for q in selected_quarters:
                raw_val = q_map.get(q, "-")
                row.append(raw_val if raw_val else "-")
            rows.append(row)

            # Summary
            summary = calculate_quarter_summary(comp_quarters, series)
            summary["company"] = name
            summaries.append(summary)

        return headers, rows, summaries

    def render_summary_text(self, summary: Dict[str, Any]) -> str:
        """Render a readable text summary of most recent quarter and QoQ/YoY change."""
        if summary.get("error"):
            return f"• {summary['company']}: {summary['error']}"

        latest_q = summary["latest_quarter"]
        profit_str = format_currency_inr(summary["latest_profit"])
        qoq_str = ""
        if summary["qoq_change"] is not None:
            qoq_direction = "▲" if summary["qoq_change"] >= 0 else "▼"
            qoq_val = format_currency_inr(summary["qoq_change"])
            qoq_pct = f"{summary['qoq_change_pct']:+.1f}%" if summary["qoq_change_pct"] is not None else ""
            qoq_str = f" | QoQ: {qoq_direction} {qoq_val} ({qoq_pct})"

        yoy_str = ""
        if summary["yoy_change"] is not None:
            yoy_direction = "▲" if summary["yoy_change"] >= 0 else "▼"
            yoy_val = format_currency_inr(summary["yoy_change"])
            yoy_pct = f"{summary['yoy_change_pct']:+.1f}%" if summary["yoy_change_pct"] is not None else ""
            yoy_str = f" | YoY: {yoy_direction} {yoy_val} ({yoy_pct})"

        return f"• {summary['company']} ({latest_q}): Net Profit = {profit_str}{qoq_str}{yoy_str}"


def main():
    queries = sys.argv[1:]
    if not queries:
        print("Usage: python3 phase2_tabulate.py <Company1> [Company2 ...]")
        print("Example: python3 phase2_tabulate.py TCS INFY WIPRO")
        print("\nDemonstrating comparison table with TCS and Infosys...")
        queries = ["TCS", "Infosys"]

    tabulator = ScreenerTabulator()
    companies_data = tabulator.scraper.scrape_multiple(queries)

    print("\n" + "=" * 80)
    print("PHASE 2: DETAILED & COMPARISON TABLE OUTPUT")
    print("=" * 80)

    # If single company, show full financial breakdown
    if len(companies_data) == 1:
        comp = companies_data[0]
        print(f"\nFINANCIAL BREAKDOWN FOR {comp.get('name', 'Company')}:")
        print(tabulator.build_single_company_table(comp, max_quarters=6))
        summary = calculate_quarter_summary(comp.get("quarters", []), comp.get("all_rows", {}).get("Net Profit", []))
        summary["company"] = comp.get("name")
        print("\nQuarterly Performance Summary:")
        print(tabulator.render_summary_text(summary))
    else:
        # Multi-company comparison
        headers, rows, summaries = tabulator.align_and_combine_companies(companies_data, metric="Net Profit", max_quarters=6)
        print("\nSIDE-BY-SIDE QUARTERLY NET PROFIT COMPARISON (₹ Crores):")
        print(format_ascii_table(headers, rows))

        print("\nCOMPANY PERFORMANCE SUMMARIES (QoQ & YoY):")
        for s in summaries:
            print(tabulator.render_summary_text(s))


if __name__ == "__main__":
    main()
