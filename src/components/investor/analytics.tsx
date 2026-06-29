"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, MetricTile, SectionTitle, FadeIn } from "@/components/brand/primitives";
import { fmtNum, fmtPct, fmtDate } from "@/lib/format";
import {
  TrendingUp, TrendingDown, Activity, Target, Gauge, Sigma,
  ArrowUp, ArrowDown, Flame, Trophy, AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";

interface AdvancedAnalytics {
  sharpe: number;
  sortino: number;
  calmar: number;
  volatility: number;
  maxDrawdown: number;
  var95: number;
  cvar95: number;
  bestDay: number;
  worstDay: number;
  positiveDaysPct: number;
  avgUpDay: number;
  avgDownDay: number;
  upDownRatio: number;
  currentDrawdown: number;
  drawdownSeries: { date: string; dd: number }[];
  monthlyReturns: { month: string; ret: number }[];
  yearlyReturns: { year: number; ret: number }[];
  rollingSharpe30: number;
  longestWinStreak: number;
  longestLossStreak: number;
  navHistory: { date: string; nav: number; ret: number | null }[];
}

export function AnalyticsPage() {
  const { data, isLoading } = useQuery<{ fund: { name: string }; analytics: AdvancedAnalytics }>({
    queryKey: ["analytics"],
    queryFn: () => api.get("/api/analytics"),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <FadeIn>
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Risk Analytics</h1>
            <p className="text-sm text-muted-foreground">Advanced performance & risk metrics</p>
          </div>
        </FadeIn>
        {/* 4 metric tile skeletons — mirrors loaded grid layout */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="relative h-28 overflow-hidden rounded-xl glass shimmer">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
            </div>
          ))}
        </div>
        {/* 2 chart skeletons — mirrors loaded chart cards */}
        <div className="grid gap-4">
          <div className="relative h-80 overflow-hidden rounded-xl glass shimmer">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
          </div>
          <div className="relative h-80 overflow-hidden rounded-xl glass shimmer">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
          </div>
        </div>
      </div>
    );
  }

  const a = data.analytics;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Risk Analytics</h1>
          <p className="text-sm text-muted-foreground">
            {data.fund.name} · Advanced performance & risk metrics
          </p>
        </div>
      </FadeIn>

      {/* Risk ratio tiles */}
      <FadeIn delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Sharpe Ratio"
            value={fmtNum(a.sharpe, 2)}
            accent="gold"
            icon={<Sigma className="h-4 w-4" />}
            sub="Annualized risk-adjusted return"
          />
          <MetricTile
            label="Sortino Ratio"
            value={fmtNum(a.sortino, 2)}
            accent="gold"
            icon={<Target className="h-4 w-4" />}
            sub="Downside-adjusted return"
          />
          <MetricTile
            label="Calmar Ratio"
            value={fmtNum(a.calmar, 2)}
            accent="gold"
            icon={<Gauge className="h-4 w-4" />}
            sub="CAGR / Max Drawdown"
          />
          <MetricTile
            label="Volatility (Ann.)"
            value={fmtPct(a.volatility)}
            accent={a.volatility > 50 ? "loss" : "gold"}
            icon={<Activity className="h-4 w-4" />}
            sub="Annualized standard deviation"
          />
        </div>
      </FadeIn>

      {/* Drawdown chart */}
      <FadeIn delay={0.1}>
        <GlassCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle
              title="Drawdown Profile"
              subtitle="Underwater curve — peak-to-trough decline over time"
            />
            <div className="flex flex-wrap gap-4 text-right">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Drawdown</div>
                <div className="font-metric text-lg font-bold text-loss">{fmtPct(a.maxDrawdown)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Drawdown</div>
                <div className="font-metric text-lg font-bold text-gold">{fmtPct(a.currentDrawdown)}</div>
              </div>
            </div>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={a.drawdownSeries} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
                  tick={{ fill: "#7A7A7A", fontSize: 11 }}
                  stroke="rgba(255,255,255,0.08)"
                  minTickGap={40}
                />
                <YAxis
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                  tick={{ fill: "#7A7A7A", fontSize: 11 }}
                  stroke="rgba(255,255,255,0.08)"
                  width={56}
                />
                <Tooltip
                  contentStyle={{ background: "rgba(20,20,22,0.95)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: "10px" }}
                  formatter={(v: number) => [`${v.toFixed(2)}%`, "Drawdown"]}
                  labelFormatter={(d) => new Date(d as string).toLocaleDateString()}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                <Area type="monotone" dataKey="dd" stroke="#F59E0B" strokeWidth={1.5} fill="url(#ddGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </FadeIn>

      {/* Monthly returns heatmap */}
      <FadeIn delay={0.15}>
        <GlassCard className="p-5">
          <SectionTitle
            title="Monthly Returns Heatmap"
            subtitle="Performance by calendar month (color intensity = magnitude)"
          />
          <div className="mt-4">
            <MonthlyHeatmap monthly={a.monthlyReturns} />
          </div>
        </GlassCard>
      </FadeIn>

      {/* Daily stats + VaR */}
      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.2}>
          <GlassCard className="p-5">
            <SectionTitle title="Value at Risk" subtitle="1-day, 95% confidence" />
            <div className="mt-4 space-y-3">
              <VarBar label="VaR (95%)" value={a.var95} hint="Max expected daily loss" />
              <VarBar label="CVaR (95%)" value={a.cvar95} hint="Expected loss when VaR is breached" />
              <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-gold">Interpretation</div>
                <div className="mt-1">
                  On a typical day, with 95% confidence, losses should not exceed <span className="text-loss font-medium">{fmtPct(a.var95)}</span>.
                  In the worst 5% of days, the average loss is <span className="text-loss font-medium">{fmtPct(a.cvar95)}</span>.
                </div>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        <FadeIn delay={0.25}>
          <GlassCard className="p-5">
            <SectionTitle title="Daily Statistics" subtitle="Best / worst / averages" />
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Stat label="Best Day" value={fmtPct(a.bestDay)} icon={<Trophy className="h-4 w-4 text-profit" />} accent="profit" />
              <Stat label="Worst Day" value={fmtPct(a.worstDay)} icon={<Flame className="h-4 w-4 text-loss" />} accent="loss" />
              <Stat label="Avg Up Day" value={fmtPct(a.avgUpDay)} icon={<ArrowUp className="h-4 w-4 text-profit" />} accent="profit" />
              <Stat label="Avg Down Day" value={fmtPct(a.avgDownDay)} icon={<ArrowDown className="h-4 w-4 text-loss" />} accent="loss" />
              <Stat label="Win Rate" value={`${a.positiveDaysPct.toFixed(1)}%`} icon={<TrendingUp className="h-4 w-4 text-gold" />} accent="gold" />
              <Stat label="Up/Down Ratio" value={fmtNum(a.upDownRatio, 2)} icon={<Activity className="h-4 w-4 text-gold" />} accent="gold" />
            </div>
          </GlassCard>
        </FadeIn>

        <FadeIn delay={0.3}>
          <GlassCard className="p-5">
            <SectionTitle title="Streaks & Trends" subtitle="Behavioral metrics" />
            <div className="mt-4 space-y-3 text-sm">
              <StreakRow label="Longest Win Streak" value={`${a.longestWinStreak} days`} accent="profit" />
              <StreakRow label="Longest Loss Streak" value={`${a.longestLossStreak} days`} accent="loss" />
              <StreakRow label="Rolling 30-day Sharpe" value={fmtNum(a.rollingSharpe30, 2)} accent="gold" />
              <StreakRow
                label="Calmar Ratio"
                value={fmtNum(a.calmar, 2)}
                accent={a.calmar > 1 ? "profit" : "gold"}
              />
              <div className="rounded-lg border border-border/40 bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Inception to date</div>
                <div className="mt-1 flex items-center gap-2">
                  {a.maxDrawdown < -20 ? (
                    <AlertTriangle className="h-4 w-4 text-gold" />
                  ) : (
                    <Activity className="h-4 w-4 text-gold" />
                  )}
                  <span className="text-sm text-foreground">
                    Endured a <span className="text-loss font-medium">{fmtPct(a.maxDrawdown)}</span> peak drawdown
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </div>

      {/* Yearly returns bar */}
      <FadeIn delay={0.35}>
        <GlassCard className="p-5">
          <SectionTitle title="Annual Returns" subtitle="Year-over-year performance" />
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.yearlyReturns} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="year"
                  tick={{ fill: "#7A7A7A", fontSize: 11 }}
                  stroke="rgba(255,255,255,0.08)"
                />
                <YAxis
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  tick={{ fill: "#7A7A7A", fontSize: 11 }}
                  stroke="rgba(255,255,255,0.08)"
                  width={48}
                />
                <Tooltip
                  cursor={{ fill: "rgba(212,175,55,0.06)" }}
                  contentStyle={{ background: "rgba(20,20,22,0.95)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: "10px" }}
                  formatter={(v: number) => [`${v.toFixed(2)}%`, "Annual Return"]}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" />
                <Bar dataKey="ret" radius={[6, 6, 0, 0]}>
                  {a.yearlyReturns.map((r, i) => (
                    <Cell key={i} fill={r.ret >= 0 ? "#10B981" : "#EF4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </FadeIn>
    </div>
  );
}

// ---------- helpers ----------

function VarBar({ label, value, hint }: { label: string; value: number; hint: string }) {
  // Cap visual at 10% for the bar width
  const widthPct = Math.min(100, Math.abs(value) * 10);
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="font-metric text-sm font-bold text-loss">{fmtPct(value)}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold to-loss"
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function Stat({
  label, value, icon, accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "profit" | "loss" | "gold";
}) {
  const color = accent === "profit" ? "text-profit" : accent === "loss" ? "text-loss" : "text-gold";
  const border = accent === "profit" ? "border-profit/20 bg-profit/5" : accent === "loss" ? "border-loss/20 bg-loss/5" : "border-gold/20 bg-gold/5";
  return (
    <div className={`rounded-lg border ${border} p-3`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className={`mt-1 font-metric text-base font-bold ${color}`}>{value}</div>
    </div>
  );
}

function StreakRow({ label, value, accent }: { label: string; value: string; accent: "profit" | "loss" | "gold" }) {
  const color = accent === "profit" ? "text-profit" : accent === "loss" ? "text-loss" : "text-gold";
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-metric font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function MonthlyHeatmap({ monthly }: { monthly: { month: string; ret: number }[] }) {
  // Group monthly returns into a 4x3 grid (quarter rows × month cols)
  // month format: "YYYY-MM"
  if (!monthly.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/40 bg-black/20 p-6 text-center text-xs text-muted-foreground">
        No monthly data available
      </div>
    );
  }

  // Build year rows
  const years = Array.from(new Set(monthly.map((m) => m.month.split("-")[0]))).sort();
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const getRet = (year: string, monthIdx: number) => {
    const key = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
    return monthly.find((m) => m.month === key)?.ret ?? null;
  };

  const cellColor = (ret: number | null) => {
    if (ret === null) return "bg-black/20 text-muted-foreground/30";
    const abs = Math.min(Math.abs(ret), 15) / 15; // normalize 0..1 (cap at 15%)
    if (ret > 0) {
      // green intensity
      const alpha = 0.15 + abs * 0.7;
      return `text-profit`;
    } else if (ret < 0) {
      return `text-loss`;
    }
    return "text-muted-foreground";
  };

  const cellStyle = (ret: number | null): React.CSSProperties => {
    if (ret === null) return { background: "rgba(255,255,255,0.02)" };
    const abs = Math.min(Math.abs(ret), 15) / 15;
    if (ret > 0) {
      return { background: `rgba(16, 185, 129, ${0.1 + abs * 0.55})` };
    } else if (ret < 0) {
      return { background: `rgba(239, 68, 68, ${0.1 + abs * 0.55})` };
    }
    return { background: "rgba(255,255,255,0.04)" };
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-center text-[11px]">
        <thead>
          <tr>
            <th className="w-12 text-left text-[10px] uppercase tracking-wider text-muted-foreground">Year</th>
            {monthLabels.map((m) => (
              <th key={m} className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">{m}</th>
            ))}
            <th className="px-2 text-[10px] uppercase tracking-wider text-gold">YTD</th>
          </tr>
        </thead>
        <tbody>
          {years.map((year) => {
            const months = Array.from({ length: 12 }, (_, i) => getRet(year, i));
            const valid = months.filter((m): m is number => m !== null);
            const ytd = valid.length > 0
              ? valid.reduce((acc, r) => acc * (1 + r / 100), 1) * 100 - 100
              : null;
            return (
              <tr key={year}>
                <td className="text-left font-medium text-foreground/80">{year}</td>
                {months.map((ret, i) => (
                  <td
                    key={i}
                    className={`h-9 rounded font-metric font-medium ${cellColor(ret)}`}
                    style={cellStyle(ret)}
                    title={`${year}-${monthLabels[i]}: ${ret !== null ? `${ret.toFixed(2)}%` : "no data"}`}
                  >
                    {ret !== null ? `${ret > 0 ? "+" : ""}${ret.toFixed(1)}` : "—"}
                  </td>
                ))}
                <td className="px-2">
                  <span className={`font-metric font-bold ${ytd !== null && ytd >= 0 ? "text-profit" : "text-loss"}`}>
                    {ytd !== null ? `${ytd > 0 ? "+" : ""}${ytd.toFixed(1)}%` : "—"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded" style={{ background: "rgba(239,68,68,0.6)" }} /> Loss
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded" style={{ background: "rgba(255,255,255,0.04)" }} /> Flat
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded" style={{ background: "rgba(16,185,129,0.6)" }} /> Gain
        </div>
        <span className="ml-auto">Color intensity scales with magnitude (capped at 15%)</span>
      </div>
    </div>
  );
}
