"use client";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  GlassCard, SectionTitle, FadeIn, SkeletonMetric, SkeletonTable, EmptyState,
} from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { fmtUSD, fmtPct, fmtNum, fmtDate } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip as RTooltip, CartesianGrid,
} from "recharts";
import {
  PiggyBank, Plus, Search, Pencil, Lock, X, Eye, TrendingUp, TrendingDown,
  Wallet, Target, BarChart3, Calendar, User, Loader2, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

/* ──────────────────────────────────────────────────────────────────────────────
   ADMIN INVESTMENTS — Investment position management
   ────────────────────────────────────────────────────────────────────────────── */

interface InvestmentHistoryEntry {
  id: string;
  previousValue: number;
  newValue: number;
  previousRoi: number;
  newRoi: number;
  updatedBy: string | null;
  createdAt: string;
}

interface Investment {
  id: string;
  userId: string;
  fundId: string;
  investmentName: string;
  investedAmount: number;
  currentValue: number;
  profitLoss: number;
  roiPercent: number;
  startDate: string;
  endDate: string | null;
  durationDays: number;
  status: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { name: string; email: string };
  fund?: { name: string };
  history?: InvestmentHistoryEntry[];
}

interface UserOption {
  id: string;
  name: string;
  email: string;
}

interface FundOption {
  id: string;
  name: string;
}

const STATUS_TABS = ["ALL", "ACTIVE", "PENDING", "CLOSED", "CANCELLED", "COMPLETED"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

function InvestmentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    PENDING:    { label: "Pending",    cls: "text-warning border-warning/30 bg-warning/10", dot: "bg-warning" },
    ACTIVE:     { label: "Active",     cls: "text-profit border-profit/30 bg-profit/10",    dot: "bg-profit" },
    COMPLETED:  { label: "Completed",  cls: "text-gold border-gold/30 bg-gold/10",          dot: "bg-gold" },
    CLOSED:     { label: "Closed",     cls: "text-info border-info/30 bg-info/10",          dot: "bg-info" },
    CANCELLED:  { label: "Cancelled",  cls: "text-loss border-loss/30 bg-loss/10",          dot: "bg-loss" },
  };
  const s = map[status] ?? { label: status, cls: "text-muted-foreground border-border bg-muted", dot: "bg-muted-foreground" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number | null {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

interface FormState {
  userId: string;
  fundId: string;
  investmentName: string;
  investedAmount: string;
  currentValue: string;
  startDate: string;
  endDate: string;
  durationDays: string;
  notes: string;
}

function emptyForm(fundId: string): FormState {
  return {
    userId: "",
    fundId,
    investmentName: "",
    investedAmount: "",
    currentValue: "",
    startDate: todayISO(),
    endDate: "",
    durationDays: "",
    notes: "",
  };
}

export function AdminInvestments() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusTab>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [viewing, setViewing] = useState<Investment | null>(null);
  const [closing, setClosing] = useState<Investment | null>(null);
  const [cancelling, setCancelling] = useState<Investment | null>(null);

  const queryKey = useMemo(() => ["admin-investments", q, status] as const, [q, status]);

  const { data, isLoading } = useQuery<{ investments: Investment[] }>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status !== "ALL") params.set("status", status);
      const qs = params.toString();
      return api.get(`/api/admin/investments${qs ? `?${qs}` : ""}`);
    },
    refetchInterval: 30000,
  });

  const { data: usersData } = useQuery<{ users: UserOption[] }>({
    queryKey: ["admin-users-list"],
    queryFn: () => api.get("/api/admin/users"),
    staleTime: 60000,
  });

  const { data: portfolioData } = useQuery<{ fund: FundOption }>({
    queryKey: ["portfolio-fund"],
    queryFn: () => api.get("/api/portfolio"),
    staleTime: 120000,
  });

  const investments = data?.investments ?? [];
  const users = usersData?.users ?? [];
  const fund = portfolioData?.fund;

  // ── Metric calculations (active only) ────────────────────────────────
  const active = investments.filter((i) => i.status === "ACTIVE");
  const totalCapital = active.reduce((s, i) => s + (i.investedAmount || 0), 0);
  const totalPL = active.reduce((s, i) => s + (i.profitLoss || 0), 0);
  const totalWeight = active.reduce((s, i) => s + (i.investedAmount || 0), 0) || 1;
  const avgRoi = active.reduce((s, i) => s + (i.roiPercent || 0) * (i.investedAmount || 0), 0) / totalWeight;

  // ── Create form state ────────────────────────────────────────────────
  const [createForm, setCreateForm] = useState<FormState>(emptyForm(""));
  const [creating, setCreating] = useState(false);

  // Once fund loads, set fundId on create form (only if user hasn't started editing)
  useEffect(() => {
    if (fund?.id && !createForm.fundId) {
      setCreateForm((f) => ({ ...f, fundId: fund.id }));
    }
  }, [fund?.id, createForm.fundId]);

  // Auto-calc duration days from start/end
  useEffect(() => {
    if (createForm.startDate && createForm.endDate) {
      const d = daysBetween(createForm.startDate, createForm.endDate);
      if (d !== null) setCreateForm((f) => ({ ...f, durationDays: String(d) }));
    }
  }, [createForm.startDate, createForm.endDate]);

  // ── Edit form state ──────────────────────────────────────────────────
  const [editForm, setEditForm] = useState<FormState>(emptyForm(""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setEditForm({
        userId: editing.userId,
        fundId: editing.fundId,
        investmentName: editing.investmentName,
        investedAmount: String(editing.investedAmount ?? ""),
        currentValue: String(editing.currentValue ?? ""),
        startDate: editing.startDate ? editing.startDate.slice(0, 10) : "",
        endDate: editing.endDate ? editing.endDate.slice(0, 10) : "",
        durationDays: editing.durationDays ? String(editing.durationDays) : "",
        notes: editing.notes ?? "",
      });
    }
  }, [editing]);

  useEffect(() => {
    if (editForm.startDate && editForm.endDate) {
      const d = daysBetween(editForm.startDate, editForm.endDate);
      if (d !== null) setEditForm((f) => ({ ...f, durationDays: String(d) }));
    }
  }, [editForm.startDate, editForm.endDate]);

  // Live P&L / ROI preview for edit dialog
  const editInvested = parseFloat(editForm.investedAmount) || 0;
  const editCurrent = parseFloat(editForm.currentValue) || 0;
  const editPL = editCurrent - editInvested;
  const editRoi = editInvested > 0 ? (editPL / editInvested) * 100 : 0;

  // ── Close dialog state ───────────────────────────────────────────────
  const [closeFinalValue, setCloseFinalValue] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [closingBusy, setClosingBusy] = useState(false);

  useEffect(() => {
    if (closing) {
      setCloseFinalValue(String(closing.currentValue ?? ""));
      setCloseNotes("");
    }
  }, [closing]);

  // ── Cancel dialog state ──────────────────────────────────────────────
  const [cancelNotes, setCancelNotes] = useState("");
  const [cancellingBusy, setCancellingBusy] = useState(false);
  useEffect(() => { if (cancelling) setCancelNotes(""); }, [cancelling]);

  // ── Mutations ────────────────────────────────────────────────────────
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-investments"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
  };

  const handleCreate = async () => {
    if (!createForm.userId) return toast.error("Select an investor");
    if (!createForm.fundId) return toast.error("Fund not loaded — please retry");
    if (!createForm.investmentName.trim()) return toast.error("Investment name is required");
    const invested = parseFloat(createForm.investedAmount);
    if (!invested || invested <= 0) return toast.error("Enter a valid invested amount");
    if (!createForm.startDate) return toast.error("Start date is required");

    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        userId: createForm.userId,
        fundId: createForm.fundId,
        investmentName: createForm.investmentName.trim(),
        investedAmount: invested,
        currentValue: createForm.currentValue ? parseFloat(createForm.currentValue) : invested,
        startDate: createForm.startDate,
        notes: createForm.notes.trim() || undefined,
      };
      if (createForm.endDate) payload.endDate = createForm.endDate;
      if (createForm.durationDays) payload.durationDays = parseInt(createForm.durationDays) || undefined;

      await api.post("/api/admin/investments", payload);
      toast.success("Investment created");
      setCreateOpen(false);
      setCreateForm(emptyForm(fund?.id ?? ""));
      invalidateAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create investment");
    } finally {
      setCreating(false);
    }
  };

  const handleEditSave = async () => {
    if (!editing) return;
    if (!editForm.investmentName.trim()) return toast.error("Investment name is required");
    const invested = parseFloat(editForm.investedAmount);
    if (!invested || invested <= 0) return toast.error("Enter a valid invested amount");
    const current = parseFloat(editForm.currentValue);
    if (isNaN(current)) return toast.error("Enter a valid current value");
    if (!editForm.startDate) return toast.error("Start date is required");

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        investmentName: editForm.investmentName.trim(),
        investedAmount: invested,
        currentValue: current,
        startDate: editForm.startDate,
        notes: editForm.notes.trim() || null,
      };
      if (editForm.endDate) payload.endDate = editForm.endDate;
      if (editForm.durationDays) payload.durationDays = parseInt(editForm.durationDays) || undefined;

      await api.put(`/api/admin/investments/${editing.id}`, payload);
      toast.success("Investment updated");
      setEditing(null);
      invalidateAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update investment");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async () => {
    if (!closing) return;
    setClosingBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      if (closeFinalValue) payload.finalValue = parseFloat(closeFinalValue);
      if (closeNotes.trim()) payload.notes = closeNotes.trim();
      await api.post(`/api/admin/investments/${closing.id}/close`, payload);
      toast.success("Investment closed");
      setClosing(null);
      invalidateAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to close investment");
    } finally {
      setClosingBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelling) return;
    setCancellingBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      if (cancelNotes.trim()) payload.notes = cancelNotes.trim();
      await api.post(`/api/admin/investments/${cancelling.id}/cancel`, payload);
      toast.success("Investment cancelled");
      setCancelling(null);
      invalidateAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel investment");
    } finally {
      setCancellingBusy(false);
    }
  };

  // ── Detail dialog: fetch full investment with history ────────────────
  const { data: detailData, isLoading: detailLoading } = useQuery<{ investment: Investment }>({
    queryKey: ["admin-investment-detail", viewing?.id],
    queryFn: () => api.get(`/api/admin/investments/${viewing!.id}`),
    enabled: !!viewing,
  });
  const detail: Investment | null = detailData?.investment ?? viewing;

  // Build chart data from history + current value
  const chartData = useMemo(() => {
    if (!detail) return [];
    const pts = (detail.history ?? []).map((h) => ({ date: h.createdAt, value: h.newValue }));
    pts.push({ date: detail.updatedAt, value: detail.currentValue });
    return pts;
  }, [detail]);

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <FadeIn>
          <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
              <h1 className="h2-responsive mt-1 font-bold tracking-tight">Investment Management</h1>
              <p className="body-responsive text-muted-foreground">Create and manage investor positions</p>
            </div>
          </div>
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <SkeletonMetric key={i} className="h-28" />)}
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <GlassCard className="p-3 sm:p-4 lg:p-5">
            <SectionTitle title="Investments" subtitle="Loading…" />
            <div className="mt-4">
              <SkeletonTable rows={6} cols={8} />
            </div>
          </GlassCard>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
            <h1 className="h2-responsive mt-1 font-bold tracking-tight">Investment Management</h1>
            <p className="body-responsive text-muted-foreground">Create and manage investor positions</p>
          </div>
          <Button
            onClick={() => { setCreateForm(emptyForm(fund?.id ?? "")); setCreateOpen(true); }}
            className="bg-gold-gradient text-black hover:opacity-90 press-scale gap-1.5 tap-target-sm btn-full-mobile sm:btn-auto"
          >
            <Plus className="h-4 w-4" /> Create Investment
          </Button>
        </div>
      </FadeIn>

      {/* Metric tiles */}
      <FadeIn delay={0.05}>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <GlassCard className="card-p sm:p-4 hover-lift gold-glow-hover">
            <div className="flex items-center gap-2 text-muted-foreground">
              <PiggyBank className="h-4 w-4" />
              <span className="text-[11px] uppercase tracking-wider">Total Investments</span>
            </div>
            <div className="mt-1 font-metric text-xl sm:text-2xl font-bold text-foreground">{investments.length}</div>
            <div className="text-[11px] text-muted-foreground">{active.length} active</div>
          </GlassCard>

          <GlassCard className="card-p sm:p-4 hover-lift gold-glow-hover">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-4 w-4 text-gold" />
              <span className="text-[11px] uppercase tracking-wider">Capital Allocated</span>
            </div>
            <div className="mt-1 font-metric text-xl sm:text-2xl font-bold text-gold">{fmtUSD(totalCapital, { compact: true })}</div>
            <div className="text-[11px] text-muted-foreground">Across {active.length} position{active.length !== 1 ? "s" : ""}</div>
          </GlassCard>

          <GlassCard className="card-p sm:p-4 hover-lift gold-glow-hover">
            <div className="flex items-center gap-2 text-muted-foreground">
              {totalPL >= 0 ? <TrendingUp className="h-4 w-4 text-profit" /> : <TrendingDown className="h-4 w-4 text-loss" />}
              <span className="text-[11px] uppercase tracking-wider">Active P&amp;L</span>
            </div>
            <div className={`mt-1 font-metric text-xl sm:text-2xl font-bold ${totalPL >= 0 ? "text-profit" : "text-loss"}`}>
              {fmtUSD(totalPL, { compact: true })}
            </div>
            <div className={`text-[11px] ${totalPL >= 0 ? "text-profit/70" : "text-loss/70"}`}>
              {fmtPct(active.length ? (totalPL / (totalCapital || 1)) * 100 : 0)} blended
            </div>
          </GlassCard>

          <GlassCard className="card-p sm:p-4 hover-lift gold-glow-hover">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4 text-gold" />
              <span className="text-[11px] uppercase tracking-wider">Avg ROI</span>
            </div>
            <div className={`mt-1 font-metric text-xl sm:text-2xl font-bold ${avgRoi >= 0 ? "text-profit" : "text-loss"}`}>
              {fmtPct(avgRoi)}
            </div>
            <div className="text-[11px] text-muted-foreground">Capital-weighted</div>
          </GlassCard>
        </div>
      </FadeIn>

      {/* Search + filter bar */}
      <FadeIn delay={0.08}>
        <GlassCard className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or email…"
                className="tap-target-sm border-border/60 bg-black/30 pl-9"
              />
            </div>
            <div className="scroll-row -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex sm:flex-wrap sm:items-center sm:gap-1.5">
              {STATUS_TABS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-all press-scale tap-target-sm ${
                    status === s
                      ? "border-gold/50 bg-gold/10 text-gold shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                      : "border-border/40 bg-black/20 text-muted-foreground hover:border-gold/30 hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* Investments table */}
      <FadeIn delay={0.12}>
        <GlassCard className="p-3 sm:p-4 lg:p-5">
          <SectionTitle title="Investments" subtitle={`${investments.length} position${investments.length !== 1 ? "s" : ""}`} />
          {investments.length === 0 ? (
            <EmptyState
              icon={<PiggyBank className="h-7 w-7" />}
              title="No investments yet"
              description="Create your first investor position to start tracking performance and P&L."
              action={
                <Button
                  onClick={() => { setCreateForm(emptyForm(fund?.id ?? "")); setCreateOpen(true); }}
                  className="bg-gold-gradient text-black hover:opacity-90 gap-1.5 tap-target-sm"
                >
                  <Plus className="h-4 w-4" /> Create Investment
                </Button>
              }
            />
          ) : (
            <div className="mt-4 table-mobile-card overflow-x-auto scroll-x-allowed lg:overflow-visible">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Investment</th>
                    <th className="pb-2 pr-4 font-medium hide-mobile">User</th>
                    <th className="pb-2 pr-4 font-medium">Invested</th>
                    <th className="pb-2 pr-4 font-medium">Current</th>
                    <th className="pb-2 pr-4 font-medium">P&amp;L</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium hide-mobile">Start</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {investments.map((inv, idx) => {
                    const pl = inv.profitLoss;
                    const positive = pl >= 0;
                    const canClose = inv.status === "ACTIVE" || inv.status === "PENDING";
                    const canCancel = inv.status === "PENDING" || inv.status === "ACTIVE";
                    return (
                      <motion.tr
                        key={inv.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, delay: Math.min(idx * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
                        className="border-b border-border/40 last:border-0 hover:bg-gold/[0.04]"
                      >
                        <td data-label="Investment" className="py-3 pr-4">
                          <div className="font-medium text-foreground break-words-mobile">{inv.investmentName}</div>
                          <div className="text-[11px] text-muted-foreground break-words-mobile">{inv.user?.email ?? "—"}</div>
                          <div className="text-[11px] text-muted-foreground show-mobile">{inv.user?.name ?? "—"}</div>
                        </td>
                        <td data-label="User" className="py-3 pr-4 hide-mobile">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-gradient text-[10px] font-bold text-black">
                              {(inv.user?.name ?? "?").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-foreground">{inv.user?.name ?? "—"}</span>
                          </div>
                        </td>
                        <td data-label="Invested" className="py-3 pr-4 font-metric text-muted-foreground">{fmtUSD(inv.investedAmount)}</td>
                        <td data-label="Current" className="py-3 pr-4 font-metric font-semibold text-foreground">{fmtUSD(inv.currentValue)}</td>
                        <td data-label="P&L" className="py-3 pr-4">
                          <div className={`font-metric font-semibold ${positive ? "text-profit" : "text-loss"}`}>
                            {positive ? "+" : ""}{fmtUSD(pl)}
                          </div>
                          <div className={`text-[11px] ${positive ? "text-profit/70" : "text-loss/70"}`}>
                            ({fmtPct(inv.roiPercent)})
                          </div>
                        </td>
                        <td data-label="Status" className="py-3 pr-4"><InvestmentStatusBadge status={inv.status} /></td>
                        <td data-label="Start" className="py-3 pr-4 text-muted-foreground hide-mobile">{fmtDate(inv.startDate)}</td>
                        <td data-label="Actions" className="cell-actions py-3">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="ghost" onClick={() => setViewing(inv)} className="text-muted-foreground hover:text-gold hover:bg-gold/10 press-scale h-9 w-9 p-0 tap-target-sm">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View details</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="ghost" onClick={() => setEditing(inv)} className="text-muted-foreground hover:text-gold hover:bg-gold/10 press-scale h-9 w-9 p-0 tap-target-sm">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {canClose && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="ghost" onClick={() => setClosing(inv)} className="text-muted-foreground hover:text-info hover:bg-info/10 press-scale h-9 w-9 p-0 tap-target-sm">
                                      <Lock className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Close position</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {canCancel && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="sm" variant="ghost" onClick={() => setCancelling(inv)} className="text-muted-foreground hover:text-loss hover:bg-loss/10 press-scale h-9 w-9 p-0 tap-target-sm">
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Cancel position</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </FadeIn>

      {/* ─────────── Create Investment Dialog ─────────── */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="border-gold/20 bg-card/95 backdrop-blur-xl max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto scroll-luxury">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-gold" /> Create Investment</DialogTitle>
            <DialogDescription>Open a new investor position in the fund</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Investor</Label>
              <Select value={createForm.userId} onValueChange={(v) => setCreateForm({ ...createForm, userId: v })}>
                <SelectTrigger className="w-full border-border/60 bg-black/30">
                  <SelectValue placeholder="Select investor…" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {users.length === 0 ? (
                    <SelectItem value="__none" disabled>Loading investors…</SelectItem>
                  ) : (
                    users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} <span className="text-muted-foreground">· {u.email}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fund</Label>
              <Input
                value={fund?.name ?? "Loading fund…"}
                readOnly
                disabled
                className="border-border/60 bg-black/40 text-muted-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Investment Name</Label>
              <Input
                value={createForm.investmentName}
                onChange={(e) => setCreateForm({ ...createForm, investmentName: e.target.value })}
                placeholder="Nightmare Alpha Position #001"
                className="border-border/60 bg-black/30"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Invested Amount (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min={0}
                    value={createForm.investedAmount}
                    onChange={(e) => setCreateForm({ ...createForm, investedAmount: e.target.value })}
                    placeholder="100000"
                    className="border-border/60 bg-black/30 pl-7 font-metric"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Initial Current Value</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min={0}
                    value={createForm.currentValue}
                    onChange={(e) => setCreateForm({ ...createForm, currentValue: e.target.value })}
                    placeholder="Defaults to invested"
                    className="border-border/60 bg-black/30 pl-7 font-metric"
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Start Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                    className="border-border/60 bg-black/30 pl-9"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">End Date (optional)</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                    className="border-border/60 bg-black/30 pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Duration Days (auto from dates)</Label>
              <Input
                type="number"
                min={0}
                value={createForm.durationDays}
                onChange={(e) => setCreateForm({ ...createForm, durationDays: e.target.value })}
                placeholder="365"
                className="border-border/60 bg-black/30 font-metric"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
              <Textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                placeholder="Strategy, mandate, or admin notes…"
                rows={2}
                className="border-border/60 bg-black/30 text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button variant="ghost" onClick={() => setCreateOpen(false)} className="btn-full-mobile tap-target-sm">Cancel</Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="bg-gold-gradient text-black hover:opacity-90 press-scale gap-1.5 btn-full-mobile tap-target-sm"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creating ? "Creating…" : "Create Investment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────── Edit Investment Dialog ─────────── */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="border-gold/20 bg-card/95 backdrop-blur-xl max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto scroll-luxury">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-gold" /> Edit Investment</DialogTitle>
            <DialogDescription>Update position details and current value</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Investor</Label>
                  <Input
                    value={editing.user?.name ?? "—"}
                    readOnly
                    disabled
                    className="border-border/60 bg-black/40 text-muted-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fund</Label>
                  <Input
                    value={editing.fund?.name ?? "—"}
                    readOnly
                    disabled
                    className="border-border/60 bg-black/40 text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Investment Name</Label>
                <Input
                  value={editForm.investmentName}
                  onChange={(e) => setEditForm({ ...editForm, investmentName: e.target.value })}
                  className="border-border/60 bg-black/30"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Invested Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.investedAmount}
                      onChange={(e) => setEditForm({ ...editForm, investedAmount: e.target.value })}
                      className="border-border/60 bg-black/30 pl-7 font-metric"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Current Value</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.currentValue}
                      onChange={(e) => setEditForm({ ...editForm, currentValue: e.target.value })}
                      className="border-border/60 bg-black/30 pl-7 font-metric"
                    />
                  </div>
                </div>
              </div>

              {/* Live P&L / ROI preview */}
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-gold/15 bg-gold/[0.04] p-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">P&amp;L</div>
                  <div className={`font-metric text-sm font-semibold ${editPL >= 0 ? "text-profit" : "text-loss"}`}>
                    {editPL >= 0 ? "+" : ""}{fmtUSD(editPL)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ROI</div>
                  <div className={`font-metric text-sm font-semibold ${editRoi >= 0 ? "text-profit" : "text-loss"}`}>
                    {fmtPct(editRoi)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Change</div>
                  <div className={`font-metric text-sm font-semibold ${editCurrent - editInvested >= 0 ? "text-profit" : "text-loss"}`}>
                    {editInvested > 0 ? fmtPct(((editCurrent - editInvested) / editInvested) * 100) : "—"}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Start Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      className="border-border/60 bg-black/30 pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">End Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="date"
                      value={editForm.endDate}
                      onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      className="border-border/60 bg-black/30 pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="border-border/60 bg-black/30 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button variant="ghost" onClick={() => setEditing(null)} className="btn-full-mobile tap-target-sm">Cancel</Button>
            <Button
              onClick={handleEditSave}
              disabled={saving}
              className="bg-gold-gradient text-black hover:opacity-90 press-scale gap-1.5 btn-full-mobile tap-target-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────── Detail Dialog ─────────── */}
      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="border-gold/20 bg-card/95 backdrop-blur-xl max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto scroll-luxury">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-gold" /> Investment Detail</DialogTitle>
            <DialogDescription>{detail?.investmentName ?? "Loading…"}</DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-5 py-2">
              {/* P&L summary card */}
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-gold/20 bg-gold/[0.04] p-3 sm:p-4 sm:grid-cols-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Invested</div>
                  <div className="mt-0.5 font-metric text-base font-bold text-foreground">{fmtUSD(detail.investedAmount)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current</div>
                  <div className="mt-0.5 font-metric text-base font-bold text-gold">{fmtUSD(detail.currentValue)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">P&amp;L</div>
                  <div className={`mt-0.5 font-metric text-base font-bold ${detail.profitLoss >= 0 ? "text-profit" : "text-loss"}`}>
                    {detail.profitLoss >= 0 ? "+" : ""}{fmtUSD(detail.profitLoss)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ROI</div>
                  <div className={`mt-0.5 font-metric text-base font-bold ${detail.roiPercent >= 0 ? "text-profit" : "text-loss"}`}>
                    {fmtPct(detail.roiPercent)}
                  </div>
                </div>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-black/20 p-3 sm:p-4 sm:grid-cols-3">
                <Meta label="Investor" value={detail.user?.name ?? "—"} sub={detail.user?.email} />
                <Meta label="Fund" value={detail.fund?.name ?? "—"} />
                <Meta label="Status" value={<InvestmentStatusBadge status={detail.status} />} />
                <Meta label="Start Date" value={fmtDate(detail.startDate)} />
                <Meta label="End Date" value={detail.endDate ? fmtDate(detail.endDate) : "—"} />
                <Meta label="Duration" value={detail.durationDays ? `${detail.durationDays} days` : "—"} />
                <Meta label="Created" value={fmtDate(detail.createdAt, true)} />
                <Meta label="Last Update" value={fmtDate(detail.updatedAt, true)} />
                <Meta label="Created By" value={detail.createdBy ?? "—"} />
              </div>

              {detail.notes && (
                <div className="rounded-lg border border-border/60 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</div>
                  <div className="mt-1 text-sm text-foreground whitespace-pre-wrap">{detail.notes}</div>
                </div>
              )}

              {/* Performance chart */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-gold" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Value History</h4>
                </div>
                <div className="chart-mobile rounded-lg border border-border/40 bg-black/20 p-3">
                  {chartData.length >= 2 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          tick={{ fill: "#7A7A7A", fontSize: 10 }}
                          stroke="rgba(255,255,255,0.08)"
                          minTickGap={30}
                        />
                        <YAxis
                          tickFormatter={(v) => fmtUSD(Number(v), { compact: true })}
                          tick={{ fill: "#7A7A7A", fontSize: 10 }}
                          stroke="rgba(255,255,255,0.08)"
                          width={56}
                          domain={["auto", "auto"]}
                        />
                        <RTooltip
                          contentStyle={{ background: "rgba(20,20,22,0.95)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: "10px" }}
                          formatter={(v: number) => [fmtUSD(Number(v)), "Value"]}
                          labelFormatter={(d) => new Date(d as string).toLocaleString()}
                        />
                        <Line type="monotone" dataKey="value" stroke="#D4AF37" strokeWidth={2} dot={{ r: 2, fill: "#D4AF37" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No history yet — first valuation update will appear here.
                    </div>
                  )}
                </div>
              </div>

              {/* History table */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-gold" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valuation History</h4>
                </div>
                <div className="max-h-56 overflow-y-auto scroll-luxury rounded-lg border border-border/60">
                  <div className="table-mobile-card overflow-x-auto scroll-x-allowed">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card/95 backdrop-blur">
                      <tr className="border-b border-border/60 text-left uppercase tracking-wider text-muted-foreground">
                        <th className="p-2 font-medium">Date</th>
                        <th className="p-2 font-medium">Prev Value</th>
                        <th className="p-2 font-medium">New Value</th>
                        <th className="p-2 font-medium">Prev ROI</th>
                        <th className="p-2 font-medium">New ROI</th>
                        <th className="p-2 font-medium">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.history ?? []).length === 0 ? (
                        <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No valuation updates recorded</td></tr>
                      ) : (
                        (detail.history ?? []).map((h) => (
                          <tr key={h.id} className="border-b border-border/40 last:border-0 hover:bg-gold/[0.04]">
                            <td data-label="Date" className="p-2 text-muted-foreground">{fmtDate(h.createdAt, true)}</td>
                            <td data-label="Prev Value" className="p-2 font-metric text-muted-foreground">{fmtUSD(h.previousValue)}</td>
                            <td data-label="New Value" className="p-2 font-metric font-semibold text-foreground">{fmtUSD(h.newValue)}</td>
                            <td data-label="Prev ROI" className="p-2 font-metric text-muted-foreground">{fmtPct(h.previousRoi)}</td>
                            <td data-label="New ROI" className={`p-2 font-metric font-semibold ${h.newRoi >= h.previousRoi ? "text-profit" : "text-loss"}`}>{fmtPct(h.newRoi)}</td>
                            <td data-label="By" className="p-2 text-muted-foreground">{h.updatedBy ?? "system"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button variant="ghost" onClick={() => setViewing(null)} className="btn-full-mobile tap-target-sm">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────── Close Confirmation Dialog ─────────── */}
      <Dialog open={closing !== null} onOpenChange={(o) => !o && !closingBusy && setClosing(null)}>
        <DialogContent className="border-gold/20 bg-card/95 backdrop-blur-xl max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto scroll-luxury">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-info" /> Close Investment</DialogTitle>
            <DialogDescription>
              Close <strong className="text-foreground">{closing?.investmentName}</strong>? This will lock the position and record the final value.
            </DialogDescription>
          </DialogHeader>
          {closing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-black/20 p-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Invested</div>
                  <div className="font-metric font-semibold text-foreground">{fmtUSD(closing.investedAmount)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current</div>
                  <div className="font-metric font-semibold text-gold">{fmtUSD(closing.currentValue)}</div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Final Value (optional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min={0}
                    value={closeFinalValue}
                    onChange={(e) => setCloseFinalValue(e.target.value)}
                    className="border-border/60 bg-black/30 pl-7 font-metric"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Defaults to current value if left unchanged.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Closing Notes (optional)</Label>
                <Textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Reason for closing, final settlement notes…"
                  rows={2}
                  className="border-border/60 bg-black/30 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button variant="ghost" onClick={() => setClosing(null)} disabled={closingBusy} className="btn-full-mobile tap-target-sm">Cancel</Button>
            <Button
              onClick={handleClose}
              disabled={closingBusy}
              variant="outline"
              className="border-info/40 text-info hover:bg-info/10 gap-1.5 press-scale btn-full-mobile tap-target-sm"
            >
              {closingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {closingBusy ? "Closing…" : "Confirm Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────── Cancel Confirmation Dialog ─────────── */}
      <Dialog open={cancelling !== null} onOpenChange={(o) => !o && !cancellingBusy && setCancelling(null)}>
        <DialogContent className="border-gold/20 bg-card/95 backdrop-blur-xl max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto scroll-luxury">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><X className="h-5 w-5 text-loss" /> Cancel Investment</DialogTitle>
            <DialogDescription>
              Cancel <strong className="text-foreground">{cancelling?.investmentName}</strong>? This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          {cancelling && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-loss/20 bg-loss/5 p-3 text-xs text-foreground/90">
                <strong className="text-loss">Warning:</strong> Cancelling will mark this position as cancelled. The invested capital remains unaffected, but the position will stop accruing performance.
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cancellation Notes (optional)</Label>
                <Textarea
                  value={cancelNotes}
                  onChange={(e) => setCancelNotes(e.target.value)}
                  placeholder="Reason for cancellation…"
                  rows={2}
                  className="border-border/60 bg-black/30 text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button variant="ghost" onClick={() => setCancelling(null)} disabled={cancellingBusy} className="btn-full-mobile tap-target-sm">Keep Position</Button>
            <Button
              onClick={handleCancel}
              disabled={cancellingBusy}
              variant="outline"
              className="border-loss/40 text-loss hover:bg-loss/10 gap-1.5 press-scale btn-full-mobile tap-target-sm"
            >
              {cancellingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              {cancellingBusy ? "Cancelling…" : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────────────────── */

function Meta({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm text-foreground">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
