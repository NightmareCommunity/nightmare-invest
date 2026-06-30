"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, FadeIn, SkeletonCard, SkeletonMetric, SkeletonTable, MetricTile } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { fmtUSD, fmtPct, fmtDate, fmtDateTime } from "@/lib/format";
import { FileText, Download, FileSpreadsheet, TrendingUp, Calendar, Calculator, ArrowUpDown, Receipt, TrendingDown, Eye, Share2, FileBarChart, Clock, BarChart3, Zap, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Report Builder Types                                               */
/* ------------------------------------------------------------------ */

type ReportType = "monthly" | "quarterly" | "tax" | "custom";

const REPORT_TYPES: { value: ReportType; label: string; desc: string; icon: typeof FileText }[] = [
  { value: "monthly", label: "Monthly Statement", desc: "Monthly performance summary with NAV and holdings", icon: Calendar },
  { value: "quarterly", label: "Quarterly Report", desc: "Quarterly deep-dive with analytics and attribution", icon: BarChart3 },
  { value: "tax", label: "Tax Summary", desc: "Capital gains, cost basis, and tax lot analysis", icon: Calculator },
  { value: "custom", label: "Custom Report", desc: "Build a custom report with your preferred metrics", icon: FileBarChart },
];

/* ------------------------------------------------------------------ */
/*  Mini chart data for visual summary cards                           */
/* ------------------------------------------------------------------ */

function generateMiniSparkline(length: number, base: number, volatility: number): number[] {
  const data: number[] = [];
  let val = base;
  for (let i = 0; i < length; i++) {
    val += (Math.random() - 0.45) * volatility;
    data.push(Math.round(val * 100) / 100);
  }
  return data;
}

export function ReportsPage() {
  const { data: report, isLoading } = useQuery<any>({ queryKey: ["report"], queryFn: () => api.get("/api/reports") });
  const { data: txnData } = useQuery<any>({ queryKey: ["my-transactions"], queryFn: () => api.get("/api/transactions") });
  const { data: portfolioData } = useQuery<any>({ queryKey: ["portfolio"], queryFn: () => api.get("/api/portfolio") });
  const [downloading, setDownloading] = useState(false);
  const [costBasisMethod, setCostBasisMethod] = useState<"FIFO" | "LIFO">("FIFO");
  const [taxLotSort, setTaxLotSort] = useState<"date" | "pnl" | "holding">("date");
  const [taxLotSortDir, setTaxLotSortDir] = useState<"asc" | "desc">("asc");

  /* Report Builder state */
  const [selectedReportType, setSelectedReportType] = useState<ReportType>("monthly");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [generating, setGenerating] = useState(false);

  /* Visual Summary sparklines */
  const ytdSparkline = useMemo(() => generateMiniSparkline(24, 100, 2), []);
  const contributionSparkline = useMemo(() => generateMiniSparkline(12, 50000, 5000), []);

  // ─── Tax Reporting: Simulated data ───
  const taxData = useMemo(() => {
    const s = portfolioData?.summary;
    if (!s) return null;

    const now = Date.now();
    const dayMs = 86400000;

    const txns = txnData?.transactions ?? [];
    const deposits = txns.filter((t: any) => t.type === "DEPOSIT" && t.status === "APPROVED");

    const taxLots = deposits.map((d: any, idx: number) => {
      const purchaseDate = new Date(d.createdAt);
      const daysHeld = Math.floor((now - purchaseDate.getTime()) / dayMs);
      const isLongTerm = daysHeld >= 365;
      const unitsAcquired = d.amount / (s.avgPrice || 1);
      const costBasisPerUnit = s.avgPrice || d.amount;
      const totalCost = d.amount;
      const currentValue = unitsAcquired * (s.currentNav || s.avgPrice || 1);
      const unrealizedPnl = currentValue - totalCost;

      return {
        id: d.id || idx,
        purchaseDate: d.createdAt,
        unitsAcquired: Math.round(unitsAcquired * 10000) / 10000,
        costBasisPerUnit,
        totalCost,
        currentValue,
        unrealizedPnl,
        holdingPeriod: isLongTerm ? "Long" as const : "Short" as const,
        daysHeld,
        fileSize: `${(Math.random() * 200 + 50).toFixed(0)} KB`,
      };
    });

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonth = new Date().getMonth();
    const monthlyGains = months.slice(0, currentMonth + 1).map((month, idx) => {
      const shortTermGain = Math.round((Math.sin(idx * 1.3 + 2) * 3000 + 2000) * 100) / 100;
      const longTermGain = Math.round((Math.cos(idx * 0.9 + 1) * 2000 + 1500) * 100) / 100;
      return {
        month,
        shortTerm: Math.max(0, shortTermGain),
        longTerm: Math.max(0, longTermGain),
        shortTermLoss: shortTermGain < 0 ? Math.abs(shortTermGain) : 0,
        longTermLoss: longTermGain < 0 ? Math.abs(longTermGain) : 0,
      };
    });

    const totalRealizedGains = monthlyGains.reduce((acc, m) => acc + m.shortTerm + m.longTerm, 0);
    const totalRealizedLosses = monthlyGains.reduce((acc, m) => acc + m.shortTermLoss + m.longTermLoss, 0);
    const netRealizedGains = totalRealizedGains - totalRealizedLosses;

    const shortTermGainsTotal = monthlyGains.reduce((acc, m) => acc + m.shortTerm, 0);
    const longTermGainsTotal = monthlyGains.reduce((acc, m) => acc + m.longTerm, 0);

    const estimatedTaxLiability = (shortTermGainsTotal * 0.37) + (longTermGainsTotal * 0.20);

    return {
      taxLots,
      monthlyGains,
      totalRealizedGains,
      totalRealizedLosses,
      netRealizedGains,
      shortTermGainsTotal,
      longTermGainsTotal,
      estimatedTaxLiability,
    };
  }, [portfolioData, txnData]);

  // Sorted tax lots
  const sortedTaxLots = useMemo(() => {
    if (!taxData) return [];
    const lots = [...taxData.taxLots];
    lots.sort((a, b) => {
      let cmp = 0;
      if (taxLotSort === "date") cmp = new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime();
      else if (taxLotSort === "pnl") cmp = a.unrealizedPnl - b.unrealizedPnl;
      else if (taxLotSort === "holding") cmp = a.daysHeld - b.daysHeld;
      return taxLotSortDir === "asc" ? cmp : -cmp;
    });
    return lots;
  }, [taxData, taxLotSort, taxLotSortDir]);

  // Tax CSV export
  const exportTaxReport = () => {
    if (!taxData) return;
    setDownloading(true);
    try {
      let csv = "Nightmare Invest — Tax Report\n\n";
      csv += "TAX SUMMARY\n";
      csv += `Total Realized Gains YTD,${taxData.totalRealizedGains.toFixed(2)}\n`;
      csv += `Short-Term Gains,${taxData.shortTermGainsTotal.toFixed(2)}\n`;
      csv += `Long-Term Gains,${taxData.longTermGainsTotal.toFixed(2)}\n`;
      csv += `Estimated Tax Liability,${taxData.estimatedTaxLiability.toFixed(2)}\n`;
      csv += `Cost Basis Method,${costBasisMethod}\n\n`;
      csv += "TAX LOTS\n";
      csv += "Purchase Date,Units Acquired,Cost Basis/Unit,Total Cost,Current Value,Unrealized P&L,Holding Period,Days Held\n";
      taxData.taxLots.forEach((lot) => {
        csv += `${fmtDate(lot.purchaseDate)},${lot.unitsAcquired},${lot.costBasisPerUnit.toFixed(4)},${lot.totalCost.toFixed(2)},${lot.currentValue.toFixed(2)},${lot.unrealizedPnl.toFixed(2)},${lot.holdingPeriod},${lot.daysHeld}\n`;
      });
      csv += "\nMONTHLY REALIZED GAINS\n";
      csv += "Month,Short-Term Gains,Long-Term Gains\n";
      taxData.monthlyGains.forEach((m) => {
        csv += `${m.month},${m.shortTerm.toFixed(2)},${m.longTerm.toFixed(2)}`;
      });

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nightmare-tax-report-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Tax report exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setDownloading(false);
    }
  };

  // Sort handler
  const handleSort = (col: "date" | "pnl" | "holding") => {
    if (taxLotSort === col) {
      setTaxLotSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setTaxLotSort(col);
      setTaxLotSortDir("asc");
    }
  };

  // Stacked bar chart data for gains/losses
  const gainsChartData = useMemo(() => {
    if (!taxData) return [];
    return taxData.monthlyGains.map((m) => ({
      month: m.month,
      shortTerm: Math.round(m.shortTerm),
      longTerm: Math.round(m.longTerm),
    }));
  }, [taxData]);

  // Generate Report handler
  const handleGenerateReport = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      toast.success(`${REPORT_TYPES.find(r => r.value === selectedReportType)?.label} generated successfully`);
    }, 2000);
  };

  // Report history with additional data
  const reportHistory = useMemo(() => [
    { id: 1, name: "Monthly Statement — January 2025", type: "monthly", date: new Date(2025, 0, 31), size: "245 KB", status: "ready" },
    { id: 2, name: "Quarterly Report — Q4 2024", type: "quarterly", date: new Date(2025, 0, 15), size: "1.2 MB", status: "ready" },
    { id: 3, name: "Tax Summary — 2024", type: "tax", date: new Date(2025, 0, 1), size: "892 KB", status: "ready" },
    { id: 4, name: "Monthly Statement — December 2024", type: "monthly", date: new Date(2024, 11, 31), size: "198 KB", status: "ready" },
    { id: 5, name: "Custom Report — Portfolio Analysis", type: "custom", date: new Date(2024, 11, 20), size: "345 KB", status: "ready" },
    { id: 6, name: "Quarterly Report — Q3 2024", type: "quarterly", date: new Date(2024, 9, 1), size: "1.1 MB", status: "ready" },
  ], []);

  if (isLoading || !report) {
    return (
      <div className="space-y-4 sm:space-y-5 lg:space-y-6">
        <FadeIn>
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Reports &amp; Statements</h1>
            <p className="text-sm text-muted-foreground">Download portfolio statements and transaction records</p>
          </div>
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} className="h-32 hover-lift" />)}
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <GlassCard className="p-3 sm:p-5">
            <SkeletonMetric className="h-6 w-40 rounded mb-4" />
            <SkeletonTable rows={4} cols={4} />
          </GlassCard>
        </FadeIn>
      </div>
    );
  }

  const downloadStatement = (format: "csv-ledger" | "csv-transactions" | "json-full") => {
    setDownloading(true);
    try {
      let content = "";
      let filename = "";
      if (format === "csv-ledger") {
        const rows = report.ledger as any[];
        content = "Date,Type,Amount,Balance After,Reference\n" +
          rows.map((r) => `${r.createdAt},${r.type},${r.amount},${r.balanceAfter},${r.reference ?? ""}`).join("\n");
        filename = `nightmare-ledger-${Date.now()}.csv`;
      } else if (format === "csv-transactions") {
        const rows = txnData?.transactions ?? [];
        content = "Date,Type,Amount,Status,Notes\n" +
          rows.map((r: any) => `${r.createdAt},${r.type},${r.amount},${r.status},${(r.notes ?? "").replace(/,/g, ";")}`).join("\n");
        filename = `nightmare-transactions-${Date.now()}.csv`;
      } else {
        content = JSON.stringify(report, null, 2);
        filename = `nightmare-statement-${Date.now()}.json`;
      }
      const blob = new Blob([content], { type: format === "json-full" ? "application/json" : "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const downloadPdf = () => {
    const w = window.open("", "_blank");
    if (!w) return toast.error("Pop-up blocked");
    const s = report.summary;
    const m = report.metrics;
    w.document.write(`<html><head><title>Nightmare Invest — Statement</title>
      <style>body{font-family:Inter,Helvetica,Arial,sans-serif;background:#0a0a0b;color:#f5f5f4;margin:0;padding:48px}
      h1{color:#d4af37;letter-spacing:.1em;font-size:14px;text-transform:uppercase;margin:0 0 4px}
      h2{font-size:24px;margin:0 0 24px}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #222;font-size:13px}
      th{color:#9a9a9a;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
      .k{color:#9a9a9a}.v{color:#f5f5f4;font-weight:600}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin:24px 0}
      .card{background:#141416;border:1px solid #222;border-radius:8px;padding:16px}
      .label{color:#9a9a9a;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
      .value{color:#d4af37;font-size:22px;font-weight:700;margin-top:4px}
      header{display:flex;justify-content:space-between;border-bottom:1px solid #222;padding-bottom:16px;margin-bottom:24px}</style></head><body>
      <header><div><h1>Nightmare Invest</h1><h2>Portfolio Statement</h2></div>
      <div style="text-align:right"><div class="label">Generated</div><div>${fmtDateTime(report.generatedAt)}</div></div></header>
      <div class="grid">
        <div class="card"><div class="label">Investor</div><div class="value" style="font-size:16px">${report.investor.name}</div><div class="k">${report.investor.email}</div></div>
        <div class="card"><div class="label">Member Since</div><div class="value" style="font-size:16px">${fmtDate(report.investor.since)}</div></div>
        <div class="card"><div class="label">Portfolio Value</div><div class="value">${fmtUSD(s.currentValue)}</div></div>
        <div class="card"><div class="label">Invested Capital</div><div class="value">${fmtUSD(s.investedCapital)}</div></div>
        <div class="card"><div class="label">Unrealized P&L</div><div class="value" style="color:${s.unrealizedPnl >= 0 ? "#00c896" : "#ff4d4f"}">${fmtUSD(s.unrealizedPnl)} (${fmtPct(s.roi)})</div></div>
        <div class="card"><div class="label">Fund NAV</div><div class="value">${fmtUSD(m.nav, { decimals: 4 })}</div></div>
        <div class="card"><div class="label">Annual Return</div><div class="value">${fmtPct(m.annualReturn)}</div></div>
        <div class="card"><div class="label">Sharpe Ratio</div><div class="value">${m.sharpe.toFixed(2)}</div></div>
      </div>
      <h3 style="color:#d4af37;margin-top:32px">Allocations</h3><table><thead><tr><th>Asset</th><th>Weight</th></tr></thead><tbody>
      ${report.allocations.map((a: any) => `<tr><td>${a.asset}</td><td>${a.weight}%</td></tr>`).join("")}</tbody></table>
      <h3 style="color:#d4af37;margin-top:32px">Recent Transactions</h3><table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead><tbody>
      ${(txnData?.transactions ?? []).slice(0, 10).map((t: any) => `<tr><td>${fmtDate(t.createdAt)}</td><td>${t.type}</td><td>${fmtUSD(t.amount)}</td><td>${t.status}</td></tr>`).join("")}</tbody></table>
      <p style="color:#7a7a7a;font-size:11px;margin-top:48px;border-top:1px solid #222;padding-top:16px">This statement is generated by the Nightmare Invest portal and is for informational purposes only. It does not constitute investment advice.</p>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  /* ---- Visual summary data ---- */
  const documentCount = reportHistory.length + (report?.ledger?.length ?? 0);
  const ytdPerformance = report?.metrics?.annualReturn ?? 0;

  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      {/* ---- Page Header ---- */}
      <FadeIn>
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
          <h1 className="h2-responsive mt-1 font-bold tracking-tight">Reports &amp; Statements</h1>
          <p className="text-sm text-muted-foreground">Download portfolio statements and transaction records</p>
        </div>
      </FadeIn>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  VISUAL SUMMARY CARDS (NEW)                                       */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      <FadeIn delay={0.03}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricTile
            label="YTD Performance"
            value={fmtPct(ytdPerformance)}
            sub="Year-to-date return"
            icon={<TrendingUp className="h-4 w-4" />}
            accent={ytdPerformance >= 0 ? "profit" : "loss"}
            sparkline={ytdSparkline}
          />
          <MetricTile
            label="Total Contributions"
            value={fmtUSD(report?.summary?.investedCapital ?? 0)}
            sub="Lifetime deposits"
            icon={<BarChart3 className="h-4 w-4" />}
            accent="gold"
            sparkline={contributionSparkline}
          />
          <MetricTile
            label="Tax Liability Est."
            value={taxData ? fmtUSD(taxData.estimatedTaxLiability) : "—"}
            sub="Estimated federal tax"
            icon={<Calculator className="h-4 w-4" />}
            accent={taxData ? "loss" : "neutral"}
          />
          <MetricTile
            label="Document Count"
            value={`${documentCount}`}
            sub="Reports & statements"
            icon={<FolderOpen className="h-4 w-4" />}
            accent="gold"
          />
        </div>
      </FadeIn>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  REPORT BUILDER (NEW)                                             */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      <FadeIn delay={0.06}>
        <GlassCard gold glow className="p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2 mb-4 sm:mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-gold/30 bg-gold/10 shrink-0">
              <Zap className="h-4 w-4 text-gold" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground">Report Builder</h3>
              <p className="text-[11px] text-muted-foreground">Generate custom reports on demand</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
            {/* Left: Report type selector */}
            <div className="lg:col-span-2 space-y-4">
              {/* Type buttons */}
              <div>
                <Label className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50 mb-2 block">
                  Report Type
                </Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {REPORT_TYPES.map((rt) => {
                    const RtIcon = rt.icon;
                    return (
                      <button
                        key={rt.value}
                        onClick={() => setSelectedReportType(rt.value)}
                        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 ${
                          selectedReportType === rt.value
                            ? "border-gold/40 bg-gold/10 shadow-[0_0_16px_rgba(212,175,55,0.12)]"
                            : "border-border/40 bg-white/[0.02] hover:bg-white/[0.04] hover:border-gold/20"
                        }`}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                          selectedReportType === rt.value
                            ? "border-gold/30 bg-gold/15"
                            : "border-border/40 bg-black/20"
                        }`}>
                          <RtIcon className={`h-4 w-4 ${selectedReportType === rt.value ? "text-gold" : "text-muted-foreground"}`} />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-sm font-medium ${selectedReportType === rt.value ? "text-gold" : "text-foreground"}`}>
                            {rt.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">{rt.desc}</div>
                        </div>
                        {selectedReportType === rt.value && (
                          <motion.div
                            layoutId="report-type-indicator"
                            className="ml-auto h-2 w-2 rounded-full bg-gold shrink-0"
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date range */}
              <div>
                <Label className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50 mb-2 block">
                  Date Range
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="tap-target w-full rounded-lg border border-border/60 bg-black/30 pl-9 pr-3 py-2 text-sm text-foreground focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/20"
                    />
                  </div>
                  <span className="text-muted-foreground text-xs text-center shrink-0 sm:hidden">to</span>
                  <span className="text-muted-foreground text-xs hidden sm:block shrink-0">to</span>
                  <div className="relative flex-1">
                    <Calendar className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="tap-target w-full rounded-lg border border-border/60 bg-black/30 pl-9 pr-3 py-2 text-sm text-foreground focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/20"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Preview + Generate */}
            <div className="flex flex-col gap-4">
              {/* Preview card */}
              <GlassCard className="p-3 sm:p-4 flex-1">
                <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/40 mb-3">Preview</div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">Type</span>
                    <span className="text-gold font-medium text-right">{REPORT_TYPES.find(r => r.value === selectedReportType)?.label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground shrink-0">Period</span>
                    <span className="text-foreground/80 font-medium text-right break-words-mobile">{dateFrom} → {dateTo}</span>
                  </div>
                  <Separator className="bg-border/40" />
                  <div className="text-[11px] text-muted-foreground leading-relaxed break-words-mobile">
                    {selectedReportType === "monthly" && "Includes: NAV summary, holdings breakdown, monthly performance, and transaction ledger."}
                    {selectedReportType === "quarterly" && "Includes: Attribution analysis, risk metrics, sector allocation, and benchmark comparison."}
                    {selectedReportType === "tax" && "Includes: Realized gains/losses, tax lot detail, cost basis analysis, and estimated liability."}
                    {selectedReportType === "custom" && "Includes: Select your preferred metrics and time range for a tailored analysis report."}
                  </div>
                </div>
              </GlassCard>

              {/* Generate button */}
              <Button
                onClick={handleGenerateReport}
                disabled={generating}
                className="tap-target btn-full-mobile bg-gold-gradient text-black hover:opacity-90 press-scale gap-2 h-11 text-sm font-semibold"
              >
                {generating ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Download className="h-4 w-4" />
                    </motion.div>
                    Generating…
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  QUICK EXPORT BUTTONS                                              */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      <FadeIn delay={0.09}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          <GlassCard hover glowOnHover className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
            </div>
            <h3 className="mt-3 text-base font-semibold text-foreground">Portfolio to CSV</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">Export complete portfolio with holdings and allocations</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadStatement("csv-ledger")}
              disabled={downloading}
              className="tap-target-sm mt-4 btn-full-mobile border-gold/30 text-gold hover:bg-gold/10 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </GlassCard>

          <GlassCard hover glowOnHover className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
                <ArrowUpDown className="h-5 w-5" />
              </div>
            </div>
            <h3 className="mt-3 text-base font-semibold text-foreground">Transactions to CSV</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">All deposit and withdrawal history with status</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadStatement("csv-transactions")}
              disabled={downloading}
              className="tap-target-sm mt-4 btn-full-mobile border-gold/30 text-gold hover:bg-gold/10 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </GlassCard>

          <GlassCard hover glowOnHover className="p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
                <FileText className="h-5 w-5" />
              </div>
            </div>
            <h3 className="mt-3 text-base font-semibold text-foreground">Export Tax Summary</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">Capital gains and tax lot analysis for filing</p>
            <Button
              size="sm"
              variant="outline"
              onClick={exportTaxReport}
              disabled={downloading || !taxData}
              className="tap-target-sm mt-4 btn-full-mobile border-gold/30 text-gold hover:bg-gold/10 gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </GlassCard>
        </div>
      </FadeIn>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  STATEMENT SUMMARY                                                 */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      <FadeIn delay={0.12}>
        <GlassCard className="p-3 sm:p-4 lg:p-5">
          <SectionTitle title="Statement Summary" subtitle={`As of ${fmtDateTime(report.generatedAt)}`} />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat label="Portfolio Value" value={fmtUSD(report.summary.currentValue)} accent="gold" />
            <Stat label="Invested Capital" value={fmtUSD(report.summary.investedCapital)} />
            <Stat label="Unrealized P&L" value={fmtUSD(report.summary.unrealizedPnl)} accent={report.summary.unrealizedPnl >= 0 ? "profit" : "loss"} />
            <Stat label="ROI" value={fmtPct(report.summary.roi)} accent={report.summary.roi >= 0 ? "profit" : "loss"} />
            <Stat label="Fund NAV" value={fmtUSD(report.metrics.nav, { decimals: 4 })} />
            <Stat label="Annual Return" value={fmtPct(report.metrics.annualReturn)} />
            <Stat label="Sharpe Ratio" value={report.metrics.sharpe.toFixed(2)} />
            <Stat label="Max Drawdown" value={fmtPct(report.metrics.maxDrawdown)} accent="loss" />
          </div>
        </GlassCard>
      </FadeIn>

      <FadeIn delay={0.15}>
        <GlassCard className="p-3 sm:p-4 lg:p-5">
          <SectionTitle title="Fund Information" />
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label="Fund Name" value={report.fund.name} />
            <Info label="Fee Structure" value={report.fund.feeStructure} />
            <Info label="Minimum Investment" value={fmtUSD(report.fund.minInvest)} />
            <Info label="Investor Since" value={fmtDate(report.investor.since)} />
          </dl>
        </GlassCard>
      </FadeIn>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  REPORT HISTORY (ENHANCED)                                        */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      <FadeIn delay={0.18}>
        <GlassCard className="p-3 sm:p-4 lg:p-5">
          <SectionTitle
            title="Report History"
            subtitle="Previously generated reports and statements"
          />
          <div className="mt-4">
            {/* Table header */}
            <div className="hidden gap-3 sm:grid sm:grid-cols-6 text-[10px] font-medium uppercase tracking-wider text-foreground/40 py-2">
              <div className="col-span-2">Report</div>
              <div>Type</div>
              <div>Size</div>
              <div>Date</div>
              <div className="text-right">Actions</div>
            </div>

            {/* Table rows */}
            <div className="space-y-2">
              {reportHistory.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.04 }}
                  className="grid gap-3 rounded-lg border border-border/30 bg-white/[0.02] p-3 transition-all hover:bg-white/[0.04] hover:border-gold/20 hover:shadow-[0_0_12px_rgba(212,175,55,0.06)] sm:grid-cols-6 sm:items-center"
                >
                  <div className="col-span-2 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gold/20 bg-gold/5">
                      <FileText className="h-4 w-4 text-gold" />
                    </div>
                    <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
                  </div>
                  <div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      item.type === "monthly" ? "border-gold/30 bg-gold/10 text-gold"
                      : item.type === "quarterly" ? "border-profit/30 bg-profit/10 text-profit"
                      : item.type === "tax" ? "border-warning/30 bg-warning/10 text-warning"
                      : "border-info/30 bg-info/10 text-info"
                    }`}>
                      {item.type}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{item.size}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(item.date)}</div>
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-gold"
                      onClick={() => toast.info("Preview opens in a new tab")}
                      title="Preview"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-gold"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://nightmare.invest/reports/${item.id}`);
                        toast.success("Link copied to clipboard");
                      }}
                      title="Share"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-gold"
                      onClick={() => toast.info("Downloading…")}
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/*  TAX REPORTING SECTION                                            */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      <FadeIn delay={0.21}>
        <GlassCard className="p-3 sm:p-4 lg:p-5" glow>
          <SectionTitle
            title="Tax Reporting"
            subtitle="Capital gains analysis and tax lot tracking"
            action={
              <button
                onClick={exportTaxReport}
                disabled={downloading || !taxData}
                className="tap-target inline-flex items-center gap-2 rounded-lg bg-gold-gradient px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground shadow-lg shadow-gold/20 transition-all duration-200 hover:shadow-gold/30 hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                <span className="hide-mobile">Export Tax Report</span>
                <span className="show-mobile">Export</span>
              </button>
            }
          />

          {taxData ? (
            <>
              {/* Tax Summary Cards */}
              <div className="mt-4 sm:mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.05 }}
                  className="rounded-xl border border-gold/25 bg-gold/[0.06] p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/10">
                      <Receipt className="h-3.5 w-3.5 text-gold" />
                    </span>
                    <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                      Net Realized Gains YTD
                    </span>
                  </div>
                  <div className={`mt-2 font-metric text-xl font-bold ${taxData.netRealizedGains >= 0 ? "text-profit" : "text-loss"}`}>
                    {fmtUSD(taxData.netRealizedGains)}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                  className="rounded-xl border border-warning/20 bg-warning/[0.04] p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10">
                      <TrendingUp className="h-3.5 w-3.5 text-warning" />
                    </span>
                    <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                      Short-Term Gains
                    </span>
                  </div>
                  <div className="mt-2 font-metric text-xl font-bold text-warning">
                    {fmtUSD(taxData.shortTermGainsTotal)}
                  </div>
                  <div className="mt-1 text-[10px] text-foreground/40">Taxed at 37%</div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                  className="rounded-xl border border-profit/20 bg-profit/[0.04] p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-profit/10">
                      <TrendingDown className="h-3.5 w-3.5 text-profit" />
                    </span>
                    <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                      Long-Term Gains
                    </span>
                  </div>
                  <div className="mt-2 font-metric text-xl font-bold text-profit">
                    {fmtUSD(taxData.longTermGainsTotal)}
                  </div>
                  <div className="mt-1 text-[10px] text-foreground/40">Taxed at 20%</div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="rounded-xl border border-loss/20 bg-loss/[0.04] p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-loss/10">
                      <Calculator className="h-3.5 w-3.5 text-loss" />
                    </span>
                    <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                      Est. Tax Liability
                    </span>
                  </div>
                  <div className="mt-2 font-metric text-xl font-bold text-loss">
                    {fmtUSD(taxData.estimatedTaxLiability)}
                  </div>
                </motion.div>
              </div>

              {/* Cost Basis Method Selector */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                  Cost Basis Method:
                </span>
                <div className="flex gap-1 rounded-lg bg-white/[0.04] p-1">
                  {(["FIFO", "LIFO"] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setCostBasisMethod(method)}
                      className={`tap-target-sm rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 ${
                        costBasisMethod === method
                          ? "bg-gold/20 text-gold shadow-sm"
                          : "text-muted-foreground hover:text-foreground/80"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gain/Loss Summary Chart */}
              <div className="mt-5">
                <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-foreground/50">
                  Monthly Realized Gains/Losses
                </h4>
                <div className="chart-mobile mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gainsChartData} margin={{ top: 6, right: 6, left: 6, bottom: 0 }} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "#7A7A7A", fontSize: 11 }}
                        stroke="rgba(255,255,255,0.08)"
                      />
                      <YAxis
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        tick={{ fill: "#7A7A7A", fontSize: 11 }}
                        stroke="rgba(255,255,255,0.08)"
                        width={56}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(212,175,55,0.06)" }}
                        contentStyle={{
                          background: "rgba(20,20,22,0.95)",
                          border: "1px solid rgba(212,175,55,0.25)",
                          borderRadius: "10px",
                          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                        }}
                        formatter={(v: number, name: string) => [
                          fmtUSD(v),
                          name === "shortTerm" ? "Short-Term" : "Long-Term",
                        ]}
                        labelStyle={{ color: "#9a9a9a", fontSize: 12 }}
                      />
                      <Bar dataKey="shortTerm" stackId="gains" fill="#f5a623" fillOpacity={0.85} radius={[0, 0, 0, 0]} name="shortTerm" />
                      <Bar dataKey="longTerm" stackId="gains" fill="#00c896" fillOpacity={0.85} radius={[4, 4, 0, 0]} name="longTerm" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex gap-4">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-sm bg-warning" />
                    Short-Term (&lt;1yr)
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-sm bg-profit" />
                    Long-Term (&ge;1yr)
                  </span>
                </div>
              </div>

              {/* Tax Lots Table */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-foreground/50">
                    Tax Lots
                  </h4>
                  <span className="text-[10px] text-foreground/40">
                    {sortedTaxLots.length} lot{sortedTaxLots.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Table header */}
                <div className="mt-3 hidden gap-3 sm:grid sm:grid-cols-8">
                  <SortableHeader label="Purchase Date" col="date" current={taxLotSort} dir={taxLotSortDir} onSort={handleSort} />
                  <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 py-2">Units</div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 py-2">Cost/Unit</div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 py-2">Total Cost</div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 py-2">Current Value</div>
                  <SortableHeader label="Unrealized P&L" col="pnl" current={taxLotSort} dir={taxLotSortDir} onSort={handleSort} />
                  <SortableHeader label="Holding" col="holding" current={taxLotSort} dir={taxLotSortDir} onSort={handleSort} />
                  <div className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 py-2">Days</div>
                </div>

                {/* Table rows */}
                <div className="mt-1 max-h-96 space-y-2 overflow-y-auto scroll-luxury pr-1">
                  {sortedTaxLots.map((lot) => (
                    <div
                      key={lot.id}
                      className="grid gap-3 rounded-lg border border-border/30 bg-white/[0.02] p-3 transition-colors hover:bg-white/[0.04] hover:border-gold/20 hover:shadow-[0_0_8px_rgba(212,175,55,0.06)] sm:grid-cols-8 sm:items-center"
                    >
                      <div className="text-sm text-foreground/80">
                        <span className="sm:hidden text-[10px] uppercase tracking-wider text-foreground/40">Date: </span>
                        {fmtDate(lot.purchaseDate)}
                      </div>
                      <div className="font-metric text-sm text-foreground/80">
                        <span className="sm:hidden text-[10px] uppercase tracking-wider text-foreground/40">Units: </span>
                        {lot.unitsAcquired.toFixed(4)}
                      </div>
                      <div className="font-metric text-sm text-foreground/80">
                        <span className="sm:hidden text-[10px] uppercase tracking-wider text-foreground/40">Cost/Unit: </span>
                        {fmtUSD(lot.costBasisPerUnit, { decimals: 4 })}
                      </div>
                      <div className="font-metric text-sm text-foreground/80">
                        <span className="sm:hidden text-[10px] uppercase tracking-wider text-foreground/40">Total Cost: </span>
                        {fmtUSD(lot.totalCost)}
                      </div>
                      <div className="font-metric text-sm text-foreground/80">
                        <span className="sm:hidden text-[10px] uppercase tracking-wider text-foreground/40">Current: </span>
                        {fmtUSD(lot.currentValue)}
                      </div>
                      <div className={`font-metric text-sm font-semibold ${lot.unrealizedPnl >= 0 ? "text-profit" : "text-loss"}`}>
                        <span className="sm:hidden text-[10px] uppercase tracking-wider text-foreground/40">P&L: </span>
                        {fmtUSD(lot.unrealizedPnl)}
                      </div>
                      <div>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            lot.holdingPeriod === "Long"
                              ? "border-profit/30 bg-profit/10 text-profit"
                              : "border-warning/30 bg-warning/10 text-warning"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              lot.holdingPeriod === "Long" ? "bg-profit" : "bg-warning"
                            }`}
                          />
                          {lot.holdingPeriod}
                        </span>
                      </div>
                      <div className="font-metric text-sm text-foreground/60">
                        <span className="sm:hidden text-[10px] uppercase tracking-wider text-foreground/40">Days: </span>
                        {lot.daysHeld}d
                      </div>
                    </div>
                  ))}

                  {sortedTaxLots.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
                      <Receipt className="mb-2 h-8 w-8 text-gold/20" />
                      No tax lots found
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-5 flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
              <Calculator className="mb-2 h-8 w-8 text-gold/20" />
              Tax data will appear when portfolio data is available
            </div>
          )}
        </GlassCard>
      </FadeIn>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sortable column header                                             */
/* ------------------------------------------------------------------ */
function SortableHeader({
  label,
  col,
  current,
  dir,
  onSort,
}: {
  label: string;
  col: "date" | "pnl" | "holding";
  current: string;
  dir: "asc" | "desc";
  onSort: (col: "date" | "pnl" | "holding") => void;
}) {
  const isActive = current === col;
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-1 py-2 text-left text-[10px] font-medium uppercase tracking-wider transition-colors ${
        isActive ? "text-gold" : "text-foreground/40 hover:text-foreground/60"
      }`}
    >
      {label}
      <ArrowUpDown className={`h-2.5 w-2.5 ${isActive ? "opacity-100" : "opacity-30"}`} />
      {isActive && (
        <span className="text-[8px]">{dir === "asc" ? "↑" : "↓"}</span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "gold" | "profit" | "loss" }) {
  const color = accent === "gold" ? "text-gold" : accent === "profit" ? "text-profit" : accent === "loss" ? "text-loss" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-black/20 p-4 hover-lift transition-all hover:border-gold/15 hover:shadow-[0_0_8px_rgba(212,175,55,0.06)]">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-metric text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-black/20 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
