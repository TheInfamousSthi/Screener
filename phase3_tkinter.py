"""
Phase 3 Alternative: Tkinter Desktop GUI Application
---------------------------------------------------
Run with: python3 phase3_tkinter.py
Requirements: Standard Python 3 installation (Tkinter is built into Python)

Features:
- Native desktop window with clean layout
- Input box for comma-separated company names
- Background threading so GUI remains responsive during scraping
- Status bar with loading indicator
- Treeview tabular presentation of quarterly financials
- QoQ/YoY summary display
"""

import sys
import threading
import tkinter as tk
from tkinter import ttk, messagebox
from typing import List, Dict, Any
from phase1_core import ScreenerScraperCore
from phase2_tabulate import ScreenerTabulator, calculate_quarter_summary, format_currency_inr


class ScreenerTkinterApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Screener.in Financial Analyzer (Phase 3 Desktop GUI)")
        self.root.geometry("980x640")
        self.root.minsize(750, 480)

        self.scraper = ScreenerScraperCore(delay_seconds=0.4)
        self.tabulator = ScreenerTabulator(self.scraper)

        self._build_ui()

    def _build_ui(self):
        # Top input frame
        input_frame = ttk.LabelFrame(self.root, text=" Company Search ", padding=12)
        input_frame.pack(fill="x", padx=12, pady=8)

        ttk.Label(
            input_frame,
            text="Enter Company Names or Symbols (comma-separated):",
            font=("Helvetica", 10, "bold")
        ).pack(anchor="w", pady=(0, 4))

        entry_subframe = ttk.Frame(input_frame)
        entry_subframe.pack(fill="x", pady=2)

        self.company_var = tk.StringVar(value="TCS, INFY, WIPRO")
        self.entry = ttk.Entry(entry_subframe, textvariable=self.company_var, font=("Helvetica", 11))
        self.entry.pack(side="left", fill="x", expand=True, padx=(0, 8))

        self.btn_fetch = ttk.Button(entry_subframe, text="Fetch Financials", command=self.on_fetch_clicked)
        self.btn_fetch.pack(side="right")

        # Metric selector and options
        opt_frame = ttk.Frame(input_frame)
        opt_frame.pack(fill="x", pady=(8, 0))

        ttk.Label(opt_frame, text="Comparison Metric:").pack(side="left", padx=(0, 6))
        self.metric_var = tk.StringVar(value="Net Profit")
        metric_combo = ttk.Combobox(
            opt_frame,
            textvariable=self.metric_var,
            values=["Net Profit", "Sales", "Expenses", "Operating Profit", "OPM %", "EPS in Rs"],
            state="readonly",
            width=18
        )
        metric_combo.pack(side="left", padx=(0, 16))
        metric_combo.bind("<<ComboboxSelected>>", lambda e: self.refresh_display())

        # Status / Progress frame
        self.status_var = tk.StringVar(value="Ready. Enter companies and click 'Fetch Financials'.")
        self.status_lbl = ttk.Label(self.root, textvariable=self.status_var, font=("Helvetica", 9, "italic"), foreground="#444")
        self.status_lbl.pack(anchor="w", padx=14, pady=2)

        # Center notebook tabs
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill="both", expand=True, padx=12, pady=6)

        # Tab 1: Comparison table
        self.tab_compare = ttk.Frame(self.notebook, padding=6)
        self.notebook.add(self.tab_compare, text="Side-by-Side Comparison")

        # Table inside Tab 1
        self.tree_compare = ttk.Treeview(self.tab_compare, show="headings")
        vsb1 = ttk.Scrollbar(self.tab_compare, orient="vertical", command=self.tree_compare.yview)
        hsb1 = ttk.Scrollbar(self.tab_compare, orient="horizontal", command=self.tree_compare.xview)
        self.tree_compare.configure(yscrollcommand=vsb1.set, xscrollcommand=hsb1.set)
        
        self.tree_compare.pack(side="top", fill="both", expand=True)
        vsb1.pack(side="right", fill="y")
        hsb1.pack(side="bottom", fill="x")

        # Summary box
        summary_frame = ttk.LabelFrame(self.tab_compare, text=" Performance Summaries (QoQ & YoY) ", padding=8)
        summary_frame.pack(fill="x", pady=(6, 0))
        self.summary_text = tk.Text(summary_frame, height=4, font=("Courier", 9), wrap="word", bg="#f9f9f9")
        self.summary_text.pack(fill="both", expand=True)

        self.last_results: List[Dict[str, Any]] = []

    def on_fetch_clicked(self):
        query_text = self.company_var.get().strip()
        names = [n.strip() for n in query_text.split(",") if n.strip()]
        if not names:
            messagebox.showwarning("Input Required", "Please enter at least one company name or symbol.")
            return

        self.btn_fetch.config(state="disabled")
        self.status_var.set(f"Scraping Screener.in for {len(names)} companies... please wait...")
        self.status_lbl.config(foreground="#0055aa")

        # Run scraping in separate thread to prevent UI freezing
        thread = threading.Thread(target=self._run_scrape_thread, args=(names,), daemon=True)
        thread.start()

    def _run_scrape_thread(self, names: List[str]):
        try:
            results = self.scraper.scrape_multiple(names)
            self.root.after(0, self._on_scrape_finished, results)
        except Exception as e:
            self.root.after(0, self._on_scrape_error, str(e))

    def _on_scrape_finished(self, results: List[Dict[str, Any]]):
        self.btn_fetch.config(state="normal")
        self.last_results = results

        successful = [r for r in results if r.get("found") and not r.get("error")]
        failed = [r for r in results if not r.get("found") or r.get("error")]

        if failed:
            err_msgs = [f"• {f.get('query')}: {f.get('error', 'Not found')}" for f in failed]
            self.status_var.set(f"Finished with {len(failed)} error(s). {len(successful)} retrieved.")
            self.status_lbl.config(foreground="#aa0000")
            messagebox.showwarning("Notice", "Some companies could not be resolved:\n\n" + "\n".join(err_msgs))
        else:
            self.status_var.set(f"Successfully retrieved all {len(successful)} companies.")
            self.status_lbl.config(foreground="#007700")

        self.refresh_display()

    def _on_scrape_error(self, err_msg: str):
        self.btn_fetch.config(state="normal")
        self.status_var.set(f"Scrape failed: {err_msg}")
        self.status_lbl.config(foreground="#aa0000")
        messagebox.showerror("Error", f"Failed to fetch data:\n{err_msg}")

    def refresh_display(self):
        if not self.last_results:
            return

        successful = [r for r in self.last_results if r.get("found") and not r.get("error")]
        metric = self.metric_var.get()

        # Clear existing Treeview
        for col in self.tree_compare["columns"]:
            self.tree_compare.heading(col, text="")
        self.tree_compare.delete(*self.tree_compare.get_children())

        headers, rows, summaries = self.tabulator.align_and_combine_companies(
            successful, metric=metric, max_quarters=8
        )

        if headers and rows:
            self.tree_compare["columns"] = headers
            for h in headers:
                self.tree_compare.heading(h, text=h)
                self.tree_compare.column(h, width=110 if h != "Company" else 220, anchor="e" if h != "Company" else "w")

            for r in rows:
                self.tree_compare.insert("", "end", values=r)

        # Update summary box
        self.summary_text.delete("1.0", tk.END)
        for s in summaries:
            self.summary_text.insert(tk.END, self.tabulator.render_summary_text(s) + "\n")


def main():
    root = tk.Tk()
    app = ScreenerTkinterApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
