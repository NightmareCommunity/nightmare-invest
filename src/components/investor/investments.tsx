"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  GlassCard,
  MetricTile,
  SectionTitle,
  FadeIn,
  SkeletonCard,
  SkeletonMetric,
  EmptyState,
} from "@/components/brand/primitives";
import { fmtUSD, fmtPct, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  PiggyBank,
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity,
  Target,
  Clock,
  Calendar,
  BarChart3,
  LineChart as LineChartIcon,
  Coins,
  ArrowRight,
  CheckCircle2,
  Hourglass,
  XCircle,
  CircleSlash,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InvestmentHistory {
  id: string;
  previousValue: number;
  newValue: number;
  previousRoi: number;
  newRoi: number;
  createdAt: string;
}

interface Investment {
  id: string;
  investmentName: string;
  investedAmount: number;
  currentValue: number;
  profitLoss: number;
  roiPercent: number;
  startDate: string;
  endDate: string | null;
  durationDays: number;
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "CLOSED" | "CANCELLED" | string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  fund?: { name: string };
  history?: InvestmentHistory[];
}

interface InvestmentsResponse {
  investments: Investment[];
}

interface InvestmentDetailResponse {
  investment: Investment;
}

/* ------------------------------------------------------------------ */
/*  Status Badge                                                       */
/* ------------------------------------------------------------------ */

const STATUS_META: Record<string, { label: string; cls: string; dot: string; icon: typeof CheckCircle2 }> = {
  PENDING: {
    label: "Pending",
    cls: "text-warning border-warning/30 bg-warning/10",
    dot: "bg-warning",
    icon: Hourglass,
  },
  ACTIVE: {
    label: "Active",
    cls: "text-profit border-profit/30 bg-profit/10",
    dot: "bg-profit",
    icon: Activity,
  },
  COMPLETED: {
    label: "Completed",
    cls: "text-gold border-gold/30 bg-gold/10",
    dot: "bg-gold",
    icon: CheckCircle2,
  },
  CLOSED: {
    label: "Closed",
    cls: "text-muted-foreground border-border/60 bg-muted/10",
    dot: "bg-muted-foreground",
    icon: CircleSlash,
  },
  CANCELLED: {
    label: "Cancelled",
    cls: "text-loss border-loss/30 bg-loss/10",
    dot: "bg-loss",
    icon: XCircle,
  },
};

function InvestmentStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status,
    cls: "text-muted-foreground border-border bg-muted",
    dot: "bg-muted-foreground",
    icon: CircleSlash,
  };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${meta.cls}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function progressPct(start: string, end: string | null): number {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (!endMs || endMs <= startMs) return 0;
  const now = Date.now();
  if (now >= endMs) return 100;
  if (now <= startMs) return 0;
  return Math.min(100, Math.max(0, ((now - startMs) / (endMs - startMs)) * 100));
}

