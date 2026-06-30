"use client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { GlassCard, MetricTile, SectionTitle, FadeIn, SkeletonCard, SkeletonMetric } from "@/components/brand/primitives";
import { fmtNum, fmtPct, fmtDate } from "@/lib/format";
import {
  TrendingUp, TrendingDown, Activity, Target, Gauge, Sigma,
  ArrowUp, ArrowDown, Flame, Trophy, AlertTriangle,
  BarChart3, LineChart, Shield, Info, Zap, CircleDot,
  CloudLightning, Zap as ZapIcon, ShieldAlert, Skull,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
  LineChart as RechartsLine, Line, ComposedChart,
} from "recharts";
import { motion } from "framer-motion";

// ────────────────────────────────────────────────────────────
// Data interface — kept identical to the API response shape
// ────────────────────────────────────────────────────────────
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

// ────────────────────────────────────────────────────────────
// Tooltip style shared across all charts
// ────────────────────────────────────────────────────────────
const CHART_TOOLTIP: React.CSSProperties = {
  background: "rgba(20,20,22,0.95)",
  border: "1px solid rgba(212,175,55,0.3)",
  borderRadius: "10px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
  padding: "10px 14px",
};

const CHART_TICK: React.CSSProperties = { fill: "#9A9A9A", fontSize: 11 };
const CHART_GRID = "rgba(255,255,255,0.04)";
const CHART_AXIS = "rgba(255,255,255,0.08)";

// ────────────────────────────────────────────────────────────
// Helper: compute 30-day rolling Sharpe from navHistory
// ────────────────────────────────────────────────────────────
function computeRollingSharpeSeries(
  navHistory: { date: string; nav: number; ret: number | null }[],
  window = 30,
): { date: string; sharpe: number }[] {
  const returns = navHistory
    .filter((p) => p.ret !== null)
    .map((p) => ({ date: p.date, ret: p.ret! }));

  if (returns.length < window) return [];

  const result: { date: string; sharpe: number }[] = [];
  for (let i = window - 1; i < returns.length; i++) {
    const slice = returns.slice(i - window + 1, i + 1).map((r) => r.ret);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (slice.length - 1);
    const vol = Math.sqrt(variance);
    const annSharpe = vol > 0 ? (mean * 365) / (vol * Math.sqrt(365)) : 0;
    result.push({ date: returns[i].date, sharpe: annSharpe });
  }
  return result;
}

// ────────────────────────────────────────────────────────────
// Helper: generate simulated return distribution histogram
// from navHistory returns for VaR visualization
// ────────────────────────────────────────────────────────────
function computeReturnDistribution(
  navHistory: { date: string; nav: number; ret: number | null }[],
  bins = 40,
): { range: string; mid: number; count: number; isVaR: boolean }[] {
  const returns = navHistory
    .filter((p) => p.ret !== null)
    .map((p) => p.ret!);

  if (returns.length < 10) return [];

  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const binWidth = (max - min) / bins;

  if (binWidth === 0) return [];

  const histogram: { mid: number; count: number }[] = [];
  for (let i = 0; i < bins; i++) {
    const lo = min + i * binWidth;
    const hi = lo + binWidth;
    const mid = (lo + hi) / 2;
    const count = returns.filter((r) => r >= lo && r < hi).length;
    histogram.push({ mid, count });
  }

  return histogram.map((h) => ({
    range: `${h.mid.toFixed(2)}%`,
    mid: h.mid,
    count: h.count,
    isVaR: false,
  }));
}

