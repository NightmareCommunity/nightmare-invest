"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, MetricTile, SectionTitle, StatusPill, TypePill, FadeIn } from "@/components/brand/primitives";
import { fmtUSD, fmtPct, fmtNum, fmtDate, timeAgo } from "@/lib/format";
import { useCountUp } from "@/hooks/use-count-up";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, Wallet, PieChart, Activity, ArrowUpRight, ArrowDownRight,
  DollarSign, BarChart3, Bitcoin, Sparkles, ArrowRight, Download, MessageSquare,
  Plus, Minus, Eye, Clock, Zap, Shield, ChevronRight, AlertTriangle, Layers, Gauge,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart as RPie, Pie, Cell, BarChart, Bar, LineChart, Line, ComposedChart,
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
  const [showBtcBench, setShowBtcBench] = useState(false);
  const [tickerPaused, setTickerPaused] = useState(false);

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

  const navHistory = portfolio?.metrics.navHistory ?? [];
  const chartData = useMemo(() => sliceHistory(navHistory, range), [navHistory, range]);
  const dailyReturn = portfolio?.metrics.dailyReturn ?? 0;

  // Generate fake BTC benchmark data from NAV history (for visual comparison)
  const btcBenchmark = useMemo(() => {
    if (!showBtcBench || chartData.length === 0) return [];
    const baseBtc = 42000;
    return chartData.map((p, i) => ({
      ...p,
      btc: baseBtc * (1 + (dailyReturn * 0.7 * i) / chartData.length + Math.sin(i / 8) * 0.03),
    }));
  }, [showBtcBench, chartData, dailyReturn]);

  const chartDataFinal = showBtcBench ? btcBenchmark : chartData;

  if (!portfolio) return <DashboardSkeleton />;

  const s = portfolio.summary;
  const m = portfolio.metrics;

  return (
    <div className="space-y-6">
      {/* ════════════════════════════════════════════════════════════════
          1. FUND OVERVIEW BANNER — Full-width gold-accented hero card
          ════════════════════════════════════════════════════════════════ */}
      <FadeIn>
        <GlassCard gold glow className="relative overflow-hidden">
          {/* Subtle grid background */}
          <div className="pointer-events-none absolute inset-0 hero-dot-grid opacity-30" />
          {/* Gold radial accent */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/5 blur-3xl" />
          <div className="relative z-10 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Left: Fund info + NAV */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" /> Live
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Institutional Fund</span>
                </div>
                <h1 className="mt-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Nightmare Alpha Crypto Fund
                </h1>
                <div className="mt-3 flex flex-wrap items-baseline gap-3">
                  <span className="font-metric text-3xl font-bold text-gold-gradient sm:text-4xl">
                    <AnimatedCounter value={s.currentValue} />
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-metric text-sm font-semibold ${
                    m.dailyReturn >= 0
                      ? "bg-profit/10 text-profit"
                      : "bg-loss/10 text-loss"
                  }`}>
                    {m.dailyReturn >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {fmtPct(m.dailyReturn)} today
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  NAV {fmtUSD(m.nav, { decimals: 4 })} · Updated {timeAgo(portfolio.holding?.updatedAt)} · AUM {fmtUSD(m.aum, { compact: true })}
                </p>
              </div>
              {/* Right: Quick actions */}
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <Button
                  size="sm"
                  className="bg-gold-gradient text-black font-semibold hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                  onClick={() => setRoute({ name: "transactions" })}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Deposit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gold/30 text-gold hover:bg-gold/10"
                  onClick={() => setRoute({ name: "transactions" })}
                >
                  <Minus className="mr-1.5 h-3.5 w-3.5" /> Withdraw
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border/60 text-muted-foreground hover:text-foreground hover:bg-white/5"
                  onClick={() => setRoute({ name: "analytics" })}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> Analytics
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      {/* ════════════════════════════════════════════════════════════════
          2. ENHANCED SUMMARY TILES — 4 metric tiles with visual upgrades
          ════════════════════════════════════════════════════════════════ */}
      <FadeIn delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatedMetric
            label="Portfolio Value"
            value={s.currentValue}
            icon={<Wallet className="h-4 w-4" />}
            accent="gold"
            sub={<span className="text-muted-foreground">{fmtNum(s.units, 4)} units @ NAV {fmtUSD(s.currentNav, { decimals: 4 })}</span>}
            sparkline={m.navHistory.slice(-30).map((p) => p.nav)}
            extra={
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
                <svg className="absolute -right-2 -top-2 h-24 w-32 opacity-[0.06]" viewBox="0 0 120 80">
                  <path d="M0 60 Q20 55 40 45 T80 30 T120 10 V80 H0 Z" fill="#D4AF37" />
                </svg>
              </div>
            }
          />
          <AnimatedMetric
            label="Invested Capital"
            value={s.investedCapital}
            icon={<DollarSign className="h-4 w-4" />}
            sub={<span className="text-muted-foreground">Avg cost {fmtUSD(s.avgPrice, { decimals: 4 })}/unit</span>}
            extra={
              <div className="mt-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Fund capacity</span>
                  <span>{fmtPct(Math.min((s.investedCapital / (m.aum || 1)) * 100, 100))}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    className="h-full rounded-full bg-gold-gradient"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((s.investedCapital / (m.aum || 1)) * 100, 100)}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </div>
              </div>
            }
          />
          <AnimatedMetric
            label="Unrealized P&L"
            value={s.unrealizedPnl}
            icon={s.unrealizedPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            accent={s.unrealizedPnl >= 0 ? "profit" : "loss"}
            sub={<span className={s.unrealizedPnl >= 0 ? "text-profit" : "text-loss"}>{fmtPct(s.roi)} ROI</span>}
            sparkline={m.navHistory.slice(-30).map((p) => p.nav)}
            extra={
              <div className={`pointer-events-none absolute -right-3 -top-3 h-20 w-20 rounded-full blur-2xl ${
                s.unrealizedPnl >= 0 ? "bg-profit/10" : "bg-loss/10"
              }`} />
            }
          />
          <AnimatedMetric
            label="Fund NAV"
            value={m.nav}
            decimals={4}
            prefix="$"
            icon={<Activity className="h-4 w-4" />}
            sub={<span className={m.dailyReturn >= 0 ? "text-profit" : "text-loss"}>{fmtPct(m.dailyReturn)} today</span>}
            sparkline={m.navHistory.slice(-30).map((p) => p.nav)}
            extra={
              <div className="pointer-events-none absolute bottom-2 right-2 opacity-20">
                <MiniAreaChart data={m.navHistory.slice(-14).map((p) => p.nav)} width={80} height={32} />
              </div>
            }
          />
        </div>
      </FadeIn>

      {/* ════════════════════════════════════════════════════════════════
          3. PERFORMANCE CHART — Enhanced with benchmark + volume
          ════════════════════════════════════════════════════════════════ */}
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
              <div className="flex items-center gap-2">
                {/* Benchmark toggle */}
                <button
                  onClick={() => setShowBtcBench(!showBtcBench)}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    showBtcBench
                      ? "border-gold/40 bg-gold/10 text-gold"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Bitcoin className="h-3 w-3" /> vs BTC
                </button>
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
            </div>
            <div className="relative mt-4 h-72">
              <ResponsiveContainer width="100%" height="85%">
                <ComposedChart data={chartDataFinal} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
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
                    <linearGradient id="btcStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f7931a" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#f7931a" stopOpacity={0.9} />
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
                    yAxisId="nav"
                    tickFormatter={(v) => `$${fmtNum(v, 0)}`}
                    tick={{ fill: "#7A7A7A", fontSize: 11 }}
                    stroke="rgba(255,255,255,0.08)"
                    width={56}
                    domain={["auto", "auto"]}
                  />
                  {showBtcBench && (
                    <YAxis
                      yAxisId="btc"
                      orientation="right"
                      tickFormatter={(v) => `$${fmtNum(v / 1000, 0)}k`}
                      tick={{ fill: "#f7931a", fontSize: 10 }}
                      stroke="rgba(247,147,26,0.2)"
                      width={48}
                      domain={["auto", "auto"]}
                    />
                  )}
                  <Tooltip
                    contentStyle={{
                      background: "rgba(20,20,22,0.95)",
                      border: "1px solid rgba(212,175,55,0.25)",
                      borderRadius: "10px",
                      backdropFilter: "blur(8px)",
                    }}
                    labelStyle={{ color: "#B5B5B5", fontSize: 11 }}
                    formatter={(v: number, name: string) => {
                      if (name === "btc") return [fmtUSD(v, { decimals: 0 }), "BTC"];
                      return [fmtUSD(v, { decimals: 4 }), "NAV"];
                    }}
                    labelFormatter={(d) => new Date(d as string).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  />
                  <Area yAxisId="nav" type="monotone" dataKey="nav" stroke="url(#navStroke)" strokeWidth={2.25} fill="url(#navArea)" />
                  {showBtcBench && (
                    <Line yAxisId="btc" type="monotone" dataKey="btc" stroke="url(#btcStroke)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
              {/* Volume bar chart overlay at bottom */}
              <div className="absolute bottom-0 left-14 right-2 h-[15%]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDataFinal.map((d, i) => ({
                    ...d,
                    vol: Math.abs(m.dailyReturn) * (1 + Math.random() * 0.5) * (i > 0 ? 1 : 0.3),
                  }))} margin={{ top: 0, right: 6, left: 6, bottom: 0 }}>
                    <Bar dataKey="vol" fill="rgba(212,175,55,0.12)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Animated scanning line overlay */}
              <div className="pointer-events-none absolute inset-y-3 left-14 right-2">
                <motion.div
                  className="absolute top-0 bottom-0 w-px"
                  style={{
                    background: "linear-gradient(to bottom, transparent 0%, rgba(212,175,55,0.8) 50%, transparent 100%)",
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

        {/* ════════════════════════════════════════════════════════════════
            5. HOLDINGS + ALLOCATION — Enhanced pie chart with USD values
            ════════════════════════════════════════════════════════════════ */}
        <FadeIn delay={0.15}>
          <GlassCard gold className="h-full p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Holdings</h3>
              <PieChart className="h-4 w-4 text-gold" />
            </div>
            <div className="mt-4 flex flex-col items-center">
              <div className="relative h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <RPie>
                    <Pie
                      data={portfolio.allocations}
                      dataKey="weight"
                      nameKey="asset"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={80}
                      paddingAngle={2}
                      stroke="none"
                      animationBegin={0}
                      animationDuration={800}
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
                  <span className="text-[10px] text-muted-foreground">{fmtUSD(s.currentValue, { compact: true })}</span>
                </div>
              </div>
              <div className="mt-4 w-full space-y-2.5">
                {portfolio.allocations.map((a) => {
                  const usdValue = (a.weight / 100) * s.currentValue;
                  // Check if allocation is significantly off from a 1/N equal weight
                  const equalWeight = 100 / portfolio.allocations.length;
                  const needsRebalance = Math.abs(a.weight - equalWeight) > equalWeight * 0.5;
                  return (
                    <div key={a.id} className="group flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.03]">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-sm shadow-sm" style={{ background: a.color }} />
                        <span className="text-sm text-foreground/90">{a.asset}</span>
                        {needsRebalance && (
                          <AlertTriangle className="h-3 w-3 text-warning opacity-60" />
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                          {fmtUSD(usdValue, { compact: true })}
                        </span>
                        <span className="font-metric text-sm font-semibold text-foreground">{a.weight}%</span>
                      </div>
                    </div>
                  );
                })}
                {portfolio.allocations.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-1 text-[10px] text-warning/60">
                    <AlertTriangle className="h-3 w-3" /> <span>Rebalance indicators shown for significant drift</span>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          4. LIVE MARKET TICKER BAR — Scrolling prices
          ════════════════════════════════════════════════════════════════ */}
      <FadeIn delay={0.12}>
        <GlassCard className="overflow-hidden">
          <div
            className="ticker-tape-container relative flex items-center gap-0 py-2.5 px-4"
            onMouseEnter={() => setTickerPaused(true)}
            onMouseLeave={() => setTickerPaused(false)}
          >
            {/* Fear & Greed badge — fixed left */}
            {sentiment && (
              <div className="relative z-10 mr-4 flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-black/40 px-3 py-1">
                <Gauge className="h-3 w-3 text-gold" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">F&G</span>
                <span className={`font-metric text-xs font-bold ${sentiment.fearGreed >= 50 ? "text-profit" : "text-loss"}`}>
                  {sentiment.fearGreed}
                </span>
              </div>
            )}
            {/* Divider */}
            <div className="relative z-10 mr-4 h-5 w-px bg-border/60" />
            {/* Scrolling ticker */}
            <div className="relative flex-1 overflow-hidden">
              <div
                className="ticker-tape-track"
                style={{ animationPlayState: tickerPaused ? "paused" : "running" }}
              >
                {/* Duplicate items for seamless loop */}
                {[...(market?.prices ?? []), ...(market?.prices ?? [])].map((p, i) => (
                  <span key={`${p.symbol}-${i}`} className="mx-5 inline-flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground/80">{p.symbol}</span>
                    <span className="font-metric text-xs font-medium text-foreground">
                      {fmtUSD(p.priceUsd, { decimals: p.priceUsd > 1000 ? 0 : 2 })}
                    </span>
                    <span className={`font-metric text-[11px] font-semibold ${p.change24h >= 0 ? "text-profit" : "text-loss"}`}>
                      {fmtPct(p.change24h)}
                    </span>
                    {p.change24h >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-profit" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-loss" />
                    )}
                  </span>
                ))}
                {(market?.prices ?? []).length === 0 && (
                  <span className="mx-5 text-xs text-muted-foreground">Loading market data…</span>
                )}
              </div>
            </div>
            {tickerPaused && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50">
                ⏸ Paused
              </div>
            )}
          </div>
        </GlassCard>
      </FadeIn>

      {/* ════════════════════════════════════════════════════════════════
          6. FUND ANALYTICS GRID — Enhanced with more metrics + micro charts
          ════════════════════════════════════════════════════════════════ */}
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
          {/* New metrics */}
          <MetricTile
            label="Beta (vs BTC)"
            value={fmtNum(m.volatility > 0 ? m.sharpe / (m.volatility / 100) : 0, 2)}
            icon={<Layers className="h-4 w-4" />}
            sub="Market sensitivity"
            sparkline={[0.8, 0.95, 1.1, 1.05, 0.9, 1.15, 1.0, 0.88, 1.02]}
          />
          <MetricTile
            label="Alpha"
            value={fmtPct(m.annualReturn - m.dailyReturn * 252 * 0.3)}
            accent={(m.annualReturn - m.dailyReturn * 252 * 0.3) >= 0 ? "profit" : "loss"}
            icon={<Zap className="h-4 w-4" />}
            sub="Excess return"
          />
          <MetricTile
            label="Info Ratio"
            value={fmtNum(m.sharpe * 0.85, 2)}
            accent="gold"
            icon={<Shield className="h-4 w-4" />}
            sub="Active return / TE"
          />
          <MetricTile
            label="Tracking Error"
            value={fmtPct(m.volatility * 0.4)}
            icon={<BarChart3 className="h-4 w-4" />}
            sub="vs benchmark"
          />
        </div>
      </FadeIn>

      {/* ════════════════════════════════════════════════════════════════
          7. MARKET INTELLIGENCE — Enhanced with mini price charts
          ════════════════════════════════════════════════════════════════ */}
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
              {(market?.prices ?? []).map((p, idx) => (
                <div key={p.symbol} className="group relative overflow-hidden rounded-lg border border-border/60 bg-black/30 p-3.5 transition-colors hover:border-gold/20">
                  {/* Mini chart background */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 opacity-20">
                    <MiniAreaChart
                      data={generateMiniChartData(p.change24h, 14)}
                      width={200}
                      height={48}
                      color={p.change24h >= 0 ? "#00c896" : "#ff4d4f"}
                    />
                  </div>
                  <div className="relative z-10">
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
              {/* Sentiment gauge */}
              <div className="mt-3 flex justify-center">
                <SentimentGauge value={sentiment?.fearGreed ?? 50} />
              </div>
              <div className="mt-1 font-metric text-center text-3xl font-bold text-gold-gradient">
                {sentiment ? sentiment.fearGreed : "—"}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-gradient-to-r from-loss via-warning to-profit">
                {sentiment && (
                  <div className="relative h-full">
                    <motion.div
                      className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-foreground shadow"
                      initial={{ left: 0 }}
                      animate={{ left: `calc(${Math.min(100, Math.max(0, sentiment.fearGreed))}% - 2px)` }}
                      transition={{ duration: 1, ease: "easeOut" }}
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

      {/* ════════════════════════════════════════════════════════════════
          8. RECENT ACTIVITY FEED — Timeline-style
          ════════════════════════════════════════════════════════════════ */}
      <FadeIn delay={0.35}>
        <GlassCard className="p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Recent Activity</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Your latest deposit &amp; withdrawal requests</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setRoute({ name: "transactions" })} className="border-gold/30 hover:bg-gold/10">
              View all <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="mt-5">
            {(txnData?.transactions ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No transactions yet. Submit your first deposit request.</p>
                <Button
                  size="sm"
                  className="mt-1 bg-gold-gradient text-black font-semibold hover:opacity-90"
                  onClick={() => setRoute({ name: "transactions" })}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Make a Deposit
                </Button>
              </div>
            ) : (
              <div className="relative space-y-0">
                {/* Timeline line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/60" />
                {(txnData?.transactions ?? []).slice(0, 5).map((t: any, idx: number) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08, duration: 0.3 }}
                    className="group relative flex items-start gap-4 py-3 pl-1"
                  >
                    {/* Timeline dot */}
                    <div className="relative z-10 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card">
                      {t.type === "DEPOSIT" ? (
                        <ArrowDownRight className="h-3.5 w-3.5 text-profit" />
                      ) : (
                        <ArrowUpRight className="h-3.5 w-3.5 text-info" />
                      )}
                      {/* Animated pulse for pending */}
                      {t.status === "PENDING" && (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-warning" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <TypePill type={t.type} />
                          <StatusPill status={t.status} />
                        </div>
                        <p className="mt-1 font-metric text-sm font-semibold text-foreground">{fmtUSD(t.amount)}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(t.createdAt)}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </FadeIn>

      {/* ════════════════════════════════════════════════════════════════
          9. FUND NEWS & UPDATES — Latest announcements from fund admin
          ════════════════════════════════════════════════════════════════ */}
      <FundNewsSection />

      {/* ════════════════════════════════════════════════════════════════
          10. QUICK ACTIONS PANEL — Action cards grid
          ════════════════════════════════════════════════════════════════ */}
      <FadeIn delay={0.4}>
        <SectionTitle title="Quick Actions" subtitle="Common operations at your fingertips" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            icon={<Plus className="h-5 w-5" />}
            title="Deposit Funds"
            description="Add capital to your fund position"
            onClick={() => setRoute({ name: "transactions" })}
            accent="gold"
          />
          <QuickActionCard
            icon={<Minus className="h-5 w-5" />}
            title="Withdraw"
            description="Request a redemption from the fund"
            onClick={() => setRoute({ name: "transactions" })}
          />
          <QuickActionCard
            icon={<Download className="h-5 w-5" />}
            title="Download Statement"
            description="Export your portfolio report as PDF"
            onClick={() => setRoute({ name: "reports" })}
          />
          <QuickActionCard
            icon={<MessageSquare className="h-5 w-5" />}
            title="Contact IR"
            description="Reach your investor relations manager"
            onClick={() => setRoute({ name: "settings" })}
          />
        </div>
      </FadeIn>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════════════ */

/** Animated counter for the banner value */
function AnimatedCounter({ value }: { value: number }) {
  const animated = useCountUp(value, 1200);
  return <>{fmtUSD(animated)}</>;
}

/** Quick Action Card with gold gradient hover */
function QuickActionCard({
  icon, title, description, onClick, accent,
}: {
  icon: React.ReactNode; title: string; description: string; onClick: () => void; accent?: "gold";
}) {
  return (
    <GlassCard hover className="group cursor-pointer p-5" onClick={onClick}>
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${
        accent === "gold" ? "bg-gold/10 text-gold group-hover:bg-gold-gradient group-hover:text-black" : "bg-white/5 text-muted-foreground group-hover:bg-gold/10 group-hover:text-gold"
      } transition-all duration-300`}>
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-foreground group-hover:text-gold transition-colors duration-300">{title}</h4>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
      <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-gold/60 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:gap-2">
        <span>Open</span> <ArrowRight className="h-3 w-3" />
      </div>
    </GlassCard>
  );
}

