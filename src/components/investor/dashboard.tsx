"use client";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, MetricTile, SectionTitle, StatusPill, TypePill, FadeIn, SkeletonCard, SkeletonMetric, SkeletonTable } from "@/components/brand/primitives";
import { fmtUSD, fmtPct, fmtNum, fmtDate, timeAgo } from "@/lib/format";
import { useCountUp } from "@/hooks/use-count-up";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, Wallet, PieChart, Activity, ArrowUpRight, ArrowDownRight,
  DollarSign, BarChart3, Bitcoin, Sparkles, ArrowRight, Download, MessageSquare,
  Plus, Minus, Eye, Clock, Zap, Shield, ChevronRight, AlertTriangle, Layers, Gauge,
  Volume2, Landmark,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart as RPie, Pie, Cell, BarChart, Bar, LineChart, Line, ComposedChart,
} from "recharts";
import { useApp } from "@/lib/store";
import { usePriceStream } from "@/hooks/use-price-stream";

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
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);

  // ── WebSocket real-time price stream ──
  const { prices: streamPrices, fearGreed: streamFearGreed, connectionStatus } = usePriceStream();

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

  // ── Merge: prefer real-time stream, fall back to polled API data ──
  const livePrices = streamPrices.length > 0 ? streamPrices : (market?.prices ?? []);
  const liveSentiment = streamFearGreed ?? sentiment ?? null;
  const isLive = connectionStatus === "connected" && streamPrices.length > 0;

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
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      {/* ════════════════════════════════════════════════════════════════
          1. FUND OVERVIEW BANNER — Full-width gold-accented hero card
          ════════════════════════════════════════════════════════════════ */}
      <FadeIn>
        <GlassCard gold glow className="gold-corner-accent relative overflow-hidden">
          {/* Subtle grid background */}
          <div className="pointer-events-none absolute inset-0 hero-dot-grid opacity-30" />
          {/* Gold radial accent */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/5 blur-3xl" />
          {/* Decorative SVG corner brackets — institutional frame */}
          <svg className="pointer-events-none absolute left-3 top-3 h-3 w-3 text-gold/50" viewBox="0 0 12 12" fill="none">
            <path d="M1 5V1H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <svg className="pointer-events-none absolute right-3 top-3 h-3 w-3 text-gold/50" viewBox="0 0 12 12" fill="none">
            <path d="M7 1H11V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <svg className="pointer-events-none absolute bottom-3 left-3 h-3 w-3 text-gold/50" viewBox="0 0 12 12" fill="none">
            <path d="M1 7V11H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <svg className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 text-gold/50" viewBox="0 0 12 12" fill="none">
            <path d="M7 11H11V7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <div className="relative z-10 p-3 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Left: Fund info + NAV */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {/* Unified status badge */}
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wide transition-colors ${
                      isLive
                        ? "border-profit/30 bg-profit/[0.08] text-profit"
                        : connectionStatus === "connecting"
                          ? "border-gold/30 bg-gold/[0.08] text-gold"
                          : "border-loss/30 bg-loss/[0.08] text-loss"
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      {(isLive || connectionStatus === "connecting") && (
                        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                          isLive ? "bg-profit" : "bg-gold"
                        }`} />
                      )}
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${
                        isLive ? "bg-profit" : connectionStatus === "connecting" ? "bg-gold" : "bg-loss"
                      }`} />
                    </span>
                    {isLive ? "LIVE" : connectionStatus === "connecting" ? "CONNECTING" : "OFFLINE"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/[0.08] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-gold">
                    <Shield className="h-3 w-3" />
                    Institutional Fund
                  </span>
                </div>
                <h1 className="h2-responsive mt-2 font-bold tracking-tight text-foreground">
                  Nightmare Alpha Crypto Fund
                </h1>
                <div className="mt-3 flex flex-wrap items-baseline gap-2 sm:gap-3">
                  <span className="font-metric text-2xl font-bold text-gold-gradient sm:text-3xl lg:text-4xl">
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
                <p className="mt-1.5 text-xs text-muted-foreground break-words-mobile">
                  NAV {fmtUSD(m.nav, { decimals: 4 })} · Updated {timeAgo(portfolio.holding?.updatedAt)} · AUM {fmtUSD(m.aum, { compact: true })}
                </p>
              </div>
              {/* Right: Quick actions */}
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <Button
                  size="sm"
                  className="tap-target h-9 bg-gold-gradient text-black font-semibold shadow-[0_0_18px_rgba(212,175,55,0.22)] transition-all hover:shadow-[0_0_26px_rgba(212,175,55,0.32)] hover:opacity-90"
                  onClick={() => setRoute({ name: "transactions" })}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Deposit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="tap-target h-9 border-gold/45 bg-gold/[0.04] text-gold font-semibold transition-all hover:border-gold/70 hover:bg-gold/[0.08] hover:shadow-[0_0_14px_rgba(212,175,55,0.18)]"
                  onClick={() => setRoute({ name: "transactions" })}
                >
                  <Minus className="mr-1.5 h-3.5 w-3.5" /> Withdraw
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="tap-target hide-mobile h-9 border-border/60 text-muted-foreground hover:text-foreground hover:bg-white/5"
                  onClick={() => setRoute({ name: "analytics" })}
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> Analytics
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>
        {/* Thin gold gradient divider below the banner */}
        <div className="gold-divider mt-3 opacity-60" />
      </FadeIn>

      {/* ════════════════════════════════════════════════════════════════
          2. ENHANCED SUMMARY TILES — 4 metric tiles with visual upgrades
          ════════════════════════════════════════════════════════════════ */}
      <FadeIn delay={0.05}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
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
          3. ENHANCED PERFORMANCE CHART — Custom tooltip, crosshair, gradient, legend
          ════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.1} className="lg:col-span-2">
          <GlassCard className="p-3 sm:p-4 lg:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Performance</h3>
                <div className="mt-1 flex items-baseline gap-2 sm:gap-3">
                  <span className="font-metric text-xl sm:text-2xl font-bold text-foreground">{fmtUSD(s.currentValue)}</span>
                  <span className={`font-metric text-sm font-semibold ${m.monthlyReturn >= 0 ? "text-profit" : "text-loss"}`}>
                    {fmtPct(m.monthlyReturn)} / mo
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Benchmark toggle */}
                <button
                  onClick={() => setShowBtcBench(!showBtcBench)}
                  className={`tap-target-sm flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    showBtcBench
                      ? "border-gold/40 bg-gold/10 text-gold"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Bitcoin className="h-3 w-3" /> vs BTC
                </button>
                <div className="scroll-row rounded-lg border border-border/60 bg-black/30 p-0.5">
                  {RANGES.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setRange(r.key)}
                      className={`tap-target-sm rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                        range === r.key ? "bg-gold-gradient text-black" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Chart Legend */}
            <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-4 rounded-full bg-gold" /> NAV
              </span>
              {showBtcBench && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-4 rounded-full border-t border-dashed border-[#f7931a]" /> BTC
                </span>
              )}
              <span className="ml-auto text-muted-foreground">
                {range === "ALL" ? "All time" : `Last ${range}`}
              </span>
            </div>
            <div className="chart-mobile relative mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartDataFinal} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="navAreaEnhanced" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFD700" stopOpacity={0.45} />
                      <stop offset="15%" stopColor="#D4AF37" stopOpacity={0.32} />
                      <stop offset="40%" stopColor="#D4AF37" stopOpacity={0.18} />
                      <stop offset="70%" stopColor="#D4AF37" stopOpacity={0.06} />
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="navStrokeEnhanced" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#b8860b" stopOpacity={0.85} />
                      <stop offset="50%" stopColor="#FFD700" stopOpacity={1} />
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.95} />
                    </linearGradient>
                    <linearGradient id="btcStrokeEnhanced" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f7931a" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#f7931a" stopOpacity={0.9} />
                    </linearGradient>
                    <filter id="glowLine">
                      <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    tick={{ fill: "#7A7A7A", fontSize: 10 }}
                    stroke="rgba(255,255,255,0.08)"
                    minTickGap={40}
                  />
                  <YAxis
                    yAxisId="nav"
                    tickFormatter={(v) => `$${fmtNum(v, 0)}`}
                    tick={{ fill: "#7A7A7A", fontSize: 10 }}
                    stroke="rgba(255,255,255,0.08)"
                    width={48}
                    domain={["auto", "auto"]}
                  />
                  {showBtcBench && (
                    <YAxis
                      yAxisId="btc"
                      orientation="right"
                      tickFormatter={(v) => `$${fmtNum(v / 1000, 0)}k`}
                      tick={{ fill: "#f7931a", fontSize: 10 }}
                      stroke="rgba(247,147,26,0.2)"
                      width={40}
                      domain={["auto", "auto"]}
                    />
                  )}
                  <Tooltip
                    content={<PerformanceChartTooltip dailyReturn={dailyReturn} />}
                    cursor={{
                      stroke: "rgba(212,175,55,0.35)",
                      strokeWidth: 1,
                      strokeDasharray: "4 3",
                    }}
                  />
                  <Area
                    yAxisId="nav"
                    type="monotone"
                    dataKey="nav"
                    stroke="url(#navStrokeEnhanced)"
                    strokeWidth={3}
                    fill="url(#navAreaEnhanced)"
                    filter="url(#glowLine)"
                    animationDuration={800}
                  />
                  {showBtcBench && (
                    <Line
                      yAxisId="btc"
                      type="monotone"
                      dataKey="btc"
                      stroke="url(#btcStrokeEnhanced)"
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                      dot={false}
                      animationDuration={800}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
              {/* Volume bar chart overlay at bottom */}
              <div className="hide-mobile absolute bottom-0 left-14 right-2 h-[15%]">
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
              <div className="hide-mobile pointer-events-none absolute inset-y-3 left-14 right-2">
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
            5. ENHANCED HOLDINGS DONUT — Labels, center value, hover expand, legend
            ════════════════════════════════════════════════════════════════ */}
        <FadeIn delay={0.15}>
          <GlassCard gold className="h-full p-3 sm:p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Holdings</h3>
              <PieChart className="h-4 w-4 text-gold" />
            </div>
            <div className="mt-4 flex flex-col items-center">
              <div className="relative h-44 w-44 sm:h-48 sm:w-48 lg:h-52 lg:w-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RPie>
                    <Pie
                      data={portfolio.allocations.map((a, i) => ({
                        ...a,
                        outerRadius: hoveredSlice === i ? 86 : 76,
                      }))}
                      dataKey="weight"
                      nameKey="asset"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={76}
                      paddingAngle={2}
                      stroke="none"
                      animationBegin={0}
                      animationDuration={800}
                      onMouseEnter={(_, idx) => setHoveredSlice(idx)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      label={({ asset, weight, cx, cy, outerRadius, midAngle }) => {
                        const RADIAN = Math.PI / 180;
                        const radius = (outerRadius as number) + 18;
                        const x = (cx as number) + radius * Math.cos(-midAngle * RADIAN);
                        const y = (cy as number) + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text
                            x={x}
                            y={y}
                            fill="#9a9a9a"
                            textAnchor={x > (cx as number) ? "start" : "end"}
                            dominantBaseline="central"
                            fontSize={10}
                            fontFamily="var(--font-jetbrains), ui-monospace, monospace"
                          >
                            {asset} {weight}%
                          </text>
                        );
                      }}
                    >
                      {portfolio.allocations.map((a, i) => (
                        <Cell
                          key={a.id}
                          fill={a.color}
                          style={{
                            transition: "all 0.3s ease",
                            filter: hoveredSlice === i ? "brightness(1.3) drop-shadow(0 0 6px rgba(212,175,55,0.3))" : "none",
                            transform: hoveredSlice === i ? "scale(1.04)" : "scale(1)",
                            transformOrigin: "center center",
                          }}
                        />
                      ))}
                    </Pie>
                  </RPie>
                </ResponsiveContainer>
                {/* Center text with animated counter */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Total Value</span>
                  <span className="font-metric text-base font-bold text-gold-gradient sm:text-lg">
                    <AnimatedCounter value={s.currentValue} compact />
                  </span>
                  <span className="text-[10px] text-muted-foreground">{portfolio.allocations.length} assets</span>
                </div>
              </div>
              {/* Legend below chart */}
              <div className="mt-4 w-full space-y-1.5 sm:space-y-2">
                {portfolio.allocations.map((a, i) => {
                  const usdValue = (a.weight / 100) * s.currentValue;
                  const equalWeight = 100 / portfolio.allocations.length;
                  const needsRebalance = Math.abs(a.weight - equalWeight) > equalWeight * 0.5;
                  return (
                    <motion.div
                      key={a.id}
                      className="group flex items-center justify-between rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                      onMouseEnter={() => setHoveredSlice(i)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      animate={hoveredSlice === i ? { x: 4 } : { x: 0 }}
                      transition={{ duration: 0.2 }}
                    >
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
                    </motion.div>
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
          4. ENHANCED LIVE MARKET TICKER BAR — Gold gradient, direction arrows, smooth scrolling
          ════════════════════════════════════════════════════════════════ */}
      <FadeIn delay={0.12}>
        <GlassCard className="overflow-hidden">
          <div
            className="ticker-bar-enhanced relative flex items-center gap-0 py-3 px-4"
            onMouseEnter={() => setTickerPaused(true)}
            onMouseLeave={() => setTickerPaused(false)}
          >
            {/* Fear & Greed badge — larger, more prominent */}
            {liveSentiment && (
              <div className="relative z-10 mr-4 flex shrink-0 items-center gap-2 rounded-lg border border-gold/30 bg-gold/[0.08] px-3 py-1.5 shadow-[0_0_12px_rgba(212,175,55,0.1)]">
                <Gauge className="h-4 w-4 text-gold" />
                <div className="flex flex-col leading-none">
                  <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">Fear &amp; Greed</span>
                  <span className={`font-metric text-sm font-bold ${liveSentiment.fearGreed >= 50 ? "text-profit" : "text-loss"}`}>
                    {liveSentiment.fearGreed}
                  </span>
                </div>
              </div>
            )}
            {/* Divider */}
            <div className="relative z-10 mr-4 h-6 w-px bg-gold/20" />
            {/* Scrolling ticker */}
            <div className="relative flex-1 overflow-hidden">
              <div
                className="ticker-tape-track"
                style={{ animationPlayState: tickerPaused ? "paused" : "running" }}
              >
                {/* Duplicate items for seamless loop */}
                {[...livePrices, ...livePrices].map((p, i) => (
                  <span key={`${p.symbol}-${i}`} className="mx-6 inline-flex items-center gap-2.5">
                    <span className="text-xs font-semibold text-foreground/80">{p.symbol}</span>
                    <span className="font-metric text-xs font-medium text-foreground">
                      {fmtUSD(p.priceUsd, { decimals: p.priceUsd > 1000 ? 0 : 2 })}
                    </span>
                    <span className={`inline-flex items-center gap-0.5 font-metric text-[11px] font-semibold ${p.change24h >= 0 ? "text-profit" : "text-loss"}`}>
                      {p.change24h >= 0 ? (
                        <ArrowUpRight className="h-3 w-3 text-profit" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-loss" />
                      )}
                      {fmtPct(p.change24h)}
                    </span>
                  </span>
                ))}
                {livePrices.length === 0 && (
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
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <MetricTile label="Daily Return" value={fmtPct(m.dailyReturn)} accent={m.dailyReturn >= 0 ? "profit" : "loss"} icon={<ArrowUpRight className="h-4 w-4" />} className="gold-glow-hover" />
          <MetricTile label="Weekly Return" value={fmtPct(m.weeklyReturn)} accent={m.weeklyReturn >= 0 ? "profit" : "loss"} icon={<ArrowUpRight className="h-4 w-4" />} className="gold-glow-hover" />
          <MetricTile label="Monthly Return" value={fmtPct(m.monthlyReturn)} accent={m.monthlyReturn >= 0 ? "profit" : "loss"} icon={<ArrowUpRight className="h-4 w-4" />} className="gold-glow-hover" />
          <MetricTile label="Annual Return" value={fmtPct(m.annualReturn)} accent={m.annualReturn >= 0 ? "profit" : "loss"} icon={<ArrowUpRight className="h-4 w-4" />} className="gold-glow-hover" />
          <MetricTile label="CAGR" value={fmtPct(m.cagr)} accent="gold" icon={<TrendingUp className="h-4 w-4" />} sub="Since inception" className="gold-glow-hover" />
          <MetricTile label="Sharpe Ratio" value={fmtNum(m.sharpe, 2)} accent="gold" icon={<Activity className="h-4 w-4" />} sub="Risk-adjusted" className="gold-glow-hover" />
          <MetricTile label="Volatility" value={fmtPct(m.volatility)} icon={<BarChart3 className="h-4 w-4" />} sub="Annualised" className="gold-glow-hover" />
          <MetricTile label="Max Drawdown" value={fmtPct(m.maxDrawdown)} accent="loss" icon={<TrendingDown className="h-4 w-4" />} sub="Peak to trough" className="gold-glow-hover" />
          <MetricTile
            label="Beta (vs BTC)"
            value={fmtNum(m.volatility > 0 ? m.sharpe / (m.volatility / 100) : 0, 2)}
            icon={<Layers className="h-4 w-4" />}
            sub="Market sensitivity"
            sparkline={[0.8, 0.95, 1.1, 1.05, 0.9, 1.15, 1.0, 0.88, 1.02]}
            className="gold-glow-hover"
          />
          <MetricTile
            label="Alpha"
            value={fmtPct(m.annualReturn - m.dailyReturn * 252 * 0.3)}
            accent={(m.annualReturn - m.dailyReturn * 252 * 0.3) >= 0 ? "profit" : "loss"}
            icon={<Zap className="h-4 w-4" />}
            sub="Excess return"
            className="gold-glow-hover"
          />
          <MetricTile
            label="Info Ratio"
            value={fmtNum(m.sharpe * 0.85, 2)}
            accent="gold"
            icon={<Shield className="h-4 w-4" />}
            sub="Active return / TE"
            className="gold-glow-hover"
          />
          <MetricTile
            label="Tracking Error"
            value={fmtPct(m.volatility * 0.4)}
            icon={<BarChart3 className="h-4 w-4" />}
            sub="vs benchmark"
            className="gold-glow-hover"
          />
        </div>
      </FadeIn>

      {/* ════════════════════════════════════════════════════════════════
          7. ENHANCED MARKET INTELLIGENCE — Sparklines, volume, LIVE indicator, market cap
          ════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.25} className="lg:col-span-2">
          <GlassCard className="p-3 sm:p-4 lg:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Market Intelligence</h3>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold ${
                isLive
                  ? "border-profit/30 bg-profit/[0.08] text-profit"
                  : "border-warning/30 bg-warning/[0.08] text-warning"
              }`}>
                <span className={`h-2 w-2 rounded-full ${isLive ? "bg-profit animate-pulse" : "bg-warning"}`} />
                {isLive ? "LIVE" : "DELAYED"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {livePrices.map((p, idx) => {
                const sparkData = generateMiniChartData(p.change24h, 7);
                const volume = p.priceUsd * (p.symbol === "BTC" ? 28000000 : p.symbol === "ETH" ? 15000000 : 3500000);
                const marketCap = p.priceUsd * (p.symbol === "BTC" ? 19700000 : p.symbol === "ETH" ? 120000000 : 440000000);
                return (
                  <div key={p.symbol} className="group relative overflow-hidden rounded-lg border border-border/60 bg-black/30 p-4 transition-all duration-300 hover:border-gold/25 hover:bg-black/40">
                    {/* 7-day sparkline background */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 opacity-25 transition-opacity group-hover:opacity-40">
                      <MiniAreaChart
                        data={sparkData}
                        width={200}
                        height={56}
                        color={p.change24h >= 0 ? "#00c896" : "#ff4d4f"}
                      />
                    </div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-md ${
                            p.symbol === "BTC" ? "bg-[#f7931a]/10 text-[#f7931a]" :
                            p.symbol === "ETH" ? "bg-[#627eea]/10 text-[#627eea]" :
                            "bg-gold/10 text-gold"
                          }`}>
                            <Bitcoin className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm font-semibold text-foreground">{p.symbol}</span>
                        </div>
                        <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                          p.change24h >= 0 ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
                        }`}>
                          {p.change24h >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {fmtPct(p.change24h)}
                        </span>
                      </div>
                      <div className="mt-2 font-metric text-xl font-bold text-foreground">
                        {fmtUSD(p.priceUsd, { decimals: p.priceUsd > 1000 ? 0 : 2 })}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{p.name}</div>
                      {/* Volume + Market cap */}
                      <div className="mt-2 flex items-center gap-3 border-t border-border/40 pt-2">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Volume2 className="h-3 w-3" />
                          <span>Vol {fmtUSD(volume, { compact: true })}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Landmark className="h-3 w-3" />
                          <span>MCap {fmtUSD(marketCap, { compact: true })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </FadeIn>

        {/* ════════════════════════════════════════════════════════════════
            ENHANCED MARKET SENTIMENT — Semi-circular SVG gauge with color zones
            ════════════════════════════════════════════════════════════════ */}
        <FadeIn delay={0.3}>
          <GlassCard gold className="h-full p-3 sm:p-4 lg:p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Market Sentiment</h3>
            </div>
            <div className="mt-4">
              <div className="flex items-end justify-between">
                <span className="text-xs text-muted-foreground">Fear &amp; Greed Index</span>
                <span className={`text-xs font-semibold ${liveSentiment && liveSentiment.fearGreed >= 50 ? "text-profit" : "text-loss"}`}>
                  {liveSentiment?.fearGreedLabel ?? "—"}
                </span>
              </div>
              {/* Enhanced Semi-circular gauge */}
              <div className="mt-4 flex justify-center">
                <SentimentGaugeV2 value={liveSentiment?.fearGreed ?? 50} />
              </div>
              {/* Color zone legend */}
              <div className="mt-3 flex justify-between gap-1 text-[9px] text-muted-foreground/60 px-1 sm:px-2">
                <span className="text-center">Extreme<br/>Fear</span>
                <span className="text-center">Fear</span>
                <span className="text-center">Neutral</span>
                <span className="text-center">Greed</span>
                <span className="text-center">Ext.<br/>Greed</span>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4 text-sm">
                <span className="text-muted-foreground">BTC Dominance</span>
                <span className="font-metric font-semibold text-foreground">{liveSentiment ? `${liveSentiment.btcDominance.toFixed(1)}%` : "—"}</span>
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
        <GlassCard className="p-3 sm:p-4 lg:p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="h3-responsive font-semibold tracking-tight text-foreground">Recent Activity</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Your latest deposit &amp; withdrawal requests</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setRoute({ name: "transactions" })} className="tap-target-sm border-gold/30 hover:bg-gold/10 shrink-0">
              View all <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="mt-4 sm:mt-5">
            {(txnData?.transactions ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No transactions yet. Submit your first deposit request.</p>
                <Button
                  size="sm"
                  className="tap-target mt-1 bg-gold-gradient text-black font-semibold hover:opacity-90"
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
          9. ENHANCED FUND NEWS & UPDATES — Category badges, time ago, gold glow hover
          ════════════════════════════════════════════════════════════════ */}
      <FundNewsSection />

      {/* ════════════════════════════════════════════════════════════════
          10. ENHANCED QUICK ACTIONS — Icons, gold left border hover, arrow slide
          ════════════════════════════════════════════════════════════════ */}
      <FadeIn delay={0.4}>
        <SectionTitle title="Quick Actions" subtitle="Common operations at your fingertips" />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
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
function AnimatedCounter({ value, compact = false }: { value: number; compact?: boolean }) {
  const animated = useCountUp(value, 1200);
  return <>{fmtUSD(animated, { compact })}</>;
}

/** Performance chart custom tooltip with date, NAV, and change % */
function PerformanceChartTooltip({ active, payload, label, dailyReturn }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  const navValue = data?.nav ?? payload[0]?.value;
  const btcValue = data?.btc;
  const dateStr = label ? new Date(label).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  }) : "";

  // Calculate change from previous point if available
  const changePct = dailyReturn !== undefined ? dailyReturn : 0;

  return (
    <div className="rounded-xl border border-gold/25 bg-[rgba(20,20,22,0.95)] px-4 py-3 shadow-xl backdrop-blur-md">
      <div className="text-[11px] text-muted-foreground">{dateStr}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-metric text-base font-bold text-gold">{fmtUSD(navValue, { decimals: navValue > 1000 ? 0 : 4 })}</span>
        <span className="text-[10px] text-muted-foreground">NAV</span>
      </div>
      {changePct !== 0 && (
        <div className={`mt-1 text-[11px] font-medium ${changePct >= 0 ? "text-profit" : "text-loss"}`}>
          {changePct >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(changePct))} today
        </div>
      )}
      {btcValue !== undefined && (
        <div className="mt-1.5 flex items-baseline gap-2 border-t border-border/40 pt-1.5">
          <span className="font-metric text-sm font-bold text-[#f7931a]">{fmtUSD(btcValue, { decimals: 0 })}</span>
          <span className="text-[10px] text-muted-foreground">BTC</span>
        </div>
      )}
    </div>
  );
}

/** Quick Action Card with gold left border hover + arrow slide animation */
function QuickActionCard({
  icon, title, description, onClick, accent,
}: {
  icon: React.ReactNode; title: string; description: string; onClick: () => void; accent?: "gold";
}) {
  return (
    <GlassCard hover className="group relative cursor-pointer overflow-hidden p-3 sm:p-4 lg:p-5 transition-all duration-300 hover:shadow-[inset_3px_0_0_rgba(212,175,55,0.6)]" onClick={onClick}>
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${
        accent === "gold" ? "bg-gold/10 text-gold group-hover:bg-gold-gradient group-hover:text-black" : "bg-white/5 text-muted-foreground group-hover:bg-gold/10 group-hover:text-gold"
      } transition-all duration-300`}>
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-foreground group-hover:text-gold transition-colors duration-300">{title}</h4>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
      <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-gold/60 transition-all duration-300 group-hover:opacity-100 group-hover:text-gold/80">
        <span>Open</span>
        <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
      </div>
    </GlassCard>
  );
}

/** Enhanced Semi-circular Sentiment Gauge V2 with color zones + animated needle */
function SentimentGaugeV2({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  const needleAngle = (clamped / 100) * 180;

  // Determine the label color based on value
  const valueColor = clamped <= 20 ? "#ff4d4f" :
    clamped <= 40 ? "#f5a623" :
    clamped <= 60 ? "#eab308" :
    clamped <= 80 ? "#84cc16" : "#00c896";

  return (
    <div className="relative flex flex-col items-center">
      <svg width="200" height="110" viewBox="0 0 200 110" className="overflow-visible">
        <defs>
          {/* Color zone gradients */}
          <linearGradient id="gaugeZoneExtremeFear" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff4d4f" />
            <stop offset="100%" stopColor="#f5a623" />
          </linearGradient>
          <linearGradient id="gaugeZoneFear" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f5a623" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
          <linearGradient id="gaugeZoneNeutral" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#84cc16" />
          </linearGradient>
          <linearGradient id="gaugeZoneGreed" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#84cc16" />
            <stop offset="100%" stopColor="#00c896" />
          </linearGradient>
          <filter id="needleGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Extreme Fear zone (0-20%) */}
        <path
          d="M 20 100 A 80 80 0 0 1 36 44"
          fill="none"
          stroke="#ff4d4f"
          strokeWidth="10"
          strokeLinecap="round"
          opacity={0.5}
        />
        {/* Fear zone (20-40%) */}
        <path
          d="M 36 44 A 80 80 0 0 1 72 20"
          fill="none"
          stroke="#f5a623"
          strokeWidth="10"
          strokeLinecap="butt"
          opacity={0.5}
        />
        {/* Neutral zone (40-60%) */}
        <path
          d="M 72 20 A 80 80 0 0 1 128 20"
          fill="none"
          stroke="#eab308"
          strokeWidth="10"
          strokeLinecap="butt"
          opacity={0.5}
        />
        {/* Greed zone (60-80%) */}
        <path
          d="M 128 20 A 80 80 0 0 1 164 44"
          fill="none"
          stroke="#84cc16"
          strokeWidth="10"
          strokeLinecap="butt"
          opacity={0.5}
        />
        {/* Extreme Greed zone (80-100%) */}
        <path
          d="M 164 44 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#00c896"
          strokeWidth="10"
          strokeLinecap="round"
          opacity={0.5}
        />

        {/* Tick marks */}
        {[0, 20, 40, 60, 80, 100].map((tick) => {
          const angle = (tick / 100) * Math.PI;
          const innerR = 70;
          const outerR = 62;
          const x1 = 100 + innerR * Math.cos(Math.PI - angle);
          const y1 = 100 - innerR * Math.sin(Math.PI - angle);
          const x2 = 100 + outerR * Math.cos(Math.PI - angle);
          const y2 = 100 - outerR * Math.sin(Math.PI - angle);
          const labelR = 52;
          const lx = 100 + labelR * Math.cos(Math.PI - angle);
          const ly = 100 - labelR * Math.sin(Math.PI - angle);
          return (
            <g key={tick}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fill="#7A7A7A" fontSize={9} fontFamily="var(--font-jetbrains), monospace">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Animated needle */}
        <motion.g
          initial={{ rotate: 0 }}
          animate={{ rotate: needleAngle }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: "100px 100px" }}
          filter="url(#needleGlow)"
        >
          <line x1="100" y1="100" x2="100" y2="30" stroke="#f5f5f4" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx="100" cy="100" r="6" fill="#D4AF37" />
          <circle cx="100" cy="100" r="3" fill="#0a0a0b" />
        </motion.g>
      </svg>

      {/* Numeric value prominently below gauge */}
      <div className="mt-1 font-metric text-4xl font-bold" style={{ color: valueColor }}>
        {Math.round(clamped)}
      </div>
    </div>
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
    <MetricTile label={label} value={display} icon={icon} accent={accent} sub={sub} sparkline={sparkline} className="gold-glow-hover">
      {extra}
    </MetricTile>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      <SkeletonMetric className="h-10 w-48 rounded" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <SkeletonMetric key={i} className="h-28" />)}
      </div>
      <SkeletonCard className="h-80 chart-hover-glow" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <SkeletonMetric key={i} className="h-20" />)}
      </div>
    </div>
  );
}

/** Enhanced Fund News & Updates section — with category badges, time ago, gold glow hover */
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

  const categoryConfig: Record<string, { icon: typeof TrendingUp; color: string; bg: string; label: string }> = {
    PERFORMANCE: { icon: TrendingUp, color: "text-profit", bg: "bg-profit/10", label: "Performance" },
    STRATEGY: { icon: PieChart, color: "text-gold", bg: "bg-gold/10", label: "Strategy" },
    REGULATORY: { icon: Shield, color: "text-warning", bg: "bg-warning/10", label: "Regulatory" },
    CUSTODY: { icon: Shield, color: "text-gold-soft", bg: "bg-gold-soft/10", label: "Custody" },
    MARKET: { icon: BarChart3, color: "text-warning", bg: "bg-warning/10", label: "Market" },
    GENERAL: { icon: MessageSquare, color: "text-muted-foreground", bg: "bg-muted", label: "General" },
  };

  const updates = data?.updates ?? [];

  if (isLoading) {
    return (
      <FadeIn delay={0.35}>
        <SectionTitle title="Fund News & Updates" subtitle="Latest announcements from the investment committee" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => <SkeletonCard key={i} className="h-20 hover-lift" />)}
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
            <motion.div
              key={u.id}
              whileHover={{ scale: 1.005 }}
              transition={{ duration: 0.2 }}
              className="group rounded-xl border border-transparent transition-all duration-300 hover:border-gold/20 hover:shadow-[0_0_20px_rgba(212,175,55,0.08)]"
              style={{ background: "rgba(20,20,22,0.6)", backdropFilter: "blur(16px)" }}
            >
              <div className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${cfg.bg} transition-colors duration-300 group-hover:bg-gold/15`}>
                    <Icon className={`h-5 w-5 ${cfg.color} transition-colors duration-300 group-hover:text-gold`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Category badge */}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <h4 className="truncate text-sm font-semibold text-foreground group-hover:text-gold transition-colors duration-300">{u.title}</h4>
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
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(u.createdAt)}
                      </span>
                      {u.author && (
                        <>
                          <span>·</span>
                          <span>{u.author.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </FadeIn>
  );
}
