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
  AlertTriangle, Bitcoin, Coins, Banknote,
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
/*  Deposit Method Configuration                                       */
/* ------------------------------------------------------------------ */
type DepositMethod = "UPI" | "BTC" | "LTC" | "USDT";

interface MethodMeta {
  label: string;
  prefix: string;
  placeholder: string;
  quickAmounts: number[];
  minInr?: number;
  minUsd?: number;
}

const METHOD_META: Record<DepositMethod, MethodMeta> = {
  UPI: { label: "Amount (INR ₹)", prefix: "₹", placeholder: "1000", quickAmounts: [1000, 5000, 10000, 50000], minInr: 1000 },
  BTC: { label: "Amount (BTC)", prefix: "₿", placeholder: "0.00015", quickAmounts: [0.0001, 0.0005, 0.001, 0.005], minUsd: 10 },
  LTC: { label: "Amount (LTC)", prefix: "Ł", placeholder: "0.12", quickAmounts: [0.01, 0.05, 0.1, 0.5], minUsd: 10 },
  USDT: { label: "Amount (USDT)", prefix: "₮", placeholder: "10", quickAmounts: [10, 50, 100, 500], minUsd: 10 },
};

function MethodPill({ method }: { method?: string | null }) {
  if (!method || method === "UPI") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">
        <Banknote className="h-3 w-3" /> UPI
      </span>
    );
  }
  const cls: Record<string, string> = {
    BTC: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    LTC: "border-slate-400/30 bg-slate-400/10 text-slate-300",
    USDT: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  };
  const sym: Record<string, string> = { BTC: "₿", LTC: "Ł", USDT: "₮" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${cls[method] ?? "border-border/60 bg-muted/10 text-muted-foreground"}`}>
      {method === "BTC" ? <Bitcoin className="h-3 w-3" /> : method === "LTC" ? <Coins className="h-3 w-3" /> : <span className="text-[11px] leading-none">{sym[method] ?? ""}</span>}
      {method}
    </span>
  );
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
  const [method, setMethod] = useState<DepositMethod>("UPI");

  // 2FA verification state
  const [show2FA, setShow2FA] = useState(false);
  const [pending2FAAction, setPending2FAAction] = useState<null | "DEPOSIT" | "WITHDRAWAL">(null);

  const { data: portfolio } = useQuery<any>({ queryKey: ["portfolio"], queryFn: () => api.get("/api/portfolio") });
  const { data: userData } = useQuery<any>({ queryKey: ["auth-me"], queryFn: () => api.get("/api/auth/me") });
  const { data, isLoading } = useQuery<any>({ queryKey: ["my-transactions"], queryFn: () => api.get("/api/transactions") });
  const { data: market } = useQuery<{ prices: { symbol: string; priceUsd: number }[] }>({
    queryKey: ["market-prices"],
    queryFn: () => api.get("/api/market/prices"),
  });
  const priceMap = useMemo(() => {
    const map: Record<string, number> = { USDT: 1 };
    for (const p of market?.prices ?? []) map[p.symbol] = p.priceUsd;
    return map;
  }, [market]);

  const userHas2FA = userData?.user?.totpEnabled ?? false;

  const submit = async () => {
    if (!open) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    const isCryptoDeposit = open === "DEPOSIT" && method !== "UPI";
    const cryptoPrice = isCryptoDeposit ? (priceMap[method] ?? 0) : 1;
    const usdEquivalent = isCryptoDeposit ? amt * cryptoPrice : amt;
    setSubmitting(true);
    try {
      await api.post("/api/transactions", {
        type: open,
        amount: isCryptoDeposit ? usdEquivalent : amt,
        fundId: portfolio.fund.id,
        method: open === "DEPOSIT" ? method : "UPI",
        cryptoAmount: isCryptoDeposit ? amt : undefined,
        notes: notes || undefined,
      });
      toast.success(`${open === "DEPOSIT" ? "Deposit" : "Withdrawal"} request submitted for review`);
      setOpen(null);
      setAmount("");
      setNotes("");
      setMethod("UPI");
      qc.invalidateQueries({ queryKey: ["my-transactions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle open dialog — reset method state, 2FA check happens on submit
  const handleOpenDialog = (type: "DEPOSIT" | "WITHDRAWAL") => {
    setMethod("UPI");
    setAmount("");
    setNotes("");
    setOpen(type);
  };

  // Enhanced submit with 2FA check — for crypto deposits, threshold uses USD equivalent
  const handleSubmitWith2FA = () => {
    if (!open) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");

    const isCryptoDeposit = open === "DEPOSIT" && method !== "UPI";
    const cryptoPrice = isCryptoDeposit ? (priceMap[method] ?? 0) : 1;
    const usdEquivalent = isCryptoDeposit ? amt * cryptoPrice : amt;

    // Check if 2FA is required for high-value operations
    if (usdEquivalent >= HIGH_VALUE_THRESHOLD) {
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
    const headers = ["Type", "Amount", "Method", "Crypto Amount", "Status", "Date", "Processed By", "Notes"];
    const rows = txns.map((t: any) => [
      t.type,
      t.amount,
      t.method ?? "UPI",
      t.cryptoAmount ?? "",
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
  const isCryptoDeposit = open === "DEPOSIT" && method !== "UPI";
  const cryptoPrice = isCryptoDeposit ? (priceMap[method] ?? 0) : 1;
  const usdEquivalent = isCryptoDeposit ? currentAmount * cryptoPrice : currentAmount;
  const isHighValue = usdEquivalent >= HIGH_VALUE_THRESHOLD;
  const methodMeta = METHOD_META[method];
  const minInrMet = method === "UPI" ? currentAmount >= (methodMeta.minInr ?? 1000) : true;
  const minUsdMet = method !== "UPI" ? usdEquivalent >= (methodMeta.minUsd ?? 10) : true;
  const meetsMinimum = open === "DEPOSIT" ? (minInrMet && minUsdMet && currentAmount > 0) : currentAmount > 0;

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-5 lg:space-y-6">
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
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => <SkeletonMetric key={i} className="h-24" />)}
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <GlassCard className="p-4 sm:p-5">
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
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      <FadeIn>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
            <h1 className="h2-responsive mt-1 font-bold tracking-tight">Transactions</h1>
            <p className="text-sm text-muted-foreground">Submit and track capital movements</p>
          </div>
          <div className="flex flex-col gap-1.5 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handleOpenDialog("DEPOSIT")} className="tap-target bg-gold-gradient text-black hover:opacity-90 press-scale">
                <ArrowDownToLine className="mr-1.5 h-4 w-4" /> Deposit
              </Button>
              <Button onClick={() => handleOpenDialog("WITHDRAWAL")} variant="outline" className="tap-target border-gold/30 hover:bg-gold/10 press-scale">
                <ArrowUpFromLine className="mr-1.5 h-4 w-4" /> Withdraw
              </Button>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="h-3 w-3 shrink-0" />
              <span>Deposits reviewed within 24h.</span>
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
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
        <GlassCard className="p-3 sm:p-4 lg:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <SectionTitle title="Request History" subtitle="All deposit and withdrawal requests" className="mb-0" />
            <div className="flex items-center gap-2 shrink-0">
              {/* Export CSV Button */}
              {txns.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCSV}
                  className="tap-target-sm border-gold/30 bg-gold-gradient text-black hover:opacity-90 press-scale gap-1.5 font-semibold shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                >
                  <FileDown className="h-3.5 w-3.5" /> Export CSV
                </Button>
              )}
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-border/60 bg-black/30 pl-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto scroll-row sm:overflow-visible">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex rounded-lg border border-border/60 bg-black/30 p-0.5">
                {(["ALL", "DEPOSIT", "WITHDRAWAL"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`tap-target-sm rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
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
                    className={`tap-target-sm rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      filterStatus === s ? "bg-gold-gradient text-black" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="table-mobile-card mt-4 overflow-x-auto scroll-luxury">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 pr-4 font-medium">Method</th>
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
                    <td data-label="Type" className="py-3 pr-4"><TypePill type={t.type} /></td>
                    <td data-label="Amount" className="py-3 pr-4 font-metric font-semibold">
                      <div>{fmtUSD(t.amount)}</div>
                      {t.cryptoAmount ? (
                        <div className="text-[10.5px] font-normal text-muted-foreground">
                          {t.method === "BTC" ? "₿" : t.method === "LTC" ? "Ł" : t.method === "USDT" ? "₮" : ""}
                          {t.cryptoAmount} {t.method}
                        </div>
                      ) : null}
                    </td>
                    <td data-label="Method" className="py-3 pr-4"><MethodPill method={t.method} /></td>
                    <td data-label="Status" className="py-3 pr-4"><AnimatedStatusBadge status={t.status} /></td>
                    <td data-label="Date" className="py-3 pr-4 text-muted-foreground">{fmtDate(t.createdAt, true)}</td>
                    <td data-label="Processed By" className="py-3 pr-4 text-muted-foreground">{t.processor?.name ?? "—"}</td>
                    <td data-label="Notes" className="py-3 max-w-xs truncate text-muted-foreground break-words-mobile" title={t.notes ?? ""}>{t.notes ?? "—"}</td>
                  </motion.tr>
                ))}
                {txns.length === 0 && allTxns.length > 0 && (
                  <tr><td colSpan={7}>
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <Search className="h-6 w-6 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No transactions match your filters</p>
                      <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setFilterType("ALL"); setFilterStatus("ALL"); }} className="tap-target text-gold">
                        Clear filters
                      </Button>
                    </div>
                  </td></tr>
                )}
                {allTxns.length === 0 && (
                  <tr><td colSpan={7}>
                    <EmptyState
                      icon={<ArrowDownToLine className="h-7 w-7" />}
                      title="Begin Your Investment Journey"
                      description="Submit your first deposit request to allocate capital into the Nightmare Alpha Crypto Fund."
                      action={
                        <Button onClick={() => handleOpenDialog("DEPOSIT")} className="tap-target bg-gold-gradient text-black hover:opacity-90 press-scale">
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
        <DialogContent className="max-w-[95vw] border-gold/20 bg-card/95 backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {open === "DEPOSIT" ? <ArrowDownToLine className="h-5 w-5 text-profit" /> : <ArrowUpFromLine className="h-5 w-5 text-info" />}
              {open === "DEPOSIT" ? "Request Deposit" : "Request Withdrawal"}
            </DialogTitle>
            <DialogDescription className="break-words-mobile">
              {open === "DEPOSIT"
                ? `Minimum commitment ${portfolio ? fmtUSD(portfolio.fund.minInvest) : "$50,000"}. Your request will be reviewed by the fund administrator.`
                : `Available balance: ${portfolio ? fmtUSD(portfolio.summary.currentValue) : "—"}. Withdrawals processed during scheduled liquidity windows.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Minimum deposit warning card — DEPOSITS only */}
            {open === "DEPOSIT" && (
              <div className="rounded-lg border border-gold/30 bg-gold/5 p-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gold">Minimum Deposits</div>
                    <ul className="mt-1 space-y-0.5 text-[11px] text-foreground/80 break-words-mobile">
                      <li>• INR (UPI): <span className="font-metric font-semibold text-gold">₹1000</span></li>
                      <li>• Crypto: <span className="font-metric font-semibold text-gold">$10 equivalent</span> <span className="text-muted-foreground">(BTC · LTC · USDT TRC20)</span></li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Method selector — DEPOSITS only (withdrawals stay UPI) */}
            {open === "DEPOSIT" && (
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Deposit Method</Label>
                <div className="scroll-row flex-wrap sm:flex-wrap">
                  {(Object.keys(METHOD_META) as DepositMethod[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMethod(m); setAmount(""); }}
                      className={`tap-target inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all press-scale ${
                        method === m
                          ? "border-gold/40 bg-gold/15 text-gold shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                          : "border-border/60 bg-black/20 text-muted-foreground hover:border-gold/30 hover:text-foreground"
                      }`}
                    >
                      {m === "UPI" && <Banknote className="h-3.5 w-3.5" />}
                      {m === "BTC" && <Bitcoin className="h-3.5 w-3.5" />}
                      {m === "LTC" && <Coins className="h-3.5 w-3.5" />}
                      {m === "USDT" && <span className="text-[11px] leading-none">₮</span>}
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Amount input — method-aware */}
            <div className="space-y-1.5">
              <Label htmlFor="amt" className="text-xs uppercase tracking-wider text-muted-foreground">
                {open === "DEPOSIT" ? methodMeta.label : "Amount (USD)"}
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-metric text-base sm:text-lg font-semibold text-gold/80">
                  {open === "DEPOSIT" ? methodMeta.prefix : "$"}
                </span>
                <Input
                  id="amt"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={open === "DEPOSIT" ? methodMeta.placeholder : "50000"}
                  className="tap-target border-border/60 bg-black/30 pl-8 font-metric text-base sm:text-lg"
                />
              </div>

              {/* Live USD equivalent for crypto deposits */}
              {isCryptoDeposit && currentAmount > 0 && (
                <div className="text-[11px] text-muted-foreground break-words-mobile">
                  ≈ <span className="font-metric font-semibold text-gold">{fmtUSD(usdEquivalent, { decimals: 2 })}</span> USD
                  {method !== "USDT" && (
                    <span className="ml-1.5 text-muted-foreground/70">
                      (@ {fmtUSD(cryptoPrice, { decimals: cryptoPrice >= 100 ? 0 : 2 })} / {method})
                    </span>
                  )}
                </div>
              )}

              {/* Method-aware quick amounts */}
              {open === "DEPOSIT" && portfolio && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {methodMeta.quickAmounts.map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(String(v))}
                      className="tap-target-sm rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground hover:border-gold/40 hover:text-gold press-scale"
                    >
                      {method === "UPI" ? `₹${v.toLocaleString()}` : method === "USDT" ? `₮${v}` : `${methodMeta.prefix}${v}`}
                    </button>
                  ))}
                </div>
              )}
              {open === "WITHDRAWAL" && portfolio && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[50000, 100000, 250000, 500000].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAmount(String(v))}
                      className="tap-target-sm rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground hover:border-gold/40 hover:text-gold press-scale"
                    >
                      {fmtUSD(v, { compact: true })}
                    </button>
                  ))}
                </div>
              )}

              {/* Live minimum validation feedback — DEPOSITS only */}
              {open === "DEPOSIT" && currentAmount > 0 && (
                <div className="flex items-center gap-1.5 pt-0.5 text-[11px]">
                  {meetsMinimum ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-profit" />
                      <span className="text-profit">Meets minimum requirement</span>
                    </>
                  ) : method === "UPI" ? (
                    <>
                      <AlertTriangle className="h-3 w-3 text-loss" />
                      <span className="text-loss">Minimum INR deposit is ₹1000</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3 text-loss" />
                      <span className="text-loss">Minimum crypto deposit is $10</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 2FA Required Notice for high-value operations */}
            {isHighValue && (
              <div className="flex items-start gap-2 rounded-lg border border-gold/20 bg-gold/5 px-3 py-2.5 text-xs">
                <ShieldCheck className="h-4 w-4 shrink-0 text-gold mt-0.5" />
                <span className="text-foreground/90 break-words-mobile">
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
          <DialogFooter className="sticky-mobile-cta flex-col gap-2 sm:flex-row sm:gap-2 safe-area-bottom">
            <Button variant="ghost" onClick={() => setOpen(null)} className="tap-target w-full sm:w-auto">Cancel</Button>
            <Button
              onClick={handleSubmitWith2FA}
              disabled={submitting || (open === "DEPOSIT" && !meetsMinimum)}
              className="tap-target w-full sm:w-auto bg-gold-gradient text-black hover:opacity-90 press-scale"
            >
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
        purpose={`Verify to proceed with ${pending2FAAction?.toLowerCase() ?? "transaction"} of ${
          isCryptoDeposit
            ? fmtUSD(usdEquivalent, { decimals: 2 })
            : open === "DEPOSIT" && method === "UPI"
              ? `₹${currentAmount.toLocaleString()}`
              : fmtUSD(currentAmount)
        }`}
      />
    </div>
  );
}
