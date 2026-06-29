"use client";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, StatusPill, TypePill, FadeIn, SkeletonTable, SkeletonMetric, EmptyState } from "@/components/brand/primitives";
import { TwoFactorModal } from "@/components/brand/two-factor-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { fmtUSD, fmtDate } from "@/lib/format";
import { motion } from "framer-motion";
import {
  ArrowDownToLine, ArrowUpFromLine, Plus, Info, Search, Filter,
  Download, CheckCircle2, XCircle, Clock, FileDown, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Animated Status Badge                                              */
/* ------------------------------------------------------------------ */

function AnimatedStatusBadge({ status }: { status: string }) {
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-[11px] font-semibold text-warning status-badge-animated">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    );
  }
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-profit/30 bg-profit/10 px-2.5 py-0.5 text-[11px] font-semibold text-profit">
        <CheckCircle2 className="h-3 w-3" />
        Approved
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-loss/30 bg-loss/10 px-2.5 py-0.5 text-[11px] font-semibold text-loss">
        <XCircle className="h-3 w-3" />
        Rejected
      </span>
    );
  }
  return <StatusPill status={status} />;
}

/* ------------------------------------------------------------------ */
/*  High-Value Threshold for 2FA                                       */
/* ------------------------------------------------------------------ */
const HIGH_VALUE_THRESHOLD = 50000;

/* ------------------------------------------------------------------ */
/*  Main Transactions Page                                             */
/* ------------------------------------------------------------------ */

