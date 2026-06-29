"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, StatusPill, TypePill, FadeIn } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { fmtUSD, fmtPct, fmtDate, fmtDateTime } from "@/lib/format";
import { FileText, Download, FileSpreadsheet, TrendingUp, Calendar } from "lucide-react";
import { toast } from "sonner";

export function ReportsPage() {
  const { data: report } = useQuery<any>({ queryKey: ["report"], queryFn: () => api.get("/api/reports") });
  const { data: txnData } = useQuery<any>({ queryKey: ["my-transactions"], queryFn: () => api.get("/api/transactions") });
  const [downloading, setDownloading] = useState(false);

  if (!report) return <div className="h-80 rounded-xl glass shimmer" />;

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
    // Open a printable statement in a new window
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

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Reports &amp; Statements</h1>
          <p className="text-sm text-muted-foreground">Download portfolio statements and transaction records</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ReportCard
            icon={<FileText className="h-5 w-5" />}
            title="Portfolio Statement"
            desc="Complete statement with holdings, performance, and analytics"
            actions={
              <Button size="sm" onClick={downloadPdf} disabled={downloading} className="bg-gold-gradient text-black hover:opacity-90">
                <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
              </Button>
            }
          />
          <ReportCard
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title="Ledger Export"
            desc="Full ledger entries with running balance (CSV)"
            actions={
              <Button size="sm" variant="outline" onClick={() => downloadStatement("csv-ledger")} className="border-gold/30 hover:bg-gold/10">
                <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
              </Button>
            }
          />
          <ReportCard
            icon={<TrendingUp className="h-5 w-5" />}
            title="Transaction History"
            desc="All deposit and withdrawal requests (CSV)"
            actions={
              <Button size="sm" variant="outline" onClick={() => downloadStatement("csv-transactions")} className="border-gold/30 hover:bg-gold/10">
                <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
              </Button>
            }
          />
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <GlassCard className="p-5">
          <SectionTitle title="Statement Summary" subtitle={`As of ${fmtDateTime(report.generatedAt)}`} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <GlassCard className="p-5">
          <SectionTitle title="Fund Information" />
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label="Fund Name" value={report.fund.name} />
            <Info label="Fee Structure" value={report.fund.feeStructure} />
            <Info label="Minimum Investment" value={fmtUSD(report.fund.minInvest)} />
            <Info label="Investor Since" value={fmtDate(report.investor.since)} />
          </dl>
        </GlassCard>
      </FadeIn>
    </div>
  );
}

function ReportCard({ icon, title, desc, actions }: { icon: React.ReactNode; title: string; desc: string; actions: React.ReactNode }) {
  return (
    <GlassCard hover className="flex flex-col p-5">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">{icon}</div>
      </div>
      <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-4">{actions}</div>
    </GlassCard>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "gold" | "profit" | "loss" }) {
  const color = accent === "gold" ? "text-gold" : accent === "profit" ? "text-profit" : accent === "loss" ? "text-loss" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/60 bg-black/20 p-4">
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