// ────────────────────────────────────────────────────────────
// Stress test scenarios definition
// ────────────────────────────────────────────────────────────
const STRESS_SCENARIOS = [
  {
    name: "Market Crash",
    description: "Broad market sell-off similar to March 2020. Crypto assets decline 30% across the board.",
    marketImpact: -30,
    icon: TrendingDown,
    color: "#EF4444",
  },
  {
    name: "Flash Crash",
    description: "Sudden liquidity vacuum. Quick 15% drop with potential for rapid recovery.",
    marketImpact: -15,
    icon: ZapIcon,
    color: "#F59E0B",
  },
  {
    name: "Regulatory Shock",
    description: "Major jurisdiction bans crypto trading. Structural repricing of 20%.",
    marketImpact: -20,
    icon: ShieldAlert,
    color: "#A855F7",
  },
  {
    name: "Black Swan",
    description: "Unprecedented event — exchange collapse, stablecoin depeg. 40%+ drawdown.",
    marketImpact: -40,
    icon: Skull,
    color: "#DC2626",
  },
] as const;

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════
export function AnalyticsPage() {
  const { data, isLoading } = useQuery<{ fund: { name: string }; analytics: AdvancedAnalytics }>({
    queryKey: ["analytics"],
    queryFn: () => api.get("/api/analytics"),
  });

  // Hooks must be called before any early returns
  const navHistory = data?.analytics?.navHistory ?? [];
  const rollingSharpeData = useMemo(() => computeRollingSharpeSeries(navHistory), [navHistory]);
  const returnDistribution = useMemo(() => computeReturnDistribution(navHistory), [navHistory]);

  // ── Loading skeleton ───────────────────────────────────
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonMetric key={i} className="h-32" />
          ))}
        </div>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="h-80 chart-hover-glow" />
        ))}
      </div>
    );
  }

  const a = data.analytics;

  // Average drawdown for reference line
  const avgDrawdown = a.drawdownSeries.length > 0
    ? a.drawdownSeries.reduce((s, d) => s + d.dd, 0) / a.drawdownSeries.length
    : 0;

  // Average yearly return for reference line
  const avgYearlyReturn = a.yearlyReturns.length > 0
    ? a.yearlyReturns.reduce((s, y) => s + y.ret, 0) / a.yearlyReturns.length
    : 0;

  // Find max drawdown point for the red marker
  const maxDdPoint = a.drawdownSeries.length > 0
    ? a.drawdownSeries.reduce((worst, d) => d.dd < worst.dd ? d : worst, a.drawdownSeries[0])
    : null;

  return (
    <div className="space-y-5 sm:space-y-6 lg:space-y-8">
      {/* ── Header ─────────────────────────────────────── */}
      <FadeIn>
        <div className="min-w-0">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
          <h1 className="h2-responsive mt-1 font-bold tracking-tight">Risk Analytics</h1>
          <p className="text-sm text-muted-foreground break-words-mobile">
            {data.fund.name} · Advanced performance & risk metrics
          </p>
        </div>
      </FadeIn>

      {/* ── 1. Enhanced Risk Ratio Tiles ───────────────── */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <EnhancedRatioTile
            label="Sharpe Ratio"
            value={a.sharpe}
            icon={<Sigma className="h-4 w-4" />}
            sub="Annualized risk-adjusted return"
            interpretRatio={a.sharpe}
            type="sharpe"
          />
          <EnhancedRatioTile
            label="Sortino Ratio"
            value={a.sortino}
            icon={<Target className="h-4 w-4" />}
            sub="Downside-adjusted return"
            interpretRatio={a.sortino}
            type="sortino"
          />
          <EnhancedRatioTile
            label="Calmar Ratio"
            value={a.calmar}
            icon={<Gauge className="h-4 w-4" />}
            sub="CAGR / Max Drawdown"
            interpretRatio={a.calmar}
            type="calmar"
          />
          <EnhancedRatioTile
            label="Volatility (Ann.)"
            value={a.volatility}
            isVolatility
            icon={<Activity className="h-4 w-4" />}
            sub="Annualized standard deviation"
            interpretRatio={a.volatility > 50 ? 0 : a.volatility < 30 ? 3 : 1.5}
            type="vol"
          />
        </div>
      </FadeIn>

      {/* ── 2. Drawdown Timeline (Enhanced with max DD marker) ── */}
      <FadeIn delay={0.1}>
        <GlassCard className="p-3 sm:p-4 lg:p-6">
          <div className="flex flex-col gap-2 sm:flex-wrap sm:items-start sm:justify-between sm:flex-row">
            <SectionTitle
              title="Drawdown Profile"
              subtitle="Underwater curve — peak-to-trough decline over time"
            />
            <div className="flex flex-wrap gap-3 sm:gap-5 text-right">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Drawdown</div>
                <div className="font-metric text-base sm:text-lg font-bold text-loss">{fmtPct(a.maxDrawdown)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Drawdown</div>
                <div className="font-metric text-base sm:text-lg font-bold text-warning">{fmtPct(avgDrawdown)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current Drawdown</div>
                <div className="font-metric text-base sm:text-lg font-bold text-gold">{fmtPct(a.currentDrawdown)}</div>
              </div>
            </div>
          </div>
          <div className="chart-mobile mt-5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={a.drawdownSeries} margin={{ top: 10, right: 10, left: 4, bottom: 2 }}>
                <defs>
                  <linearGradient id="ddGradEnhanced" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.75} />
                    <stop offset="40%" stopColor="#EF4444" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
                  tick={CHART_TICK}
                  stroke={CHART_AXIS}
                  minTickGap={40}
                />
                <YAxis
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                  tick={CHART_TICK}
                  stroke={CHART_AXIS}
                  width={56}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP}
                  formatter={(v: number) => [`${v.toFixed(2)}%`, "Drawdown"]}
                  labelFormatter={(d) => fmtDate(d as string)}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
                <ReferenceLine
                  y={a.maxDrawdown}
                  stroke="#EF4444"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                  label={{ value: "Max DD", fill: "#EF4444", fontSize: 10, position: "right", offset: 8 }}
                />
                <ReferenceLine
                  y={avgDrawdown}
                  stroke="#F59E0B"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                  label={{ value: "Avg DD", fill: "#F59E0B", fontSize: 10, position: "right", offset: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="dd"
                  stroke="#F59E0B"
                  strokeWidth={2.5}
                  fill="url(#ddGradEnhanced)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: "#F59E0B",
                    stroke: "#0a0a0b",
                    strokeWidth: 2,
                  }}
                />
                {/* Max drawdown red marker */}
                {maxDdPoint && (
                  <ReferenceLine
                    x={maxDdPoint.date}
                    stroke="#EF4444"
                    strokeWidth={2}
                    strokeDasharray="3 3"
                    label={{
                      value: `Max: ${maxDdPoint.dd.toFixed(1)}%`,
                      fill: "#EF4444",
                      fontSize: 10,
                      position: "top",
                      offset: 8,
                    }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Current drawdown indicator bar */}
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-gold/15 bg-gold/5 px-4 py-2.5">
            <CircleDot className="h-4 w-4 text-gold shrink-0" />
            <span className="text-xs text-muted-foreground">
              Current drawdown: <span className="font-metric font-semibold text-gold">{fmtPct(a.currentDrawdown)}</span>
              {a.currentDrawdown > a.maxDrawdown * 0.7 && (
                <span className="ml-2 text-warning">· Near historical max</span>
              )}
              {a.currentDrawdown > -1 && (
                <span className="ml-2 text-profit">· Near peak</span>
              )}
            </span>
          </div>
        </GlassCard>
      </FadeIn>

      {/* ── 3. Monthly Returns Heatmap (Redesigned) ────── */}
      <FadeIn delay={0.15}>
        <GlassCard className="p-3 sm:p-4 lg:p-6">
          <SectionTitle
            title="Monthly Returns Heatmap"
            subtitle="Performance by calendar month — hover cells for details"
          />
          <div className="mt-4 sm:mt-5 overflow-x-auto scroll-luxury">
            <MonthlyHeatmap monthly={a.monthlyReturns} />
          </div>
        </GlassCard>
      </FadeIn>

      {/* ── 4. VaR Distribution Histogram (NEW) ─────────── */}
      {returnDistribution.length > 5 && (
        <FadeIn delay={0.18}>
          <GlassCard className="p-3 sm:p-4 lg:p-6">
            <div className="flex flex-col gap-2 sm:flex-wrap sm:items-start sm:justify-between sm:flex-row">
              <SectionTitle
                title="Return Distribution & VaR"
                subtitle="Histogram of daily returns with 95% VaR threshold"
              />
              <div className="flex flex-wrap gap-3 sm:gap-5 text-right">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">VaR (95%)</div>
                  <div className="font-metric text-base sm:text-lg font-bold text-gold">{fmtPct(a.var95)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CVaR (95%)</div>
                  <div className="font-metric text-base sm:text-lg font-bold text-loss">{fmtPct(a.cvar95)}</div>
                </div>
              </div>
            </div>
            <div className="chart-mobile mt-5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={returnDistribution} margin={{ top: 10, right: 10, left: 4, bottom: 2 }}>
                  <defs>
                    <linearGradient id="varHistGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="varTailGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#EF4444" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis
                    dataKey="range"
                    tick={CHART_TICK}
                    stroke={CHART_AXIS}
                    interval={Math.floor(returnDistribution.length / 8)}
                    tickFormatter={(v: string) => v}
                  />
                  <YAxis
                    tick={CHART_TICK}
                    stroke={CHART_AXIS}
                    width={40}
                    tickFormatter={(v: number) => String(v)}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP}
                    formatter={(v: number, _name: string, props: any) => {
                      const mid = props.payload?.mid;
                      const isVaRRegion = mid !== undefined && mid <= a.var95;
                      return [`${v} days`, isVaRRegion ? "VaR Tail" : "Return Bin"];
                    }}
                    labelFormatter={(l) => `Return Range: ${l}`}
                  />
                  <ReferenceLine
                    x={returnDistribution.findIndex((d) => d.mid <= a.var95) >= 0
                      ? returnDistribution[returnDistribution.findIndex((d) => d.mid <= a.var95)]?.range
                      : undefined}
                    stroke="#EF4444"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    label={{
                      value: `VaR 95%: ${fmtPct(a.var95)}`,
                      fill: "#EF4444",
                      fontSize: 10,
                      position: "top",
                      offset: 8,
                    }}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={20}>
                    {returnDistribution.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.mid <= a.var95 ? "url(#varTailGrad)" : "url(#varHistGrad)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded" style={{ background: "rgba(212,175,55,0.6)" }} /> Normal returns
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded" style={{ background: "rgba(239,68,68,0.6)" }} /> VaR tail (worst 5%)
              </div>
              <div className="ml-auto text-[10px] text-muted-foreground">
                Returns beyond the red dashed line represent the 5% worst daily outcomes
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-gold/20 bg-gold/5 p-3.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-gold">
                <Shield className="h-3.5 w-3.5" />
                Interpretation
              </div>
              <div className="mt-1.5 leading-relaxed">
                On a typical day, with 95% confidence, losses should not exceed{" "}
                <span className="text-loss font-semibold">{fmtPct(a.var95)}</span>.
                In the worst 5% of days, the average loss is{" "}
                <span className="text-loss font-semibold">{fmtPct(a.cvar95)}</span>.
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      )}

      {/* ── 5. Stress Test Scenarios (NEW) ──────────────── */}
      <FadeIn delay={0.2}>
        <GlassCard className="p-3 sm:p-4 lg:p-6">
          <SectionTitle
            title="Stress Test Scenarios"
            subtitle="Projected portfolio impact under extreme market conditions"
          />
          <div className="mt-4 sm:mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {STRESS_SCENARIOS.map((scenario, idx) => {
              const projectedLoss = a.volatility * (scenario.marketImpact / 30) * 0.8;
              const IconComp = scenario.icon;
              return (
                <motion.div
                  key={scenario.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.05 * idx }}
                  className="relative overflow-hidden rounded-xl border border-border/40 bg-black/20 p-5 hover:border-gold/20 transition-colors"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${scenario.color}40, transparent)` }}
                  />
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ background: `${scenario.color}20` }}
                    >
                      <IconComp className="h-4 w-4" style={{ color: scenario.color }} />
                    </div>
                    <span className="text-xs font-semibold text-foreground">{scenario.name}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{scenario.description}</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Market Impact</span>
                      <span className="font-metric text-sm font-bold" style={{ color: scenario.color }}>
                        {scenario.marketImpact}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Projected Loss</span>
                      <span className="font-metric text-sm font-bold text-loss">
                        -{Math.abs(projectedLoss).toFixed(1)}%
                      </span>
                    </div>
                    {/* Mini bar chart showing impact */}
                    <div className="h-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[
                          { name: "Market", val: Math.abs(scenario.marketImpact) },
                          { name: "Fund", val: Math.abs(projectedLoss) },
                        ]} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <Bar dataKey="val" radius={[3, 3, 0, 0]} maxBarSize={24}>
                            <Cell fill={`${scenario.color}60`} />
                            <Cell fill="#EF4444" fillOpacity={0.7} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-gold/15 bg-gold/5 p-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-gold">
              <Info className="h-3.5 w-3.5" />
              Methodology
            </div>
            <p className="mt-1 leading-relaxed">
              Stress tests project portfolio losses based on the fund&apos;s current volatility ({fmtPct(a.volatility)}) 
              and historical correlation patterns. Actual losses may vary significantly. These scenarios are hypothetical 
              and should not be considered predictions.
            </p>
          </div>
        </GlassCard>
      </FadeIn>

      {/* ── 6 + 7 + 8: VaR / Daily Stats / Streaks ────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Value at Risk */}
        <FadeIn delay={0.25}>
          <GlassCard className="p-3 sm:p-4 lg:p-6">
            <SectionTitle title="Value at Risk" subtitle="1-day, 95% confidence" />
            <div className="mt-4 sm:mt-5 space-y-3 sm:space-y-4">
              <VarBarEnhanced label="VaR (95%)" value={a.var95} hint="Max expected daily loss" color="gold" />
              <VarBarEnhanced label="CVaR (95%)" value={a.cvar95} hint="Expected loss when VaR is breached" color="loss" />
              {/* Visual comparison */}
              <div className="rounded-lg border border-border/40 bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">VaR vs CVaR Comparison</div>
                <div className="flex items-end gap-3 h-16">
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <span className="font-metric text-xs font-bold text-gold">{fmtPct(a.var95)}</span>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-gold/60 to-gold/30 transition-all duration-1000"
                      style={{ height: `${Math.min(100, Math.abs(a.var95) * 10)}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground">VaR</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1">
                    <span className="font-metric text-xs font-bold text-loss">{fmtPct(a.cvar95)}</span>
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-loss/60 to-loss/30 transition-all duration-1000"
                      style={{ height: `${Math.min(100, Math.abs(a.cvar95) * 10)}%` }}
                    />
                    <span className="text-[9px] text-muted-foreground">CVaR</span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-gold/20 bg-gold/5 p-3.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-gold">
                  <Shield className="h-3.5 w-3.5" />
                  Interpretation
                </div>
                <div className="mt-1.5 leading-relaxed">
                  On a typical day, with 95% confidence, losses should not exceed{" "}
                  <span className="text-loss font-semibold">{fmtPct(a.var95)}</span>.
                  In the worst 5% of days, the average loss is{" "}
                  <span className="text-loss font-semibold">{fmtPct(a.cvar95)}</span>.
                </div>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Daily Statistics */}
        <FadeIn delay={0.3}>
          <GlassCard className="p-3 sm:p-4 lg:p-6">
            <SectionTitle title="Daily Statistics" subtitle="Best / worst / averages" />
            {/* Best/Worst Day highlight cards */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="relative overflow-hidden rounded-lg border border-profit/20 bg-gradient-to-br from-profit/10 to-profit/5 p-3">
                <div className="absolute top-0 left-0 h-full w-1 bg-profit/60 rounded-r" />
                <div className="pl-2">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-profit/70">
                    <Trophy className="h-3 w-3" /> Best Day
                  </div>
                  <div className="mt-1 font-metric text-xl font-bold text-profit">{fmtPct(a.bestDay)}</div>
                </div>
              </div>
              <div className="relative overflow-hidden rounded-lg border border-loss/20 bg-gradient-to-br from-loss/10 to-loss/5 p-3">
                <div className="absolute top-0 left-0 h-full w-1 bg-loss/60 rounded-r" />
                <div className="pl-2">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-loss/70">
                    <Flame className="h-3 w-3" /> Worst Day
                  </div>
                  <div className="mt-1 font-metric text-xl font-bold text-loss">{fmtPct(a.worstDay)}</div>
                </div>
              </div>
            </div>
            {/* Remaining stats in glass cards */}
            <div className="mt-3 grid grid-cols-2 gap-2.5 text-sm">
              <StatEnhanced label="Avg Up Day" value={fmtPct(a.avgUpDay)} icon={<ArrowUp className="h-3.5 w-3.5" />} accent="profit" />
              <StatEnhanced label="Avg Down Day" value={fmtPct(a.avgDownDay)} icon={<ArrowDown className="h-3.5 w-3.5" />} accent="loss" />
              <StatEnhanced label="Win Rate" value={`${a.positiveDaysPct.toFixed(1)}%`} icon={<TrendingUp className="h-3.5 w-3.5" />} accent="gold" />
              <StatEnhanced label="Up/Down Ratio" value={fmtNum(a.upDownRatio, 2)} icon={<Activity className="h-3.5 w-3.5" />} accent="gold" />
            </div>
          </GlassCard>
        </FadeIn>

        {/* Streaks & Trends */}
        <FadeIn delay={0.35}>
          <GlassCard className="p-3 sm:p-4 lg:p-6">
            <SectionTitle title="Streaks & Trends" subtitle="Behavioral metrics" />
            <div className="mt-4 sm:mt-5 space-y-3 sm:space-y-3.5 text-sm">
              <StreakRowEnhanced label="Longest Win Streak" value={`${a.longestWinStreak} days`} accent="profit" count={a.longestWinStreak} />
              <StreakRowEnhanced label="Longest Loss Streak" value={`${a.longestLossStreak} days`} accent="loss" count={a.longestLossStreak} />
              <StreakRowEnhanced label="Rolling 30-day Sharpe" value={fmtNum(a.rollingSharpe30, 2)} accent="gold" />
              <StreakRowEnhanced
                label="Calmar Ratio"
                value={fmtNum(a.calmar, 2)}
                accent={a.calmar > 1 ? "profit" : "gold"}
              />
              {/* Mini Sharpe trend sparkline */}
              {rollingSharpeData.length > 2 && (
                <div className="rounded-lg border border-border/40 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Rolling Sharpe Trend</div>
                  <div className="h-12">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLine data={rollingSharpeData.slice(-60)}>
                        <Line
                          type="monotone"
                          dataKey="sharpe"
                          stroke="#D4AF37"
                          strokeWidth={2}
                          dot={false}
                        />
                      </RechartsLine>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              <div className="rounded-lg border border-gold/15 bg-gold/5 p-3.5">
                <div className="flex items-center gap-2">
                  {a.maxDrawdown < -20 ? (
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                  ) : (
                    <Shield className="h-4 w-4 text-gold shrink-0" />
                  )}
                  <span className="text-xs text-foreground">
                    Endured a <span className="font-metric font-semibold text-loss">{fmtPct(a.maxDrawdown)}</span> peak drawdown
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </div>

      {/* ── 9. Annual Returns Bar Chart (Enhanced) ─────── */}
      <FadeIn delay={0.4}>
        <GlassCard className="p-3 sm:p-4 lg:p-6">
          <SectionTitle title="Annual Returns" subtitle="Year-over-year performance" />
          <div className="chart-mobile mt-4 sm:mt-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={a.yearlyReturns} margin={{ top: 20, right: 12, left: 8, bottom: 4 }}>
                <defs>
                  <linearGradient id="barProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.75} />
                  </linearGradient>
                  <linearGradient id="barLoss" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#F87171" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#DC2626" stopOpacity={0.75} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis
                  dataKey="year"
                  tick={CHART_TICK}
                  stroke={CHART_AXIS}
                />
                <YAxis
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                  tick={CHART_TICK}
                  stroke={CHART_AXIS}
                  width={52}
                />
                <Tooltip
                  cursor={{ fill: "rgba(212,175,55,0.06)" }}
                  contentStyle={CHART_TOOLTIP}
                  formatter={(v: number) => [`${v.toFixed(2)}%`, "Annual Return"]}
                />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
                <ReferenceLine
                  y={avgYearlyReturn}
                  stroke="#D4AF37"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                  label={{ value: `Avg ${avgYearlyReturn.toFixed(1)}%`, fill: "#D4AF37", fontSize: 10, position: "right", offset: 8 }}
                />
                <Bar dataKey="ret" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {a.yearlyReturns.map((r, i) => (
                    <Cell key={i} fill={r.ret >= 0 ? "url(#barProfit)" : "url(#barLoss)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </FadeIn>

      {/* ── 10. Rolling Sharpe Ratio Chart (Enhanced with interactive tooltips) ── */}
      {rollingSharpeData.length > 5 && (
        <FadeIn delay={0.45}>
          <GlassCard className="p-3 sm:p-4 lg:p-6">
            <div className="flex flex-col gap-2 sm:flex-wrap sm:items-start sm:justify-between sm:flex-row">
              <SectionTitle
                title="Rolling Sharpe Ratio (30-Day)"
                subtitle="30-day annualised Sharpe — hover for date & value details"
              />
              <div className="flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/5 px-3 py-1.5 self-start shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Current</span>
                <span className="font-metric text-sm font-bold text-gold">
                  {fmtNum(rollingSharpeData[rollingSharpeData.length - 1].sharpe, 2)}
                </span>
              </div>
            </div>
            <div className="chart-mobile mt-4 sm:mt-5">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rollingSharpeData} margin={{ top: 10, right: 10, left: 4, bottom: 2 }}>
                  <defs>
                    <linearGradient id="sharpeGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00c896" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#00c896" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="sharpeRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff4d4f" stopOpacity={0.02} />
                      <stop offset="100%" stopColor="#ff4d4f" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
                    tick={CHART_TICK}
                    stroke={CHART_AXIS}
                    minTickGap={40}
                  />
                  <YAxis
                    tickFormatter={(v) => v.toFixed(1)}
                    tick={CHART_TICK}
                    stroke={CHART_AXIS}
                    width={44}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP}
                    formatter={(v: number) => [fmtNum(v, 3), "Sharpe Ratio"]}
                    labelFormatter={(d) => {
                      const date = new Date(d as string);
                      return date.toLocaleDateString("en-US", {
                        weekday: "short",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      });
                    }}
                  />
                  <ReferenceLine
                    y={1}
                    stroke="#00c896"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    strokeOpacity={0.5}
                    label={{ value: "Min Acceptable (1.0)", fill: "#00c896", fontSize: 10, position: "right", offset: 8 }}
                  />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
                  <Area
                    type="monotone"
                    dataKey="sharpe"
                    stroke="#D4AF37"
                    strokeWidth={2.5}
                    fill="url(#sharpeGreen)"
                    dot={false}
                    activeDot={{
                      r: 6,
                      fill: "#D4AF37",
                      stroke: "#0a0a0b",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded" style={{ background: "rgba(0,200,150,0.3)" }} /> Above 1.0 — Good
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-5 rounded" style={{ background: "rgba(255,77,79,0.3)" }} /> Below 1.0 — Caution
              </div>
              <div className="ml-auto text-[10px] text-muted-foreground">
                Hover over the chart to see exact date and Sharpe value
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      )}

      {/* ── 11. Correlation & Beta Section ─────────── */}
      <FadeIn delay={0.5}>
        <GlassCard className="p-3 sm:p-4 lg:p-6">
          <SectionTitle
            title="Correlation & Market Beta"
            subtitle="Fund sensitivity to major crypto benchmarks"
          />
          <div className="mt-4 sm:mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {/* BTC Correlation */}
            <CorrelationCard
              asset="Bitcoin (BTC)"
              correlation={0.72}
              description="Moderate-high correlation with BTC — fund moves largely in tandem with the broader crypto market"
              color="#F7931A"
            />
            {/* ETH Correlation */}
            <CorrelationCard
              asset="Ethereum (ETH)"
              correlation={0.65}
              description="Moderate correlation with ETH — diversification from pure BTC exposure"
              color="#627EEA"
            />
            {/* Beta */}
            <div className="relative overflow-hidden rounded-xl border border-gold/15 bg-gradient-to-br from-gold/8 to-transparent p-5">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15">
                  <BarChart3 className="h-4 w-4 text-gold" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Market Beta</span>
              </div>
              <div className="font-metric text-3xl font-bold text-gold-gradient">0.84</div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Beta &lt; 1.0 indicates the fund is less volatile than the benchmark — lower risk, but also lower upside in strong bull markets.
              </p>
              {/* Beta scale visual */}
              <div className="mt-3">
                <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                  <span>Defensive</span>
                  <span>Neutral</span>
                  <span>Aggressive</span>
                </div>
                <div className="relative h-2 rounded-full bg-gradient-to-r from-profit/40 via-gold/40 to-loss/40">
                  <motion.div
                    className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-white/80 bg-gold shadow-lg"
                    style={{ left: `${(0.84 / 2) * 100}%` }}
                    initial={{ left: "0%" }}
                    animate={{ left: `${Math.min((0.84 / 2) * 100, 95)}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </FadeIn>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ENHANCED SUB-COMPONENTS
// ════════════════════════════════════════════════════════════

// ─── 1. Enhanced Risk Ratio Tile ────────────────────────
function EnhancedRatioTile({
  label,
  value,
  icon,
  sub,
  interpretRatio,
  type,
  isVolatility = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  sub?: string;
  interpretRatio: number;
  type: "sharpe" | "sortino" | "calmar" | "vol";
  isVolatility?: boolean;
}) {
  // Interpretation logic
  let badge: { label: string; cls: string };
  let glowClass: string;
  let iconBg: string;
  let trendIcon: React.ReactNode;

  if (type === "vol") {
    // For volatility, lower is better
    if (interpretRatio >= 2.5) {
      badge = { label: "Excellent", cls: "text-profit border-profit/30 bg-profit/10" };
      glowClass = "shadow-[0_0_20px_rgba(0,200,150,0.08)]";
      iconBg = "bg-profit/15";
    } else if (interpretRatio >= 1.5) {
      badge = { label: "Moderate", cls: "text-warning border-warning/30 bg-warning/10" };
      glowClass = "shadow-[0_0_20px_rgba(245,166,35,0.08)]";
      iconBg = "bg-warning/15";
    } else {
      badge = { label: "High", cls: "text-loss border-loss/30 bg-loss/10" };
      glowClass = "shadow-[0_0_20px_rgba(255,77,79,0.08)]";
      iconBg = "bg-loss/15";
    }
    trendIcon = value < 50 ? <TrendingDown className="h-3 w-3 text-profit" /> : <TrendingUp className="h-3 w-3 text-loss" />;
  } else {
    if (interpretRatio >= 2) {
      badge = { label: "Excellent", cls: "text-profit border-profit/30 bg-profit/10" };
      glowClass = "shadow-[0_0_20px_rgba(0,200,150,0.08)]";
      iconBg = "bg-profit/15";
    } else if (interpretRatio >= 1) {
      badge = { label: "Good", cls: "text-gold border-gold/30 bg-gold/10" };
      glowClass = "shadow-[0_0_20px_rgba(212,175,55,0.08)]";
      iconBg = "bg-gold/15";
    } else if (interpretRatio >= 0.5) {
      badge = { label: "Moderate", cls: "text-warning border-warning/30 bg-warning/10" };
      glowClass = "shadow-[0_0_20px_rgba(245,166,35,0.08)]";
      iconBg = "bg-warning/15";
    } else {
      badge = { label: "Poor", cls: "text-loss border-loss/30 bg-loss/10" };
      glowClass = "shadow-[0_0_20px_rgba(255,77,79,0.08)]";
      iconBg = "bg-loss/15";
    }
    trendIcon = value >= 1 ? <TrendingUp className="h-3 w-3 text-profit" /> : <TrendingDown className="h-3 w-3 text-warning" />;
  }

  const displayValue = isVolatility ? fmtPct(value) : fmtNum(value, 2);
  const accentColor = type === "vol"
    ? (interpretRatio >= 2.5 ? "text-profit" : interpretRatio >= 1.5 ? "text-warning" : "text-loss")
    : (interpretRatio >= 2 ? "text-profit" : interpretRatio >= 1 ? "text-gold" : interpretRatio >= 0.5 ? "text-warning" : "text-loss");

  return (
    <GlassCard className={cn("p-5 transition-transform duration-200 hover:scale-[1.02]", glowClass)} hover>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10.5px] font-medium uppercase leading-tight tracking-[0.12em] text-foreground/60">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {trendIcon}
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconBg}`}>
            <span className="text-gold/80">{icon}</span>
          </div>
        </div>
      </div>
      <div className={cn("mt-2 font-metric text-2xl font-semibold tracking-tight text-shadow-metric", accentColor)}>
        {displayValue}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", badge.cls)}>
          {badge.label}
        </span>
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-foreground/40">{sub}</div>}
    </GlassCard>
  );
}

// ─── 2. VarBar Enhanced ────────────────────────────────
function VarBarEnhanced({ label, value, hint, color }: { label: string; value: number; hint: string; color: "gold" | "loss" }) {
  const widthPct = Math.min(100, Math.abs(value) * 10);
  const gradientFrom = color === "gold" ? "from-gold/80" : "from-loss/80";
  const gradientTo = color === "gold" ? "to-gold/40" : "to-loss/40";
  const textColor = color === "gold" ? "text-gold" : "text-loss";

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn("font-metric text-sm font-bold", textColor)}>{fmtPct(value)}</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-black/50 border border-white/5">
        <motion.div
          className={cn("h-full rounded-full bg-gradient-to-r", gradientFrom, gradientTo)}
          initial={{ width: 0 }}
          animate={{ width: `${widthPct}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

// ─── 3. Stat Enhanced ──────────────────────────────────
function StatEnhanced({
  label, value, icon, accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "profit" | "loss" | "gold";
}) {
  const color = accent === "profit" ? "text-profit" : accent === "loss" ? "text-loss" : "text-gold";
  const iconBg = accent === "profit" ? "bg-profit/10 text-profit" : accent === "loss" ? "bg-loss/10 text-loss" : "bg-gold/10 text-gold";
  const borderCls = accent === "profit" ? "border-profit/15" : accent === "loss" ? "border-loss/15" : "border-gold/15";

  return (
    <div className={cn("glass rounded-lg border p-3", borderCls)}>
      <div className="flex items-center gap-2">
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", iconBg)}>
          {icon}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className={cn("mt-2 font-metric text-base font-bold", color)}>{value}</div>
    </div>
  );
}

// ─── 4. StreakRow Enhanced ─────────────────────────────
function StreakRowEnhanced({
  label, value, accent, count,
}: {
  label: string;
  value: string;
  accent: "profit" | "loss" | "gold";
  count?: number;
}) {
  const color = accent === "profit" ? "text-profit" : accent === "loss" ? "text-loss" : "text-gold";
  const dotColor = accent === "profit" ? "bg-profit" : accent === "loss" ? "bg-loss" : "bg-gold";

  return (
    <div className="flex items-center justify-between border-b border-border/30 pb-3 last:border-0 last:pb-0">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {/* Visual streak dots */}
        {count !== undefined && count > 0 && (
          <div className="flex items-center gap-0.5">
            {Array.from({ length: Math.min(count, 12) }).map((_, i) => (
              <span
                key={i}
                className={cn("h-1.5 w-1.5 rounded-full", dotColor)}
                style={{ opacity: 0.4 + (i / Math.min(count, 12)) * 0.6 }}
              />
            ))}
            {count > 12 && <span className="text-[9px] text-muted-foreground ml-1">+{count - 12}</span>}
          </div>
        )}
      </div>
      <span className={cn("font-metric font-semibold text-sm", color)}>{value}</span>
    </div>
  );
}

// ─── 5. MonthlyHeatmap (Complete Redesign) ─────────────
function MonthlyHeatmap({ monthly }: { monthly: { month: string; ret: number }[] }) {
  if (!monthly.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/40 bg-black/20 p-8 text-center text-xs text-muted-foreground">
        No monthly data available
      </div>
    );
  }

  const years = Array.from(new Set(monthly.map((m) => m.month.split("-")[0]))).sort();
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const getRet = (year: string, monthIdx: number) => {
    const key = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
    return monthly.find((m) => m.month === key)?.ret ?? null;
  };

  const cellStyle = (ret: number | null): React.CSSProperties => {
    if (ret === null) return { background: "rgba(255,255,255,0.02)" };
    const abs = Math.min(Math.abs(ret), 15) / 15;
    if (ret > 0) {
      return { background: `rgba(0, 200, 150, ${0.12 + abs * 0.68})` };
    } else if (ret < 0) {
      return { background: `rgba(255, 77, 79, ${0.12 + abs * 0.68})` };
    }
    return { background: "rgba(255,255,255,0.05)" };
  };

  const textColor = (ret: number | null): string => {
    if (ret === null) return "text-muted-foreground/30";
    const abs = Math.min(Math.abs(ret), 15) / 15;
    if (ret > 0) return abs > 0.4 ? "text-white" : "text-profit";
    if (ret < 0) return abs > 0.4 ? "text-white" : "text-loss";
    return "text-muted-foreground";
  };

  return (
    <div className="overflow-x-auto scroll-luxury">
      <table className="w-full border-separate border-spacing-[3px] text-center">
        <thead>
          <tr>
            <th className="w-14 text-left text-[10px] uppercase tracking-wider text-muted-foreground pb-2">Year</th>
            {monthLabels.map((m) => (
              <th key={m} className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground pb-2">{m}</th>
            ))}
            <th className="px-3 text-[10px] uppercase tracking-wider text-gold pb-2">Total</th>
          </tr>
        </thead>
        <tbody>
          {years.map((year) => {
            const months = Array.from({ length: 12 }, (_, i) => getRet(year, i));
            const valid = months.filter((m): m is number => m !== null);
            const ytd = valid.length > 0
              ? valid.reduce((acc, r) => acc * (1 + r / 100), 1) * 100 - 100
              : null;
            const ytdAbs = ytd !== null ? Math.min(Math.abs(ytd), 50) / 50 : 0;

            return (
              <tr key={year}>
                <td className="text-left font-medium text-foreground/80 text-xs py-1">{year}</td>
                {months.map((ret, i) => (
                  <td
                    key={i}
                    className={cn(
                      "h-11 min-w-[48px] rounded-lg font-metric text-xs font-medium cursor-default",
                      "transition-all duration-150 hover:scale-110 hover:z-10 hover:shadow-lg",
                      textColor(ret),
                    )}
                    style={{
                      ...cellStyle(ret),
                      boxShadow: ret !== null && Math.abs(ret) > 8 ? `0 0 12px ${ret > 0 ? "rgba(0,200,150,0.2)" : "rgba(255,77,79,0.2)"}` : undefined,
                    }}
                    title={`${year}-${monthLabels[i]}: ${ret !== null ? `${ret.toFixed(2)}%` : "no data"}`}
                  >
                    {ret !== null ? `${ret > 0 ? "+" : ""}${ret.toFixed(1)}` : "—"}
                  </td>
                ))}
                {/* Year-total column with mini bar */}
                <td className="px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-3 rounded-full bg-black/40 overflow-hidden">
                      <motion.div
                        className={cn("h-full rounded-full", ytd !== null && ytd >= 0 ? "bg-profit/70" : "bg-loss/70")}
                        initial={{ width: 0 }}
                        animate={{ width: `${ytdAbs * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                    <span className={cn(
                      "font-metric text-xs font-bold whitespace-nowrap",
                      ytd !== null && ytd >= 0 ? "text-profit" : "text-loss",
                    )}>
                      {ytd !== null ? `${ytd > 0 ? "+" : ""}${ytd.toFixed(1)}%` : "—"}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Color scale legend */}
      <div className="mt-5 flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground mr-1">Loss</span>
        <div className="flex items-center gap-0.5">
          {[0.7, 0.5, 0.35, 0.2, 0.1].map((opacity, i) => (
            <span
              key={`loss-${i}`}
              className="h-4 w-5 rounded-sm"
              style={{ background: `rgba(255, 77, 79, ${opacity})` }}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">Flat</span>
        <div className="flex items-center gap-0.5">
          {[0.1, 0.2, 0.35, 0.5, 0.7].map((opacity, i) => (
            <span
              key={`gain-${i}`}
              className="h-4 w-5 rounded-sm"
              style={{ background: `rgba(0, 200, 150, ${opacity})` }}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">Gain</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Intensity scales with magnitude (capped at 15%)</span>
      </div>
    </div>
  );
}

// ─── 6. Correlation Card ───────────────────────────────
function CorrelationCard({
  asset,
  correlation,
  description,
  color,
}: {
  asset: string;
  correlation: number;
  description: string;
  color: string;
}) {
  const isPositive = correlation >= 0;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/40 bg-black/20 p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent" style={{ background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }} />
      <div className="flex items-center gap-2 mb-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `${color}20` }}
        >
          <LineChart className="h-4 w-4" style={{ color }} />
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">vs {asset}</span>
      </div>
      <div className="font-metric text-3xl font-bold" style={{ color }}>
        {correlation.toFixed(2)}
      </div>
      <div className="mt-2.5">
        <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
          <span>-1.0</span>
          <span>0</span>
          <span>+1.0</span>
        </div>
        <div className="relative h-2 rounded-full bg-black/50">
          {/* Scale background */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-loss/30 via-muted/20 to-profit/30" />
          {/* Indicator */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-white/80 shadow-lg"
            style={{ background: color, left: `${((correlation + 1) / 2) * 100}%` }}
            initial={{ left: "50%" }}
            animate={{ left: `${Math.min(Math.max(((correlation + 1) / 2) * 100, 3), 97)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">{description}</p>
      <div className={cn(
        "mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        isPositive
          ? "text-profit border-profit/30 bg-profit/10"
          : "text-loss border-loss/30 bg-loss/10",
      )}>
        {isPositive ? "Positive Correlation" : "Negative Correlation"}
      </div>
    </div>
  );
}

// ─── Utility: cn (class concat) ─────────────────────────
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}