function durationLabel(days: number): string {
  if (days <= 0) return "—";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30 * 10) / 10}mo`;
  return `${Math.round(days / 365 * 10) / 10}yr`;
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function InvestmentsSkeleton() {
  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">My Investments</h1>
            <p className="text-sm text-muted-foreground">Your active positions and performance</p>
          </div>
        </div>
      </FadeIn>
      <FadeIn delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <SkeletonMetric key={i} className="h-28" />)}
        </div>
      </FadeIn>
      <FadeIn delay={0.1}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} className="h-64" />)}
        </div>
      </FadeIn>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail Dialog                                                      */
/* ------------------------------------------------------------------ */

function InvestmentDetailDialog({
  investment,
  open,
  onOpenChange,
}: {
  investment: Investment | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  // Build chart data: history entries + current value appended as latest point
  const valueChartData = useMemo(() => {
    if (!investment) return [];
    const points: { date: string; value: number; roi: number }[] = [];
    // Seed with the invested value at startDate as origin point
    points.push({
      date: new Date(investment.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: investment.investedAmount,
      roi: 0,
    });
    for (const h of investment.history ?? []) {
      points.push({
        date: new Date(h.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: h.newValue,
        roi: h.newRoi,
      });
    }
    // Append current value as the latest point if it differs
    const last = points[points.length - 1];
    if (!last || last.value !== investment.currentValue) {
      points.push({
        date: new Date(investment.updatedAt ?? Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: investment.currentValue,
        roi: investment.roiPercent,
      });
    }
    return points;
  }, [investment]);

  if (!investment) return null;

  const profit = investment.profitLoss;
  const roi = investment.roiPercent;
  const progress = progressPct(investment.startDate, investment.endDate);
  const history = [...(investment.history ?? [])].reverse(); // newest first

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-gold/20 bg-card/95 backdrop-blur-xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 pr-6">
            <span className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-gold" />
              {investment.investmentName}
            </span>
            <InvestmentStatusBadge status={investment.status} />
          </DialogTitle>
          <DialogDescription>
            {investment.fund?.name ?? "Investment position"} · Created {fmtDate(investment.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto scroll-luxury pr-1">
          {/* ─── Hero P&L ─── */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border/40 bg-black/30 p-4">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Invested</div>
              <div className="mt-1 font-metric text-xl font-bold">{fmtUSD(investment.investedAmount)}</div>
            </div>
            <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-gold/80">Current Value</div>
              <div className="mt-1 font-metric text-xl font-bold text-gold">{fmtUSD(investment.currentValue)}</div>
            </div>
            <div className={`rounded-xl border p-4 ${profit >= 0 ? "border-profit/30 bg-profit/5" : "border-loss/30 bg-loss/5"}`}>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Profit / Loss</div>
              <div className={`mt-1 font-metric text-xl font-bold ${profit >= 0 ? "text-profit" : "text-loss"}`}>
                {profit >= 0 ? "+" : ""}{fmtUSD(profit)}
              </div>
              <div className={`mt-0.5 text-xs ${roi >= 0 ? "text-profit/80" : "text-loss/80"}`}>{fmtPct(roi)} ROI</div>
            </div>
          </div>

          {/* ─── Metadata grid ─── */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetaItem icon={<Calendar className="h-3.5 w-3.5" />} label="Start Date" value={fmtDate(investment.startDate)} />
            <MetaItem
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="End Date"
              value={investment.endDate ? fmtDate(investment.endDate) : "Open"}
            />
            <MetaItem icon={<Clock className="h-3.5 w-3.5" />} label="Duration" value={durationLabel(investment.durationDays)} />
            <MetaItem icon={<Activity className="h-3.5 w-3.5" />} label="Status" value={<InvestmentStatusBadge status={investment.status} />} />
          </div>

          {/* ─── Progress bar ─── */}
          {investment.endDate && (
            <div className="rounded-xl border border-border/40 bg-black/20 p-4">
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Target className="h-3 w-3 text-gold" />Position Timeline</span>
                <span className="font-metric text-gold">{progress.toFixed(1)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-border/40">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full bg-gold-gradient"
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[10.5px] text-muted-foreground">
                <span>{fmtDate(investment.startDate)}</span>
                <span>{fmtDate(investment.endDate)}</span>
              </div>
            </div>
          )}

          {/* ─── Notes ─── */}
          {investment.notes && (
            <div className="rounded-xl border border-border/40 bg-black/20 p-4">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Notes</div>
              <p className="mt-1 text-sm text-foreground/90">{investment.notes}</p>
            </div>
          )}

          {/* ─── Value chart ─── */}
          <div className="rounded-xl border border-border/40 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <LineChartIcon className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold">Value Over Time</h3>
            </div>
            <div className="h-56">
              {valueChartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={valueChartData} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                    <defs>
                      <linearGradient id="invValueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.35} />
                        <stop offset="60%" stopColor="#D4AF37" stopOpacity={0.08} />
                        <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="invValueStroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#b8860b" />
                        <stop offset="50%" stopColor="#D4AF37" />
                        <stop offset="100%" stopColor="#ffd700" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#7A7A7A", fontSize: 11 }}
                      stroke="rgba(255,255,255,0.08)"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={(v) => `$${v.toLocaleString()}`}
                      tick={{ fill: "#7A7A7A", fontSize: 11 }}
                      stroke="rgba(255,255,255,0.08)"
                      width={64}
                    />
                    <Tooltip
                      cursor={{ stroke: "rgba(212,175,55,0.3)", strokeDasharray: "4 4" }}
                      contentStyle={{
                        background: "rgba(20,20,22,0.95)",
                        border: "1px solid rgba(212,175,55,0.25)",
                        borderRadius: "10px",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                      }}
                      formatter={(v: number) => [fmtUSD(v), "Value"]}
                      labelStyle={{ color: "#9a9a9a", fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="url(#invValueStroke)"
                      strokeWidth={2.5}
                      fill="url(#invValueGrad)"
                      dot={false}
                      activeDot={{ r: 5, fill: "#D4AF37", stroke: "#0a0a0b", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <BarChart3 className="h-8 w-8 text-gold/30" />
                    <span>Performance history will appear as the position is updated</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── ROI chart ─── */}
          <div className="rounded-xl border border-border/40 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold">ROI Growth</h3>
            </div>
            <div className="h-48">
              {valueChartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={valueChartData} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#7A7A7A", fontSize: 11 }}
                      stroke="rgba(255,255,255,0.08)"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={(v) => `${v.toFixed(1)}%`}
                      tick={{ fill: "#7A7A7A", fontSize: 11 }}
                      stroke="rgba(255,255,255,0.08)"
                      width={48}
                    />
                    <Tooltip
                      cursor={{ stroke: "rgba(212,175,55,0.3)", strokeDasharray: "4 4" }}
                      contentStyle={{
                        background: "rgba(20,20,22,0.95)",
                        border: "1px solid rgba(212,175,55,0.25)",
                        borderRadius: "10px",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                      }}
                      formatter={(v: number) => [fmtPct(v), "ROI"]}
                      labelStyle={{ color: "#9a9a9a", fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="roi"
                      stroke="#00c896"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5, fill: "#00c896", stroke: "#0a0a0b", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <span>ROI history will appear as the position matures</span>
                </div>
              )}
            </div>
          </div>

          {/* ─── History table ─── */}
          <div className="rounded-xl border border-border/40 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold">Update History</h3>
            </div>
            {history.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No updates recorded yet</p>
            ) : (
              <div className="max-h-64 overflow-y-auto scroll-luxury">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card/95 backdrop-blur">
                    <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Date</th>
                      <th className="pb-2 pr-4 font-medium">Value Change</th>
                      <th className="pb-2 pr-4 font-medium">ROI Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id} className="border-b border-border/40 last:border-0">
                        <td className="py-2.5 pr-4 text-muted-foreground">{fmtDate(h.createdAt, true)}</td>
                        <td className="py-2.5 pr-4 font-metric">
                          <span className="text-muted-foreground">{fmtUSD(h.previousValue, { decimals: 2 })}</span>
                          <ArrowRight className="mx-1 inline h-3 w-3 text-gold/60" />
                          <span className="font-semibold text-gold">{fmtUSD(h.newValue, { decimals: 2 })}</span>
                        </td>
                        <td className="py-2.5 pr-4 font-metric">
                          <span className="text-muted-foreground">{fmtPct(h.previousRoi)}</span>
                          <ArrowRight className="mx-1 inline h-3 w-3 text-gold/60" />
                          <span className={`font-semibold ${h.newRoi >= 0 ? "text-profit" : "text-loss"}`}>{fmtPct(h.newRoi)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-black/20 p-3">
      <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <span className="text-gold/70">{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Investment Card                                                    */
/* ------------------------------------------------------------------ */

function InvestmentCard({
  investment,
  index,
  onView,
}: {
  investment: Investment;
  index: number;
  onView: () => void;
}) {
  const profit = investment.profitLoss;
  const roi = investment.roiPercent;
  const isProfit = profit >= 0;
  const progress = progressPct(investment.startDate, investment.endDate);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard className="h-full p-5 hover-lift gold-glow-hover">
        {/* Header: name + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold tracking-tight">{investment.investmentName}</h3>
            {investment.fund?.name && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{investment.fund.name}</p>
            )}
          </div>
          <InvestmentStatusBadge status={investment.status} />
        </div>

        {/* Invested + current value */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Invested</div>
            <div className="mt-0.5 font-metric text-lg font-bold">{fmtUSD(investment.investedAmount)}</div>
          </div>
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-gold/80">Current Value</div>
            <div className="mt-0.5 font-metric text-lg font-bold text-gold">{fmtUSD(investment.currentValue)}</div>
          </div>
        </div>

        {/* P&L + ROI pill */}
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-black/20 px-3 py-2">
          <div className="flex items-center gap-1.5">
            {isProfit ? (
              <TrendingUp className="h-3.5 w-3.5 text-profit" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-loss" />
            )}
            <span className={`font-metric text-sm font-semibold ${isProfit ? "text-profit" : "text-loss"}`}>
              {isProfit ? "+" : ""}{fmtUSD(profit)}
            </span>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              roi >= 0
                ? "border-profit/30 bg-profit/10 text-profit"
                : "border-loss/30 bg-loss/10 text-loss"
            }`}
          >
            {fmtPct(roi)}
          </span>
        </div>

        {/* Progress bar */}
        {investment.endDate ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-[10.5px] text-muted-foreground">
              <span>Progress</span>
              <span className="font-metric text-gold/80">{progress.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/40">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ delay: index * 0.06 + 0.2, duration: 0.7, ease: "easeOut" }}
                className="h-full rounded-full bg-gold-gradient"
              />
            </div>
          </div>
        ) : (
          <div className="mt-3 h-[18px]" />
        )}

        {/* Footer: dates + button */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
          <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 shrink-0" />
              <span className="truncate">{fmtDate(investment.startDate)}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              {investment.endDate ? (
                <>
                  <Clock className="h-3 w-3 shrink-0" />
                  <span className="truncate">{fmtDate(investment.endDate)}</span>
                </>
              ) : (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-profit animate-pulse" />
                  <span className="text-profit/80">Active</span>
                </>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onView}
            className="border-gold/30 hover:bg-gold/10 hover:text-gold press-scale"
          >
            View Details
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Investments Page                                              */
/* ------------------------------------------------------------------ */

export function InvestorInvestments() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<InvestmentsResponse>({
    queryKey: ["investments"],
    queryFn: () => api.get("/api/investments"),
  });

  // Fetch detail when an investment is selected
  const { data: detailData, isLoading: detailLoading } = useQuery<InvestmentDetailResponse>({
    queryKey: ["investment-detail", selectedId],
    queryFn: () => api.get(`/api/investments/${selectedId}`),
    enabled: !!selectedId,
  });

  const investments = data?.investments ?? [];

  // ─── Summary metrics ───
  const summary = useMemo(() => {
    const activeOrCompleted = investments.filter(
      (i) => i.status === "ACTIVE" || i.status === "COMPLETED"
    );
    const active = investments.filter((i) => i.status === "ACTIVE");
    const totalInvested = activeOrCompleted.reduce((a, i) => a + (i.investedAmount || 0), 0);
    const currentValue = active.reduce((a, i) => a + (i.currentValue || 0), 0);
    const totalPL = investments.reduce((a, i) => a + (i.profitLoss || 0), 0);
    const weightedRoi = totalInvested > 0
      ? investments
          .filter((i) => i.status === "ACTIVE" || i.status === "COMPLETED")
          .reduce((a, i) => a + (i.roiPercent || 0) * (i.investedAmount || 0), 0) / totalInvested
      : 0;
    return {
      totalInvested,
      currentValue,
      totalPL,
      weightedRoi,
      activeCount: active.length,
      totalCount: investments.length,
    };
  }, [investments]);

  const handleView = (id: string) => {
    setSelectedId(id);
  };

  const handleClose = () => {
    setSelectedId(null);
  };

  if (isLoading) return <InvestmentsSkeleton />;

  return (
    <div className="space-y-6">
      {/* ─── 1. Header ─── */}
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">My Investments</h1>
            <p className="text-sm text-muted-foreground">Your active positions and performance</p>
          </div>
          {investments.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/5 px-3 py-1.5">
              <Coins className="h-4 w-4 text-gold" />
              <span className="text-sm font-medium">
                <span className="font-metric text-gold">{summary.activeCount}</span>
                <span className="text-muted-foreground"> of {summary.totalCount} active</span>
              </span>
            </div>
          )}
        </div>
      </FadeIn>

      {/* ─── 2. Summary Metrics ─── */}
      {investments.length > 0 ? (
        <FadeIn delay={0.05}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              label="Total Invested"
              value={fmtUSD(summary.totalInvested)}
              accent="neutral"
              icon={
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10">
                  <Wallet className="h-4 w-4 text-info" />
                </span>
              }
              sub={`${summary.totalCount} position${summary.totalCount === 1 ? "" : "s"}`}
              className="gold-glow-hover"
            />
            <MetricTile
              label="Current Value"
              value={fmtUSD(summary.currentValue)}
              accent="gold"
              icon={
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
                  <Coins className="h-4 w-4 text-gold" />
                </span>
              }
              sub={`${summary.activeCount} active`}
              className="gold-glow-hover"
            />
            <MetricTile
              label="Total P&L"
              value={`${summary.totalPL >= 0 ? "+" : ""}${fmtUSD(summary.totalPL)}`}
              accent={summary.totalPL >= 0 ? "profit" : "loss"}
              icon={
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${summary.totalPL >= 0 ? "bg-profit/10" : "bg-loss/10"}`}>
                  {summary.totalPL >= 0 ? <TrendingUp className="h-4 w-4 text-profit" /> : <TrendingDown className="h-4 w-4 text-loss" />}
                </span>
              }
              sub={summary.totalPL >= 0 ? "Net unrealized gain" : "Net unrealized loss"}
              className="gold-glow-hover"
            />
            <MetricTile
              label="Overall ROI"
              value={fmtPct(summary.weightedRoi)}
              accent={summary.weightedRoi >= 0 ? "profit" : "loss"}
              icon={
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
                  <Target className="h-4 w-4 text-gold" />
                </span>
              }
              sub="Capital-weighted average"
              className="gold-glow-hover"
            />
          </div>
        </FadeIn>
      ) : null}

      {/* ─── 3. Empty state ─── */}
      {investments.length === 0 ? (
        <FadeIn delay={0.1}>
          <GlassCard className="p-6">
            <EmptyState
              icon={<PiggyBank className="h-7 w-7" />}
              title="No Investments Yet"
              description="Your fund administrator will create investment positions for you. Once active, they'll appear here with live performance tracking."
            />
          </GlassCard>
        </FadeIn>
      ) : (
        /* ─── 4. Investment cards grid ─── */
        <FadeIn delay={0.1}>
          <div>
            <SectionTitle
              title="Positions"
              subtitle="Click any position to view detailed performance and history"
              className="mb-4"
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {investments.map((inv, idx) => (
                <InvestmentCard
                  key={inv.id}
                  investment={inv}
                  index={idx}
                  onView={() => handleView(inv.id)}
                />
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {/* ─── 5. Detail dialog ─── */}
      <InvestmentDetailDialog
        investment={detailData?.investment ?? null}
        open={selectedId !== null}
        onOpenChange={(o) => !o && handleClose()}
      />

      {/* Hidden helper to surface detail-loading state without a noisy UI */}
      {detailLoading && selectedId && (
        <div className="sr-only" aria-live="polite">Loading investment details…</div>
      )}
    </div>
  );
}
