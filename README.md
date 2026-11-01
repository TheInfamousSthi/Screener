# Screener.in Financial Data Scraper & Analyzer

A complete, 4-phase Python financial extraction system and interactive web app that scrapes quarterly financial data (Net Profit, Sales, Expenses, Operating Profit, OPM %, Interest, Depreciation, PBT, Tax %, EPS) from [Screener.in](https://www.screener.in/), parses company quarterly tables, aligns quarters across multiple companies for direct side-by-side comparison, calculates QoQ/YoY changes, and provides CSV/Excel export, caching, and visualization.

---

## 🏗️ Phase Breakdown

### **Phase 1 – Core Logic (`phase1_core.py`)**
- **Search-and-extract pipeline**: Uses Screener's search API (`/api/company/search/?q=...`) to resolve company queries (e.g. `TCS`, `Infosys`, `Reliance`) to their canonical Screener URLs.
- **Section Parsing**: Navigates to `<section id="quarters">` and extracts the header quarters and all financial rows.
- **Error Handling & Politeness**: Sends realistic browser `User-Agent` headers, implements polite request delays (`0.5s` default) to prevent site overload, and gracefully handles unknown tickers or missing tables without crashing.
- **Dependencies**: Pure standard library (`urllib.request`, `json`, `re`). Zero external packages required.
- **Run command**:
  ```bash
  python3 phase1_core.py TCS INFY
  ```

---

### **Phase 2 – Improve & Tabulate (`phase2_tabulate.py`)**
- **Single Company Table**: Displays complete quarterly line items (Sales, Expenses, Operating Profit, OPM %, PBT, Net Profit, EPS) in a clean tabular view.
- **Multi-Company Side-by-Side Comparison**: Automatically performs chronological union and alignment of quarters across all queried companies, allowing direct side-by-side comparison.
- **Consistent Formatting**: Thousands separators, standard units (`₹ Cr`), percentage formatting (`OPM %`), and clean negative number handling (`-₹ 120 Cr`).
- **Performance Summaries**: Computes most recent quarter net profit, QoQ (Quarter-over-Quarter) change in value and percentage, and YoY (Year-over-Year, 4-quarter lag) change.
- **Run command**:
  ```bash
  python3 phase2_tabulate.py TCS INFY WIPRO
  ```

---

### **Phase 3 – Front End**
Provides two clean graphical user interfaces:

#### Option A: Streamlit Web UI (`phase3_streamlit.py`)
- Modern web dashboard with company chips, metric switchers, KPI summary metric cards with QoQ deltas, side-by-side dataframes, and full tabbed company financials.
- **Run command**:
  ```bash
  pip install streamlit pandas
  streamlit run phase3_streamlit.py
  ```

#### Option B: Tkinter Desktop GUI (`phase3_tkinter.py`)
- Native desktop interface built with Python's standard `tkinter` library (works out-of-the-box on Windows/Mac/Linux with zero pip installs).
- Threaded execution prevents UI freezes during network requests.
- Treeview table with horizontal & vertical scrollbars, metric combobox, and summary pane.
- **Run command**:
  ```bash
  python3 phase3_tkinter.py
  ```

---

### **Phase 4 – Extra Features (`phase4_full.py`)**
Modular extra features cleanly isolated on top of the core pipeline:
1. **Result Caching**: Built-in disk cache with configurable TTL (default 4 hours) so repeated queries return in milliseconds without hitting Screener.in again.
2. **CSV / Excel Export**: One-click export of comparison tables to CSV or `.xlsx`.
3. **Net Profit Trend Visualization**: Interactive Matplotlib chart comparing quarterly profit trajectories across companies, with an ASCII sparkline fallback for headless terminal environments.
4. **Comprehensive CLI**:
   ```bash
   # Multi-company comparison with CSV export and trend chart
   python3 phase4_full.py --companies TCS INFY WIPRO --metric "Net Profit" --export-csv comparison.csv --chart-file trend.png

   # Compare auto stocks on Operating Profit Margin (OPM %)
   python3 phase4_full.py --companies TATAMOTORS MARUTI M&M --metric "OPM %"

   # Bypass cache for live scrape
   python3 phase4_full.py --companies TCS --no-cache

   # Clear cache
   python3 phase4_full.py --clear-cache
   ```

---

## ⚖️ Politeness & Terms of Use Notice
This scraper:
- Adds polite request throttling delays (minimum 500ms between calls).
- Sends transparent `User-Agent` headers.
- Employs local caching to prevent redundant requests to Screener.in.
- Is designed for personal financial research and educational comparison purposes.
