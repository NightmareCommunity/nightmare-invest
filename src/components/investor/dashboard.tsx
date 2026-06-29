"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, MetricTile, SectionTitle, StatusPill, TypePill, FadeIn } from "@/components/brand/primitives";
import { fmtUSD, fmtPct, fmtNum, fmtDate, timeAgo } from "@/lib/format";
import { useCountUp } from "@/hooks/use-count-up";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Wallet, PieChart, Activity, ArrowUpRight, ArrowDownRight, DollarSign, BarChart3, Bitcoin, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart as RPie, Pie, Cell, BarChart, Bar,
} from "recharts";
import { useApp } from "@/lib/store";

interface PortfolioData {
  fund: { id: string; name: string; slug: string; minInvest: number; feeStructure: string };
  holding: { units: number; avgPrice: number; updatedAt: string } | null;
  summary: { investedCapital: number; currentValue: number; unrealizedPnl: number; roi: number; units: number; avgPrice: number; currentNav: number };
  metrics: {
    nav: number; aum: number; dailyReturn: number; weeklyReturn: number; monthlyReturn: number; annualReturn: number;
    cagr: number; sharpe: number; maxDrawdown: number; volatility: number; inceptionNav: number;
    navHistory: { date: string; nav: number }[];
  };
  allocations: { id: string; asset: string; weight: number; color: string }[];
}

interface MarketData {
  prices: { symbol: string; name: string; priceUsd: number; change24h: number }[];
  updatedAt: string;
}

interface SentimentData { btcDominance: number; fearGreed: number; fearGreedLabel: string; }

interface TxnData { transactions: any[] }

const RANGES = [
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "6M", label: "6M" },
  { key: "1Y", label: "1Y" },
  { key: "ALL", label: "ALL" },
];