export function TransactionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState<null | "DEPOSIT" | "WITHDRAWAL">(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "DEPOSIT" | "WITHDRAWAL">("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");

  // 2FA verification state
  const [show2FA, setShow2FA] = useState(false);
  const [pending2FAAction, setPending2FAAction] = useState<null | "DEPOSIT" | "WITHDRAWAL">(null);

  const { data: portfolio } = useQuery<any>({ queryKey: ["portfolio"], queryFn: () => api.get("/api/portfolio") });
  const { data: userData } = useQuery<any>({ queryKey: ["auth-me"], queryFn: () => api.get("/api/auth/me") });
  const { data, isLoading } = useQuery<any>({ queryKey: ["my-transactions"], queryFn: () => api.get("/api/transactions") });

  const userHas2FA = userData?.user?.totpEnabled ?? false;

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

  // Handle open dialog — check for 2FA requirement on high-value operations
  const handleOpenDialog = (type: "DEPOSIT" | "WITHDRAWAL") => {
    setOpen(type);
    // We don't check 2FA here because amount hasn't been entered yet.
    // The 2FA check happens on submit.
  };

  // Enhanced submit with 2FA check
  const handleSubmitWith2FA = () => {
    if (!open) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");

    // Check if 2FA is required for high-value operations
    if (amt >= HIGH_VALUE_THRESHOLD) {
      // Need 2FA verification
      setPending2FAAction(open);
      setShow2FA(true);
      return;
    }

    // No 2FA needed, proceed directly
    submit();
  };

  // After 2FA is verified, proceed with the transaction
  const handle2FAVerified = () => {
    setShow2FA(false);
    setPending2FAAction(null);
    // Proceed with the actual submission
    submit();
  };

  const allTxns = data?.transactions ?? [];
  const pending = allTxns.filter((t: any) => t.status === "PENDING");
  const approved = allTxns.filter((t: any) => t.status === "APPROVED");
  const totalDeposited = approved.filter((t: any) => t.type === "DEPOSIT").reduce((a: number, b: any) => a + b.amount, 0);
  const totalWithdrawn = approved.filter((t: any) => t.type === "WITHDRAWAL").reduce((a: number, b: any) => a + b.amount, 0);

  // Filtered transactions
  const txns = useMemo(() => {
    let filtered = allTxns;
    if (filterType !== "ALL") filtered = filtered.filter((t: any) => t.type === filterType);
    if (filterStatus !== "ALL") filtered = filtered.filter((t: any) => t.status === filterStatus);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((t: any) =>
        t.type.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q) ||
        String(t.amount).includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [allTxns, filterType, filterStatus, searchQuery]);

  // Export CSV handler
  const exportCSV = () => {
    const headers = ["Type", "Amount", "Status", "Date", "Processed By", "Notes"];
    const rows = txns.map((t: any) => [
      t.type,
      t.amount,
      t.status,
      fmtDate(t.createdAt, true),
      t.processor?.name ?? "—",
      t.notes ?? "—",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully");
  };

  const currentAmount = parseFloat(amount) || 0;
  const isHighValue = currentAmount >= HIGH_VALUE_THRESHOLD;

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
              <Button onClick={() => handleOpenDialog("DEPOSIT")} className="bg-gold-gradient text-black hover:opacity-90 press-scale">
                <ArrowDownToLine className="mr-1.5 h-4 w-4" /> Deposit
              </Button>
              <Button onClick={() => handleOpenDialog("WITHDRAWAL")} variant="outline" className="border-gold/30 hover:bg-gold/10 press-scale">
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
          <GlassCard className="border-gold/30 p-4 hover-lift gold-glow-hover">
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
          <GlassCard className="p-4 hover-lift gold-glow-hover">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Deposited</div>
            <div className="mt-1 font-metric text-2xl font-bold text-profit">{fmtUSD(totalDeposited)}</div>
          </GlassCard>
          <GlassCard className="p-4 hover-lift gold-glow-hover">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Withdrawn</div>
            <div className="mt-1 font-metric text-2xl font-bold text-info">{fmtUSD(totalWithdrawn)}</div>
          </GlassCard>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <GlassCard className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <SectionTitle title="Request History" subtitle="All deposit and withdrawal requests" className="mb-0" />
            <div className="flex items-center gap-2">
              {/* Export CSV Button */}
              {txns.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCSV}
                  className="border-gold/30 bg-gold-gradient text-black hover:opacity-90 press-scale gap-1.5 font-semibold shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                >
                  <FileDown className="h-3.5 w-3.5" /> Export CSV
                </Button>
              )}
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-border/60 bg-black/30 pl-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="flex rounded-lg border border-border/60 bg-black/30 p-0.5">
                {(["ALL", "DEPOSIT", "WITHDRAWAL"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      filterType === t ? "bg-gold-gradient text-black" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "ALL" ? "All Types" : t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg border border-border/60 bg-black/30 p-0.5">
                {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      filterStatus === s ? "bg-gold-gradient text-black" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

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
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.25 }}
                    className={`investor-row-hover border-b border-border/40 last:border-0 ${idx % 2 === 0 ? "bg-white/[0.01]" : ""}`}
                  >
                    <td className="py-3 pr-4"><TypePill type={t.type} /></td>
                    <td className="py-3 pr-4 font-metric font-semibold">{fmtUSD(t.amount)}</td>
                    <td className="py-3 pr-4"><AnimatedStatusBadge status={t.status} /></td>
                    <td className="py-3 pr-4 text-muted-foreground">{fmtDate(t.createdAt, true)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{t.processor?.name ?? "—"}</td>
                    <td className="py-3 max-w-xs truncate text-muted-foreground" title={t.notes ?? ""}>{t.notes ?? "—"}</td>
                  </motion.tr>
                ))}
                {txns.length === 0 && allTxns.length > 0 && (
                  <tr><td colSpan={6}>
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <Search className="h-6 w-6 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No transactions match your filters</p>
                      <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setFilterType("ALL"); setFilterStatus("ALL"); }} className="text-gold">
                        Clear filters
                      </Button>
                    </div>
                  </td></tr>
                )}
                {allTxns.length === 0 && (
                  <tr><td colSpan={6}>
                    <EmptyState
                      icon={<ArrowDownToLine className="h-7 w-7" />}
                      title="Begin Your Investment Journey"
                      description="Submit your first deposit request to allocate capital into the Nightmare Alpha Crypto Fund."
                      action={
                        <Button onClick={() => handleOpenDialog("DEPOSIT")} className="bg-gold-gradient text-black hover:opacity-90 press-scale">
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

            {/* 2FA Required Notice for high-value operations */}
            {isHighValue && (
              <div className="flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/5 px-3 py-2.5 text-xs">
                <ShieldCheck className="h-4 w-4 shrink-0 text-gold" />
                <span className="text-foreground/90">
                  {userHas2FA
                    ? "2FA verification will be required for this high-value transaction."
                    : "2FA must be enabled to submit transactions over $50,000. Enable it in your account settings."}
                </span>
              </div>
            )}

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
            <Button onClick={handleSubmitWith2FA} disabled={submitting} className="bg-gold-gradient text-black hover:opacity-90 press-scale">
              {submitting ? "Submitting…" : isHighValue ? "Submit with 2FA" : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Verification Modal */}
      <TwoFactorModal
        open={show2FA}
        onClose={() => { setShow2FA(false); setPending2FAAction(null); }}
        onVerified={handle2FAVerified}
        userHas2FA={userHas2FA}
        purpose={`Verify to proceed with ${pending2FAAction?.toLowerCase() ?? "transaction"} of ${fmtUSD(currentAmount)}`}
      />
    </div>
  );
}