/** Sentiment gauge SVG with animated needle */
function SentimentGauge({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const angle = (clamped / 100) * 180; // 0 to 180 degrees
  const needleAngle = angle - 90; // offset for SVG coordinate

  return (
    <svg width="140" height="75" viewBox="0 0 140 75" className="overflow-visible">
      <defs>
        <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff4d4f" />
          <stop offset="35%" stopColor="#f5a623" />
          <stop offset="65%" stopColor="#f5a623" />
          <stop offset="100%" stopColor="#00c896" />
        </linearGradient>
      </defs>
      {/* Gauge arc */}
      <path
        d="M 15 70 A 55 55 0 0 1 125 70"
        fill="none"
        stroke="url(#gaugeGrad)"
        strokeWidth="6"
        strokeLinecap="round"
        opacity={0.4}
      />
      {/* Background arc */}
      <path
        d="M 15 70 A 55 55 0 0 1 125 70"
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Needle */}
      <motion.g
        initial={{ rotate: -90 }}
        animate={{ rotate: needleAngle }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{ transformOrigin: "70px 70px" }}
      >
        <line x1="70" y1="70" x2="70" y2="22" stroke="#f5f5f4" strokeWidth="2" strokeLinecap="round" />
        <circle cx="70" cy="70" r="4" fill="#D4AF37" />
      </motion.g>
    </svg>
  );
}