export function InvestorDashboard() {
  const setRoute = useApp((s) => s.setRoute);
  const [range, setRange] = useState("6M");

  const { data: portfolio } = useQuery<PortfolioData>({
    queryKey: ["portfolio"],
    queryFn: () => api.get("/api/portfolio"),
    refetchInterval: 30000,
  });

  const { data: market } = useQuery<MarketData>({
    queryKey: ["market-prices"],
    queryFn: () => api.get("/api/market/prices"),
    refetchInterval: 45000,
  });

  const { data: sentiment } = useQuery<SentimentData>({
    queryKey: ["market-sentiment"],
    queryFn: () => api.get("/api/market/sentiment"),
    refetchInterval: 120000,
  });

  const { data: txnData } = useQuery<TxnData>({
    queryKey: ["my-transactions"],
    queryFn: () => api.get("/api/transactions"),
  });

  if (!portfolio) return <DashboardSkeleton />;

  const s = portfolio.summary;
  const m = portfolio.metrics;
  const chartData = sliceHistory(m.navHistory, range);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <FadeIn>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Portfolio Overview</h1>
          <p className="text-sm text-muted-foreground">
            {portfolio.fund.name} · NAV updated {timeAgo(portfolio.holding?.updatedAt)}
          </p>
        </div>
      </FadeIn>

      {/* Summary tiles */}
      <FadeIn delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatedMetric
            label="Portfolio Value"
            value={s.currentValue}
            icon={<Wallet className="h-4 w-4" />}
            accent="gold"
            sub={<span className="text-muted-foreground">{fmtNum(s.units, 4)} units @ NAV {fmtUSD(s.currentNav, { decimals: 4 })}</span>}
          />
          <AnimatedMetric
            label="Invested Capital"
            value={s.investedCapital}
            icon={<DollarSign className="h-4 w-4" />}
            sub={<span className="text-muted-foreground">Avg cost {fmtUSD(s.avgPrice, { decimals: 4 })}/unit</span>}
          />
          <AnimatedMetric
            label="Unrealized P&L"
            value={s.unrealizedPnl}
            icon={s.unrealizedPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            accent={s.unrealizedPnl >= 0 ? "profit" : "loss"}
            sub={<span className={s.unrealizedPnl >= 0 ? "text-profit" : "text-loss"}>{fmtPct(s.roi)} ROI</span>}
            sparkline={m.navHistory.slice(-30).map((p) => p.nav)}
          />
          <AnimatedMetric
            label="Fund NAV"
            value={m.nav}
            decimals={4}
            prefix="$"
            icon={<Activity className="h-4 w-4" />}
            sub={<span className={m.dailyReturn >= 0 ? "text-profit" : "text-loss"}>{fmtPct(m.dailyReturn)} today</span>}
            sparkline={m.navHistory.slice(-30).map((p) => p.nav)}
          />
        </div>
      </FadeIn>

      {/* Chart + allocations */}
      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.1} className="lg:col-span-2">
          <GlassCard className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Performance</h3>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="font-metric text-2xl font-bold text-foreground">{fmtUSD(s.currentValue)}</span>
                  <span className={`font-metric text-sm font-semibold ${m.monthlyReturn >= 0 ? "text-profit" : "text-loss"}`}>
                    {fmtPct(m.monthlyReturn)} / mo
                  </span>
                </div>
              </div>
              <div className="flex rounded-lg border border-border/60 bg-black/30 p-0.5">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRange(r.key)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      range === r.key ? "bg-gold-gradient text-black" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="navArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFD700" stopOpacity={0.5} />
                      <stop offset="22%" stopColor="#D4AF37" stopOpacity={0.34} />
                      <stop offset="52%" stopColor="#D4AF37" stopOpacity={0.18} />
                      <stop offset="78%" stopColor="#D4AF37" stopOpacity={0.06} />
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="navStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#b8860b" stopOpacity={0.85} />
                      <stop offset="50%" stopColor="#FFD700" stopOpacity={1} />
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.95} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    tick={{ fill: "#7A7A7A", fontSize: 11 }}
                    stroke="rgba(255,255,255,0.08)"
                    minTickGap={40}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${fmtNum(v, 0)}`}
                    tick={{ fill: "#7A7A7A", fontSize: 11 }}
                    stroke="rgba(255,255,255,0.08)"
                    width={56}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(20,20,22,0.95)",
                      border: "1px solid rgba(212,175,55,0.25)",
                      borderRadius: "10px",
                      backdropFilter: "blur(8px)",
                    }}
                    labelStyle={{ color: "#B5B5B5", fontSize: 11 }}
                    formatter={(v: number) => [fmtUSD(v, { decimals: 4 }), "NAV"]}
                    labelFormatter={(d) => new Date(d as string).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  />
                  <Area type="monotone" dataKey="nav" stroke="url(#navStroke)" strokeWidth={2.25} fill="url(#navArea)" />
                </AreaChart>
              </ResponsiveContainer>
              {/* Animated scanning line overlay — sweeps across the chart every 5s */}
              <div className="pointer-events-none absolute inset-y-3 left-14 right-2">
                <motion.div
                  className="absolute top-0 bottom-0 w-px"
                  style={{
                    background:
                      "linear-gradient(to bottom, transparent 0%, rgba(212,175,55,0.8) 50%, transparent 100%)",
                    boxShadow: "0 0 10px rgba(212,175,55,0.55), 0 0 4px rgba(255,215,0,0.8)",
                  }}
                  initial={{ left: "0%", opacity: 0 }}
                  animate={{ left: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear", times: [0, 0.08, 0.92, 1] }}
                />
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        <FadeIn delay={0.15}>
          <GlassCard gold className="h-full p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Holdings</h3>
              <PieChart className="h-4 w-4 text-gold" />
            </div>
            <div className="mt-4 flex flex-col items-center">
              <div className="relative h-40 w-40">
                <ResponsiveContainer width="100%" height="100%">
                  <RPie>
                    <Pie
                      data={portfolio.allocations}
                      dataKey="weight"
                      nameKey="asset"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={74}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {portfolio.allocations.map((a) => (
                        <Cell key={a.id} fill={a.color} />
                      ))}
                    </Pie>
                  </RPie>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Allocation</span>
                  <span className="font-metric text-base font-bold text-foreground">{portfolio.allocations.length} assets</span>
                </div>
              </div>
              <div className="mt-4 w-full space-y-2">
                {portfolio.allocations.map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
                      <span className="text-foreground/90">{a.asset}</span>
                    </div>
                    <span className="font-metric font-semibold text-foreground">{a.weight}%</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </div>

      {/* Fund metrics grid */}
      <FadeIn delay={0.2}>
        <SectionTitle title="Fund Analytics" subtitle="Institutional-grade performance metrics" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="Daily Return" value={fmtPct(m.dailyReturn)} accent={m.dailyReturn >= 0 ? "profit" : "loss"} icon={<ArrowUpRight className="h-4 w-4" />} />
          <MetricTile label="Weekly Return" value={fmtPct(m.weeklyReturn)} accent={m.weeklyReturn >= 0 ? "profit" : "loss"} icon={<ArrowUpRight className="h-4 w-4" />} />
          <MetricTile label="Monthly Return" value={fmtPct(m.monthlyReturn)} accent={m.monthlyReturn >= 0 ? "profit" : "loss"} icon={<ArrowUpRight className="h-4 w-4" />} />
          <MetricTile label="Annual Return" value={fmtPct(m.annualReturn)} accent={m.annualReturn >= 0 ? "profit" : "loss"} icon={<ArrowUpRight className="h-4 w-4" />} />
          <MetricTile label="CAGR" value={fmtPct(m.cagr)} accent="gold" icon={<TrendingUp className="h-4 w-4" />} sub="Since inception" />
          <MetricTile label="Sharpe Ratio" value={fmtNum(m.sharpe, 2)} accent="gold" icon={<Activity className="h-4 w-4" />} sub="Risk-adjusted" />
          <MetricTile label="Volatility" value={fmtPct(m.volatility)} icon={<BarChart3 className="h-4 w-4" />} sub="Annualised" />
          <MetricTile label="Max Drawdown" value={fmtPct(m.maxDrawdown)} accent="loss" icon={<TrendingDown className="h-4 w-4" />} sub="Peak to trough" />
        </div>
      </FadeIn>

      {/* Market intelligence + AUM */}
      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.25} className="lg:col-span-2">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Market Intelligence</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-profit/10 px-2 py-0.5 text-[10px] font-medium text-profit">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-profit" /> Live
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(market?.prices ?? []).map((p) => (
                <div key={p.symbol} className="rounded-lg border border-border/60 bg-black/30 p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bitcoin className="h-4 w-4 text-gold" />
                      <span className="text-sm font-semibold text-foreground">{p.symbol}</span>
                    </div>
                    <span className={`text-xs font-medium ${p.change24h >= 0 ? "text-profit" : "text-loss"}`}>
                      {fmtPct(p.change24h)}
                    </span>
                  </div>
                  <div className="mt-2 font-metric text-lg font-bold text-foreground">
                    {fmtUSD(p.priceUsd, { decimals: p.priceUsd > 1000 ? 0 : 2 })}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{p.name}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </FadeIn>

        <FadeIn delay={0.3}>
          <GlassCard gold className="h-full p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Market Sentiment</h3>
            </div>
            <div className="mt-4">
              <div className="flex items-end justify-between">
                <span className="text-xs text-muted-foreground">Fear &amp; Greed Index</span>
                <span className={`text-xs font-semibold ${sentiment && sentiment.fearGreed >= 50 ? "text-profit" : "text-loss"}`}>
                  {sentiment?.fearGreedLabel ?? "—"}
                </span>
              </div>
              <div className="mt-2 font-metric text-3xl font-bold text-gold-gradient">
                {sentiment ? sentiment.fearGreed : "—"}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gradient-to-r from-loss via-warning to-profit">
                {sentiment && (
                  <div className="relative h-full">
                    <div
                      className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-foreground shadow"
                      style={{ left: `calc(${Math.min(100, Math.max(0, sentiment.fearGreed))}% - 2px)` }}
                    />
                  </div>
                )}
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4 text-sm">
                <span className="text-muted-foreground">BTC Dominance</span>
                <span className="font-metric font-semibold text-foreground">{sentiment ? `${sentiment.btcDominance.toFixed(1)}%` : "—"}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fund AUM</span>
                <span className="font-metric font-semibold text-gold">{fmtUSD(m.aum, { compact: true })}</span>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </div>

      {/* Recent transactions */}
      <FadeIn delay={0.35}>
        <GlassCard className="p-5">
          <SectionTitle
            title="Recent Activity"
            subtitle="Your latest deposit & withdrawal requests"
            action={
              <Button variant="outline" size="sm" onClick={() => setRoute({ name: "transactions" })} className="border-gold/30 hover:bg-gold/10">
                View all
              </Button>
            }
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Amount</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {(txnData?.transactions ?? []).slice(0, 5).map((t: any) => (
                  <tr key={t.id} className="border-b border-border/40 last:border-0">
                    <td className="py-3 pr-4"><TypePill type={t.type} /></td>
                    <td className="py-3 pr-4 font-metric font-semibold">{fmtUSD(t.amount)}</td>
                    <td className="py-3 pr-4"><StatusPill status={t.status} /></td>
                    <td className="py-3 pr-4 text-muted-foreground">{fmtDate(t.createdAt)}</td>
                  </tr>
                ))}
                {(txnData?.transactions ?? []).length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">No transactions yet. Submit your first deposit request.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </FadeIn>
    </div>
  );
}

function sliceHistory(history: { date: string; nav: number }[], range: string) {
  if (history.length === 0) return [];
  const now = Date.now();
  const days: Record<string, number> = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365, ALL: Infinity };
  const cutoff = now - (days[range] ?? 180) * 86400000;
  const filtered = history.filter((p) => new Date(p.date).getTime() >= cutoff);
  // downsample to ~120 points for perf
  if (filtered.length <= 120) return filtered;
  const step = Math.ceil(filtered.length / 120);
  return filtered.filter((_, i) => i % step === 0);
}

function AnimatedMetric({
  label, value, decimals = 0, prefix = "$", icon, accent, sub, sparkline,
}: {
  label: string; value: number; decimals?: number; prefix?: string;
  icon: React.ReactNode; accent?: "gold" | "profit" | "loss" | "neutral"; sub?: React.ReactNode;
  sparkline?: number[];
}) {
  const animated = useCountUp(value, 1000);
  const display = prefix === "$"
    ? fmtUSD(animated, { decimals })
    : `${prefix}${fmtNum(animated, decimals)}`;
  return <MetricTile label={label} value={display} icon={icon} accent={accent} sub={sub} sparkline={sparkline} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 rounded bg-muted/40 shimmer" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-xl glass shimmer" />)}
      </div>
      <div className="h-80 rounded-xl glass shimmer" />
    </div>
  );
}
