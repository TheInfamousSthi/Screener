"""
Phase 3: Front End (Streamlit Web Interface)
---------------------------------------------
Run with: streamlit run phase3_streamlit.py
Requirements: pip install streamlit pandas

Features:
- Clean, uncluttered UI
- Input field supporting comma-separated company names or symbols (e.g., 'TCS, Infosys, Wipro')
- Loading spinner and status messages during fetching
- Detailed per-company financial results + side-by-side comparison table
- Metric delta cards for latest Net Profit, QoQ change, and YoY change
- Clear error alerts for unrecognized companies
"""

import streamlit as st
import pandas as pd
from typing import List
from phase1_core import ScreenerScraperCore
from phase2_tabulate import ScreenerTabulator, calculate_quarter_summary, format_currency_inr

st.set_page_config(
    page_title="Screener Financial Analyzer",
    page_icon="📈",
    layout="wide",
)

st.title("📈 Screener.in Financial Data Extractor")
st.caption("Extract and compare quarterly financials (Net Profit, Sales, OPM%, EPS) directly from Screener.in")

# Sidebar options & instructions
with st.sidebar:
    st.header("⚙️ Configuration")
    metric_choice = st.selectbox(
        "Comparison Metric",
        options=["Net Profit", "Sales", "Expenses", "Operating Profit", "OPM %", "EPS in Rs"],
        index=0,
    )
    max_quarters = st.slider("Max Quarters to Display", min_value=4, max_value=12, value=8)
    st.markdown("---")
    st.markdown("### Quick Examples:")
    if st.button("IT Giants (TCS, Infosys, Wipro)"):
        st.session_state["company_input"] = "TCS, INFY, WIPRO"
    if st.button("Auto Sector (Tata Motors, Maruti, M&M)"):
        st.session_state["company_input"] = "TATAMOTORS, MARUTI, M&M"
    if st.button("Banking (HDFC Bank, ICICI Bank, SBI)"):
        st.session_state["company_input"] = "HDFCBANK, ICICIBANK, SBIN"

# Default input state
default_val = st.session_state.get("company_input", "TCS, INFY")
companies_input = st.text_input(
    "Enter Company Names or NSE/BSE Symbols (comma-separated):",
    value=default_val,
    placeholder="e.g. TCS, Infosys, Reliance, Tata Motors",
)

fetch_btn = st.button("📊 Fetch Financial Data", type="primary")

if fetch_btn or "last_results" in st.session_state:
    raw_names = [name.strip() for name in companies_input.split(",") if name.strip()]
    
    if not raw_names:
        st.warning("Please enter at least one company name or symbol.")
    else:
        scraper = ScreenerScraperCore(delay_seconds=0.4)
        tabulator = ScreenerTabulator(scraper)

        with st.spinner(f"Fetching financial data from Screener.in for {len(raw_names)} company(s)..."):
            results = scraper.scrape_multiple(raw_names)
            st.session_state["last_results"] = results

        # Process results
        successful = [r for r in results if r.get("found") and not r.get("error")]
        failed = [r for r in results if not r.get("found") or r.get("error")]

        # Show error messages if any failed
        for f in failed:
            st.error(f"❌ {f.get('query')}: {f.get('error', 'Company not found or data unavailable')}")

        if successful:
            st.success(f"Successfully retrieved financial quarters for {len(successful)} companies.")

            # Performance Summary Cards (Latest Net Profit + QoQ + YoY)
            st.subheader("📌 Recent Quarter Performance Summary")
            cols = st.columns(min(len(successful), 4))
            for idx, comp in enumerate(successful):
                col = cols[idx % len(cols)]
                quarters = comp.get("quarters", [])
                net_profits = comp.get("all_rows", {}).get("Net Profit", [])
                summary = calculate_quarter_summary(quarters, net_profits)
                
                with col:
                    st.metric(
                        label=f"{comp.get('name')} ({summary['latest_quarter']})",
                        value=format_currency_inr(summary["latest_profit"]),
                        delta=(
                            f"{summary['qoq_change_pct']:+.1f}% QoQ"
                            if summary["qoq_change_pct"] is not None
                            else None
                        ),
                    )

            # Combined Side-by-Side Comparison Table
            st.markdown("---")
            st.subheader(f"📊 Side-by-Side Comparison: {metric_choice} (₹ Crores)")
            headers, rows, summaries = tabulator.align_and_combine_companies(
                successful, metric=metric_choice, max_quarters=max_quarters
            )

            if headers and rows:
                df_compare = pd.DataFrame(rows, columns=headers)
                st.dataframe(df_compare, use_container_width=True, hide_index=True)

            # Individual Company Full Tabs
            st.markdown("---")
            st.subheader("📑 Full Quarterly Financial Breakdown")
            comp_tabs = st.tabs([c.get("name", c.get("query")) for c in successful])
            
            for tab, comp in zip(comp_tabs, successful):
                with tab:
                    quarters = comp.get("quarters", [])[-max_quarters:]
                    rows_data = []
                    all_rows = comp.get("all_rows", {})
                    for row_name, row_vals in all_rows.items():
                        rows_data.append([row_name] + row_vals[-max_quarters:])
                    
                    df_comp = pd.DataFrame(rows_data, columns=["Financial Metric (Rs. Cr)"] + quarters)
                    st.dataframe(df_comp, use_container_width=True, hide_index=True)