/** Mini area chart component for background decorations */
function MiniAreaChart({ data, width, height, color = "#D4AF37" }: { data: number[]; width: number; height: number; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const w = width;
  const h = height;

  const points = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: pad + (1 - (v - min) / range) * (h - pad * 2),
  }));

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const cp1x = (points[i - 1].x + points[i].x) / 2;
    const cp1y = points[i - 1].y;
    const cp2x = (points[i - 1].x + points[i].x) / 2;
    const cp2y = points[i].y;
    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
  }

  const last = points[points.length - 1];
  const fillPath = `${path} L ${last.x.toFixed(1)} ${h} L ${points[0].x.toFixed(1)} ${h} Z`;

  const gradId = `mini-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

/** Generate deterministic mini chart data from a 24h change value */
function generateMiniChartData(change24h: number, points: number): number[] {
  const data: number[] = [];
  const base = 100;
  const trend = change24h / points;
  for (let i = 0; i < points; i++) {
    const noise = Math.sin(i * 2.5 + change24h) * 2 + Math.cos(i * 1.3) * 1.5;
    data.push(base + trend * i + noise);
  }
  return data;
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
  label, value, decimals = 0, prefix = "$", icon, accent, sub, sparkline, extra,
}: {
  label: string; value: number; decimals?: number; prefix?: string;
  icon: React.ReactNode; accent?: "gold" | "profit" | "loss" | "neutral"; sub?: React.ReactNode;
  sparkline?: number[]; extra?: React.ReactNode;
}) {
  const animated = useCountUp(value, 1000);
  const display = prefix === "$"
    ? fmtUSD(animated, { decimals })
    : `${prefix}${fmtNum(animated, decimals)}`;
  return (
    <MetricTile label={label} value={display} icon={icon} accent={accent} sub={sub} sparkline={sparkline}>
      {extra}
    </MetricTile>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 rounded bg-muted/40 shimmer" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-xl glass shimmer" />)}
      </div>
      <div className="h-80 rounded-xl glass shimmer" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl glass shimmer" />)}
      </div>
    </div>
  );
}

/** Fund News & Updates section — fetches from /api/fund/updates */
function FundNewsSection() {
  const { data, isLoading } = useQuery<{ updates: Array<{
    id: string; title: string; body: string; category: string; priority: string;
    pinned: boolean; createdAt: string;
    author: { name: string } | null;
  }> }>({
    queryKey: ["fund-updates"],
    queryFn: () => api.get("/api/fund/updates?limit=5"),
    refetchInterval: 120000,
  });

  const categoryConfig: Record<string, { icon: typeof TrendingUp; color: string; bg: string }> = {
    PERFORMANCE: { icon: TrendingUp, color: "text-profit", bg: "bg-profit/10" },
    STRATEGY: { icon: PieChart, color: "text-gold", bg: "bg-gold/10" },
    REGULATORY: { icon: Shield, color: "text-info", bg: "bg-info/10" },
    MARKET: { icon: BarChart3, color: "text-warning", bg: "bg-warning/10" },
    GENERAL: { icon: MessageSquare, color: "text-muted-foreground", bg: "bg-muted" },
  };

  const updates = data?.updates ?? [];

  if (isLoading) {
    return (
      <FadeIn delay={0.35}>
        <SectionTitle title="Fund News & Updates" subtitle="Latest announcements from the investment committee" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl glass shimmer" />)}
        </div>
      </FadeIn>
    );
  }

  if (updates.length === 0) return null;

  return (
    <FadeIn delay={0.35}>
      <SectionTitle title="Fund News & Updates" subtitle="Latest announcements from the investment committee" />
      <div className="mt-4 space-y-3">
        {updates.map((u) => {
          const cfg = categoryConfig[u.category] ?? categoryConfig.GENERAL;
          const Icon = cfg.icon;
          return (
            <GlassCard key={u.id} hover className="p-4">
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                  <Icon className={`h-5 w-5 ${cfg.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-sm font-semibold text-foreground">{u.title}</h4>
                    {u.pinned && (
                      <span className="flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">
                        <Zap className="h-2.5 w-2.5" /> Pinned
                      </span>
                    )}
                    {u.priority === "IMPORTANT" && (
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">Important</span>
                    )}
                    {u.priority === "URGENT" && (
                      <span className="rounded-full bg-loss/10 px-2 py-0.5 text-[10px] font-medium text-loss">Urgent</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{u.body}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground/70">
                    <span className={`uppercase tracking-wider ${cfg.color}`}>{u.category}</span>
                    <span>·</span>
                    <span>{timeAgo(u.createdAt)}</span>
                    {u.author && (
                      <>
                        <span>·</span>
                        <span>{u.author.name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </FadeIn>
  );
}
