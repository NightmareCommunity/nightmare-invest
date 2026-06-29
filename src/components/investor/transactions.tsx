"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, StatusPill, TypePill, FadeIn, SkeletonTable, SkeletonMetric, EmptyState } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { fmtUSD, fmtDate } from "@/lib/format";
import { ArrowDownToLine, ArrowUpFromLine, Plus, Info } from "lucide-react";
import { toast } from "sonner";

export function TransactionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<null | "DEPOSIT" | "WITHDRAWAL">(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: portfolio } = useQuery<any>({ queryKey: ["portfolio"], queryFn: () => api.get("/api/portfolio") });
  const { data, isLoading } = useQuery<any>({ queryKey: ["my-transactions"], queryFn: () => api.get("/api/transactions") });

  const submit = async () => {
    if (!open) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setSubmitting(true);
    try {
      await api.post("/api/transactions", {
        type: open,
        amount: amt,
        fundId: portfolio.fund.id,
        notes: notes || undefined,
      });
      toast.success(`${open === "DEPOSIT" ? "Deposit" : "Withdrawal"} request submitted for review`);
      setOpen(null);
      setAmount("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["my-transactions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const txns = data?.transactions ?? [];
  const pending = txns.filter((t: any) => t.status === "PENDING");
  const approved = txns.filter((t: any) => t.status === "APPROVED");
  const totalDeposited = approved.filter((t: any) => t.type === "DEPOSIT").reduce((a: number, b: any) => a + b.amount, 0);
  const totalWithdrawn = approved.filter((t: any) => t.type === "WITHDRAWAL").reduce((a: number, b: any) => a + b.amount, 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <FadeIn>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Transactions</h1>
              <p className="text-sm text-muted-foreground">Submit and track capital movements</p>
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => <SkeletonMetric key={i} className="h-24" />)}
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <GlassCard className="p-5">
            <SectionTitle title="Request History" subtitle="All deposit and withdrawal requests" />
            <div className="mt-4">
              <SkeletonTable rows={5} cols={6} />
            </div>
          </GlassCard>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Transactions</h1>
            <p className="text-sm text-muted-foreground">Submit and track capital movements</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-2">
              <Button onClick={() => setOpen("DEPOSIT")} className="bg-gold-gradient text-black hover:opacity-90 press-scale">
                <ArrowDownToLine className="mr-1.5 h-4 w-4" /> Deposit
              </Button>
              <Button onClick={() => setOpen("WITHDRAWAL")} variant="outline" className="border-gold/30 hover:bg-gold/10 press-scale">
                <ArrowUpFromLine className="mr-1.5 h-4 w-4" /> Withdraw
              </Button>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="h-3 w-3 shrink-0" />
              <span>Deposits are reviewed within 24 hours. Minimum commitment $50,000.</span>
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-3">
          <GlassCard className="border-gold/30 p-4 hover-lift">
            <div className="flex items-center gap-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Pending Requests</div>
              {pending.length > 0 && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-gold" />
                </span>
              )}
            </div>
            <div className="mt-1 font-metric text-2xl font-bold text-warning">{pending.length}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Awaiting admin review</div>
          </GlassCard>
          <GlassCard className="p-4 hover-lift">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Deposited</div>
            <div className="mt-1 font-metric text-2xl font-bold text-profit">{fmtUSD(totalDeposited)}</div>
          </GlassCard>
          <GlassCard className="p-4 hover-lift">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Withdrawn</div>
            <div className="mt-1 font-metric text-2xl font-bold text-info">{fmtUSD(totalWithdrawn)}</div>
          </GlassCard>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <GlassCard className="p-5">
          <SectionTitle title="Request History" subtitle="All deposit and withdrawal requests" />
          <div className="mt-4 overflow-x-auto scroll-luxury">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Processed By</th>
                  <th className="pb-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t: any, idx: number) => (
                  <tr
                    key={t.id}
                    className={`border-b border-border/40 last:border-0 hover:bg-gold/5 row-enter ${idx % 2 === 0 ? "bg-white/[0.01]" : ""}`}
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <td className="py-3 pr-4"><TypePill type={t.type} /></td>
                    <td className="py-3 pr-4 font-metric font-semibold">{fmtUSD(t.amount)}</td>
                    <td className="py-3 pr-4"><StatusPill status={t.status} /></td>
                    <td className="py-3 pr-4 text-muted-foreground">{fmtDate(t.createdAt, true)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{t.processor?.name ?? "—"}</td>
                    <td className="py-3 max-w-xs truncate text-muted-foreground" title={t.notes ?? ""}>{t.notes ?? "—"}</td>
                  </tr>
                ))}
                {txns.length === 0 && (
                  <tr><td colSpan={6}>
                    <EmptyState
                      icon={<ArrowDownToLine className="h-7 w-7" />}
                      title="Begin Your Investment Journey"
                      description="Submit your first deposit request to allocate capital into the Nightmare Alpha Crypto Fund."
                      action={
                        <Button onClick={() => setOpen("DEPOSIT")} className="bg-gold-gradient text-black hover:opacity-90 press-scale">
                          <Plus className="mr-1.5 h-4 w-4" /> New Deposit
                        </Button>
                      }
                    />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </FadeIn>

      {/* Request modal */}
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="border-gold/20 bg-card/95 backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {open === "DEPOSIT" ? <ArrowDownToLine className="h-5 w-5 text-profit" /> : <ArrowUpFromLine className="h-5 w-5 text-info" />}
              {open === "DEPOSIT" ? "Request Deposit" : "Request Withdrawal"}
            </DialogTitle>
            <DialogDescription>
              {open === "DEPOSIT"
                ? `Minimum commitment ${portfolio ? fmtUSD(portfolio.fund.minInvest) : "$50,000"}. Your request will be reviewed by the fund administrator.`
                : `Available balance: ${portfolio ? fmtUSD(portfolio.summary.currentValue) : "—"}. Withdrawals processed during scheduled liquidity windows.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="amt" className="text-xs uppercase tracking-wider text-muted-foreground">Amount (USD)</Label>
              <Input
                id="amt"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000"
                className="border-border/60 bg-black/30 font-metric text-lg"
              />
              {open === "DEPOSIT" && portfolio && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[50000, 100000, 250000, 500000].map((v) => (
                    <button key={v} onClick={() => setAmount(String(v))} className="rounded-md border border-border/60 px-2 py-0.5 text-xs text-muted-foreground hover:border-gold/40 hover:text-gold press-scale">
                      {fmtUSD(v, { compact: true })}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Q4 capital allocation"
                className="border-border/60 bg-black/30 text-sm"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(null)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="bg-gold-gradient text-black hover:opacity-90 press-scale">
              {submitting ? "Submitting…" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
