"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, FadeIn, SkeletonTable, SkeletonMetric, EmptyState } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtUSD, fmtDateTime } from "@/lib/format";
import { ScrollText, Download, Search } from "lucide-react";
import { toast } from "sonner";

export function AdminLedger() {
  const [userId, setUserId] = useState("");
  const { data } = useQuery<any>({
    queryKey: ["admin-ledger", userId],
    queryFn: () => api.get(`/api/admin/ledger${userId ? `?userId=${userId}` : ""}`),
  });

  const entries = data?.entries ?? [];

  const exportCsv = () => {
    const csv = "Date,Investor,Email,Account,Type,Amount,Balance After,Reference\n" +
      entries.map((e: any) => `${e.createdAt},${e.user?.name ?? ""},${e.user?.email ?? ""},${e.accountId},${e.type},${e.amount},${e.balanceAfter},${e.reference ?? ""}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `nightmare-ledger-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Ledger exported");
  };

  const totalIn = entries.filter((e: any) => e.amount > 0).reduce((a: number, b: any) => a + b.amount, 0);
  const totalOut = entries.filter((e: any) => e.amount < 0).reduce((a: number, b: any) => a + b.amount, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
            <h1 className="h2-responsive mt-1 font-bold tracking-tight">Ledger</h1>
            <p className="body-responsive text-muted-foreground">Immutable financial transaction ledger</p>
          </div>
          <Button onClick={exportCsv} variant="outline" className="tap-target-sm border-gold/30 hover:bg-gold/10">
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          <GlassCard className="card-p sm:p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Entries</div>
            <div className="mt-1 font-metric text-2xl font-bold text-foreground">{entries.length}</div>
          </GlassCard>
          <GlassCard className="card-p sm:p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Deposited</div>
            <div className="mt-1 font-metric text-2xl font-bold text-profit">{fmtUSD(totalIn, { compact: true })}</div>
          </GlassCard>
          <GlassCard className="card-p sm:p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Withdrawn</div>
            <div className="mt-1 font-metric text-2xl font-bold text-info">{fmtUSD(Math.abs(totalOut), { compact: true })}</div>
          </GlassCard>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <GlassCard className="p-3 sm:p-4 lg:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle title="Ledger Entries" subtitle={`${entries.length} records`} />
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Filter by user ID…" className="tap-target-sm border-border/60 bg-black/30 pl-9" />
            </div>
          </div>
          <div className="mt-4 max-h-[28rem] overflow-y-auto scroll-luxury">
            <div className="table-mobile-card overflow-x-auto scroll-x-allowed lg:overflow-visible">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card/95 backdrop-blur">
                  <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Timestamp</th>
                    <th className="pb-2 pr-4 font-medium">Investor</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium text-right">Amount</th>
                    <th className="pb-2 pr-4 font-medium text-right">Balance After</th>
                    <th className="pb-2 font-medium">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e: any) => (
                    <tr key={e.id} className="border-b border-border/40 last:border-0 hover:bg-gold/5">
                      <td data-label="Timestamp" className="py-2.5 pr-4 text-muted-foreground">{fmtDateTime(e.createdAt)}</td>
                      <td data-label="Investor" className="py-2.5 pr-4">
                        <div className="font-medium text-foreground break-words-mobile">{e.user?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground break-words-mobile">{e.user?.email ?? ""}</div>
                      </td>
                      <td data-label="Type" className="py-2.5 pr-4">
                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${e.type === "DEPOSIT" ? "border-profit/30 bg-profit/10 text-profit" : "border-info/30 bg-info/10 text-info"}`}>
                          {e.type}
                        </span>
                      </td>
                      <td data-label="Amount" className={`py-2.5 pr-4 text-right font-metric font-semibold ${e.amount >= 0 ? "text-profit" : "text-info"}`}>
                        {e.amount >= 0 ? "+" : ""}{fmtUSD(e.amount)}
                      </td>
                      <td data-label="Balance" className="py-2.5 pr-4 text-right font-metric text-foreground">{fmtUSD(e.balanceAfter)}</td>
                      <td data-label="Reference" className="py-2.5 max-w-[160px] truncate text-xs text-muted-foreground" title={e.reference ?? ""}>{e.reference ?? "—"}</td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr><td colSpan={6}>
                      <EmptyState
                        icon={<ScrollText className="h-7 w-7" />}
                        title="No ledger entries"
                        description="No financial transactions have been recorded yet."
                      />
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </GlassCard>
      </FadeIn>
    </div>
  );
}
