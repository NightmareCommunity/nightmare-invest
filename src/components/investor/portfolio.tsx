"use client";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, MetricTile, SectionTitle, FadeIn, SkeletonCard, SkeletonMetric } from "@/components/brand/primitives";
import { fmtUSD, fmtNum, fmtPct, fmtDate } from "@/lib/format";
import { useApp } from "@/lib/store";
import {
  Wallet,
  Layers,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  BarChart3,
  Zap,
  Target,
  ChevronRight,
  RefreshCw,
  CircleDollarSign,
  Scale,
  Download,
  GitCompare,
  Trophy,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  AreaChart,
  Area,
  ReferenceLine,
  ComposedChart,
  Line,
  Legend,
} from "recharts";
import { motion } from "framer-motion";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Benchmark Configuration                                            */
/* ------------------------------------------------------------------ */
type BenchmarkKey = "sp500" | "bitcoin" | "ethereum" | "nasdaq100";

const BENCHMARKS: Record<BenchmarkKey, { label: string; annualReturn: number; color: string }> = {
  sp500: { label: "S&P 500", annualReturn: 10, color: "#00c896" },
  bitcoin: { label: "Bitcoin", annualReturn: 45, color: "#f5a623" },
  ethereum: { label: "Ethereum", annualReturn: 35, color: "#b08d57" },
  nasdaq100: { label: "Nasdaq 100", annualReturn: 15, color: "#e06060" },
};

/* ------------------------------------------------------------------ */
/*  Main Page Component                                                */
/* ------------------------------------------------------------------ */
export function PortfolioPage() {
  const { setRoute } = useApp();
  const [navRange, setNavRange] = useState<"1M" | "3M" | "6M" | "1Y" | "ALL">("1Y");
  const [activeBenchmarks, setActiveBenchmarks] = useState<Set<BenchmarkKey>>(new Set(["sp500"]));

  const { data, isLoading } = useQuery<any>({
    queryKey: ["portfolio"],
    queryFn: () => api.get("/api/portfolio"),
  });

  const { data: navHistory } = useQuery<any[]>({
    queryKey: ["nav-history", data?.fund?.id, navRange],
    queryFn: () => api.get(`/api/fund/nav-history?fundId=${data.fund.id}&range=${navRange}`),
    enabled: !!data?.fund?.id,
  });

  const { data: txnData } = useQuery<any>({
    queryKey: ["portfolio-transactions"],
    queryFn: () => api.get("/api/transactions"),
    enabled: !!data,
  });

  // NAV chart data (hook must be before any early return)
  const navChartData = useMemo(() => {
    if (!navHistory || navHistory.length === 0) return [];
    return navHistory.map((p: any) => ({
      date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      nav: p.nav,
      aum: p.aum,
    }));
  }, [navHistory]);

  // Benchmark comparison chart data (normalized to 100)
  const benchmarkChartData = useMemo(() => {
    if (!navHistory || navHistory.length === 0) return [];
    const firstNav = navHistory[0].nav;
    return navHistory.map((p: any, idx: number) => {
      const fundNorm = (p.nav / firstNav) * 100;
      const point: Record<string, any> = {
        date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        fund: Math.round(fundNorm * 100) / 100,
      };
      for (const [key, bm] of Object.entries(BENCHMARKS)) {
        if (activeBenchmarks.has(key as BenchmarkKey)) {
          // Simulate with noise around annualized return
          const dailyRate = bm.annualReturn / 100 / 252;
          const noise = (Math.sin(idx * 0.3 + key.length * 7) * 0.003 + Math.cos(idx * 0.7 + key.length * 3) * 0.002);
          const bmNorm = 100 * Math.pow(1 + dailyRate + noise, idx);
          point[key] = Math.round(bmNorm * 100) / 100;
        }
      }
      return point;
    });
  }, [navHistory, activeBenchmarks]);

  // Benchmark comparison table data
  const benchmarkTableData = useMemo(() => {
    if (!navHistory || navHistory.length === 0) return [];
    const totalPoints = navHistory.length;
    const firstNav = navHistory[0].nav;

    // Fund returns at various windows
    const fundReturnAt = (days: number) => {
      const idx = Math.max(0, totalPoints - days);
      if (idx >= totalPoints) return 0;
      return ((navHistory[totalPoints - 1].nav - navHistory[idx].nav) / navHistory[idx].nav) * 100;
    };

    const fundRow = {
      name: "Nightmare Fund",
      isFund: true,
      "1M": fundReturnAt(30),
      "3M": fundReturnAt(90),
      "1Y": fundReturnAt(365),
      sinceInception: ((navHistory[totalPoints - 1].nav - firstNav) / firstNav) * 100,
      correlation: 1,
    };

    const rows = [fundRow];
    for (const [key, bm] of Object.entries(BENCHMARKS)) {
      if (!activeBenchmarks.has(key as BenchmarkKey)) continue;
      const bmReturnAt = (days: number) => {
        const dailyRate = bm.annualReturn / 100 / 252;
        return (Math.pow(1 + dailyRate, days) - 1) * 100;
      };
      rows.push({
        name: bm.label,
        isFund: false,
        "1M": bmReturnAt(30),
        "3M": bmReturnAt(90),
        "1Y": bmReturnAt(365),
        sinceInception: bmReturnAt(totalPoints),
        // Simulate correlation between 0.3–0.8 depending on asset type
        correlation: key === "sp500" ? 0.62 : key === "nasdaq100" ? 0.55 : key === "bitcoin" ? 0.35 : 0.38,
      });
    }
    return rows;
  }, [navHistory, activeBenchmarks]);

  // Alpha calculation (fund vs primary selected benchmark)
  const primaryBenchmark = useMemo(() => {
    const first = activeBenchmarks.values().next().value;
    return first || null;
  }, [activeBenchmarks]);

  const alphaVsPrimary = useMemo(() => {
    if (!navHistory || navHistory.length === 0 || !primaryBenchmark) return 0;
    const totalPoints = navHistory.length;
    const firstNav = navHistory[0].nav;
    const fundReturn = ((navHistory[totalPoints - 1].nav - firstNav) / firstNav) * 100;
    const bm = BENCHMARKS[primaryBenchmark];
    const dailyRate = bm.annualReturn / 100 / 252;
    const bmReturn = (Math.pow(1 + dailyRate, totalPoints) - 1) * 100;
    return fundReturn - bmReturn;
  }, [navHistory, primaryBenchmark]);

  // Toggle benchmark
  const toggleBenchmark = (key: BenchmarkKey) => {
    setActiveBenchmarks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // keep at least one
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (isLoading || !data) return <PortfolioSkeleton />;

  const { summary: s, metrics: m, allocations, fund, holding } = data;
  const exposureData = allocations.map((a: any) => ({
    name: a.asset.split(" ")[0],
    value: (a.weight / 100) * s.currentValue,
    color: a.color,
    weight: a.weight,
  }));

  // Compute derived values
  const daysInvested = holding?.updatedAt
    ? Math.max(1, Math.floor((Date.now() - new Date(holding.updatedAt).getTime()) / 86400000))
    : 0;
  const nextNavUpdate = getNextNavUpdate();

  // Transaction summary
  const txns = txnData?.transactions ?? [];
  const deposits = txns.filter((t: any) => t.type === "DEPOSIT" && t.status === "APPROVED");
  const withdrawals = txns.filter((t: any) => t.type === "WITHDRAWAL" && t.status === "APPROVED");
  const totalDeposited = deposits.reduce((a: number, t: any) => a + t.amount, 0);
  const totalWithdrawn = withdrawals.reduce((a: number, t: any) => a + t.amount, 0);
  const recentTxns = txns.slice(0, 5);

  // Sparkline data for metric tiles (derived from metrics)
  const valueSparkline = m?.navHistory?.slice(-14).map((p: any) => p.nav * s.units) ?? [];
  const pnlSparkline = m?.navHistory?.slice(-14).map((p: any) => (p.nav - s.avgPrice) * s.units) ?? [];

  // Risk metrics from portfolio data
  const riskMetrics = [
    { label: "Volatility", value: fmtPct(m?.volatility ?? 0), icon: <Zap className="h-4 w-4" />, pct: Math.min(Math.abs(m?.volatility ?? 0) / 100, 1), color: "#D4AF37" },
    { label: "Max Drawdown", value: fmtPct(m?.maxDrawdown ?? 0), icon: <TrendingDown className="h-4 w-4" />, pct: Math.min(Math.abs(m?.maxDrawdown ?? 0) / 50, 1), color: "#ff4d4f" },
    { label: "Sharpe Ratio", value: fmtNum(m?.sharpe ?? 0, 2), icon: <Scale className="h-4 w-4" />, pct: Math.min(Math.max(m?.sharpe ?? 0, 0) / 3, 1), color: "#00c896" },
    { label: "CAGR", value: fmtPct(m?.cagr ?? 0), icon: <TrendingUp className="h-4 w-4" />, pct: Math.min(Math.abs(m?.cagr ?? 0) / 50, 1), color: "#4a90e2" },
  ];

  // Delta from last month
  const monthlyDelta = m?.monthlyReturn
    ? (s.currentValue * m.monthlyReturn) / 100
    : 0;

  return (
    <div className="space-y-6">
      {/* ─── 1. Page Header ─── */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">
              Investor Portal
            </span>
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Portfolio</h1>
              <span className="shimmer-badge inline-flex items-center gap-1.5 rounded-full border border-profit/30 bg-profit/10 px-2.5 py-0.5 text-[11px] font-medium text-profit">
                <span className="h-1.5 w-1.5 rounded-full bg-profit animate-pulse" />
                Active
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>{fund.name}</span>
              <span className="text-foreground/20">•</span>
              <Clock className="h-3.5 w-3.5" />
              <span>Updated {fmtDate(holding?.updatedAt ?? new Date().toISOString())}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setRoute({ name: "transactions" })}
              className="inline-flex items-center gap-2 rounded-lg bg-gold-gradient px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-gold/20 transition-all duration-200 hover:shadow-gold/30 hover:brightness-110 active:scale-[0.97]"
            >
              <CircleDollarSign className="h-4 w-4" />
              Deposit
            </button>
            <button
              onClick={() => setRoute({ name: "transactions" })}
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-white/[0.04] px-4 py-2 text-sm font-medium text-foreground/80 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.08] hover:text-foreground active:scale-[0.97]"
            >
              <BarChart3 className="h-4 w-4" />
              View Transactions
            </button>
            <button
              onClick={() => toast.info("Report generation will be available soon")}
              className="inline-flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/[0.06] px-4 py-2 text-sm font-semibold text-gold backdrop-blur-sm transition-all duration-200 hover:bg-gold/[0.12] hover:shadow-[0_0_16px_rgba(212,175,55,0.15)] active:scale-[0.97]"
            >
              <Download className="h-4 w-4" />
              Download Report
            </button>
          </div>
        </div>
      </FadeIn>

      {/* ─── 2. Summary Metrics ─── */}
      <FadeIn delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label="Current Value"
            value={fmtUSD(s.currentValue)}
            accent="gold"
            icon={
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
                <Wallet className="h-4 w-4 text-gold" />
              </span>
            }
            sparkline={valueSparkline}
            sub={
              monthlyDelta !== 0 ? (
                <span className={monthlyDelta >= 0 ? "text-profit" : "text-loss"}>
                  {monthlyDelta >= 0 ? "+" : ""}
                  {fmtUSD(monthlyDelta)} since last month
                </span>
              ) : undefined
            }
            className="gold-glow-hover"
          />
          <MetricTile
            label="Invested Capital"
            value={fmtUSD(s.investedCapital)}
            icon={
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10">
                <Activity className="h-4 w-4 text-info" />
              </span>
            }
            sub={fmtNum(s.units, 4) + " units"}
            className="gold-glow-hover"
          />
          <MetricTile
            label="Unrealized P&L"
            value={fmtUSD(s.unrealizedPnl)}
            accent={s.unrealizedPnl >= 0 ? "profit" : "loss"}
            icon={
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  s.unrealizedPnl >= 0 ? "bg-profit/10" : "bg-loss/10"
                }`}
              >
                {s.unrealizedPnl >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-profit" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-loss" />
                )}
              </span>
            }
            sparkline={pnlSparkline}
            sub={`${fmtPct(s.roi)} ROI`}
            className="gold-glow-hover"
          />
          <MetricTile
            label="Units Held"
            value={fmtNum(s.units, 4)}
            accent="gold"
            icon={
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
                <Layers className="h-4 w-4 text-gold" />
              </span>
            }
            sub={`Avg ${fmtUSD(s.avgPrice, { decimals: 4 })}`}
            className="gold-glow-hover"
          />
        </div>
      </FadeIn>

      {/* ─── 3. NAV Performance Chart ─── */}
      <FadeIn delay={0.1}>
        <GlassCard className="p-5" glow>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <SectionTitle
              title="NAV Performance"
              subtitle="Net Asset Value over time"
              className="mb-0"
            />
            <div className="flex gap-1 rounded-lg bg-white/[0.04] p-1">
              {(["1M", "3M", "6M", "1Y", "ALL"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setNavRange(r)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 ${
                    navRange === r
                      ? "bg-gold/20 text-gold shadow-sm"
                      : "text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 h-72">
            {navChartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={navChartData} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.35} />
                      <stop offset="60%" stopColor="#D4AF37" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="navStroke" x1="0" y1="0" x2="1" y2="0">
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
                    tickFormatter={(v) => `$${v.toFixed(2)}`}
                    tick={{ fill: "#7A7A7A", fontSize: 11 }}
                    stroke="rgba(255,255,255,0.08)"
                    width={64}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(212,175,55,0.3)", strokeDasharray: "4 4" }}
                    contentStyle={{
                      background: "rgba(20,20,22,0.95)",
                      border: "1px solid rgba(212,175,55,0.25)",
                      borderRadius: "10px",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    }}
                    formatter={(v: number, name: string) => [
                      name === "nav" ? fmtUSD(v, { decimals: 4 }) : fmtUSD(v),
                      name === "nav" ? "NAV" : "AUM",
                    ]}
                    labelStyle={{ color: "#9a9a9a", fontSize: 12 }}
                  />
                  {fund.inceptionNav && (
                    <ReferenceLine
                      y={fund.inceptionNav}
                      stroke="rgba(212,175,55,0.25)"
                      strokeDasharray="6 4"
                      label={{
                        value: "Inception",
                        position: "right",
                        fill: "rgba(212,175,55,0.5)",
                        fontSize: 10,
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="nav"
                    stroke="url(#navStroke)"
                    strokeWidth={2.5}
                    fill="url(#navGradient)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: "#D4AF37",
                      stroke: "#0a0a0b",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <BarChart3 className="h-8 w-8 text-gold/30" />
                  <span>NAV history will appear as the fund reports values</span>
                </div>
              </div>
            )}
          </div>
          {/* Quick stats below chart */}
          {m && (
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/40 pt-4 sm:grid-cols-4">
              <div>
                <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                  Daily
                </span>
                <div className={`mt-0.5 font-metric text-sm font-semibold ${m.dailyReturn >= 0 ? "text-profit" : "text-loss"}`}>
                  {fmtPct(m.dailyReturn)}
                </div>
              </div>
              <div>
                <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                  Weekly
                </span>
                <div className={`mt-0.5 font-metric text-sm font-semibold ${m.weeklyReturn >= 0 ? "text-profit" : "text-loss"}`}>
                  {fmtPct(m.weeklyReturn)}
                </div>
              </div>
              <div>
                <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                  Monthly
                </span>
                <div className={`mt-0.5 font-metric text-sm font-semibold ${m.monthlyReturn >= 0 ? "text-profit" : "text-loss"}`}>
                  {fmtPct(m.monthlyReturn)}
                </div>
              </div>
              <div>
                <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                  Annual
                </span>
                <div className={`mt-0.5 font-metric text-sm font-semibold ${m.annualReturn >= 0 ? "text-profit" : "text-loss"}`}>
                  {fmtPct(m.annualReturn)}
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </FadeIn>

      {/* ─── 4. Asset Exposure + Position Detail ─── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.15} className="lg:col-span-2">
          <GlassCard className="p-5">
            <div className="flex items-end justify-between">
              <SectionTitle title="Asset Exposure" subtitle="USD value across fund allocations" className="mb-0" />
              <div className="text-right">
                <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                  Total Exposure
                </span>
                <div className="font-metric text-base font-semibold text-gold">
                  {fmtUSD(s.currentValue)}
                </div>
              </div>
            </div>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exposureData} margin={{ top: 6, right: 6, left: 6, bottom: 0 }} barSize={48}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: "#7A7A7A", fontSize: 11 }} stroke="rgba(255,255,255,0.08)" />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    tick={{ fill: "#7A7A7A", fontSize: 11 }}
                    stroke="rgba(255,255,255,0.08)"
                    width={56}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(212,175,55,0.06)" }}
                    contentStyle={{
                      background: "rgba(20,20,22,0.95)",
                      border: "1px solid rgba(212,175,55,0.25)",
                      borderRadius: "10px",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    }}
                    formatter={(v: number, _name: string, props: any) => [
                      <span key="val">
                        <span className="font-metric">{fmtUSD(v)}</span>
                        <span className="ml-2 text-muted-foreground">
                          ({props.payload.weight}%)
                        </span>
                      </span>,
                      "Exposure",
                    ]}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} minPointSize={4}>
                    {exposureData.map((e: any, i: number) => (
                      <Cell
                        key={i}
                        fill={e.color}
                        fillOpacity={0.85}
                        style={{ transition: "fill-opacity 0.2s ease" }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Weight summary below bars */}
            <div className="mt-3 flex flex-wrap gap-2">
              {exposureData.map((e: any) => (
                <span
                  key={e.name}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-white/[0.03] px-2 py-1 text-xs"
                >
                  <span className="h-2 w-2 rounded-sm" style={{ background: e.color }} />
                  <span className="text-foreground/70">{e.name}</span>
                  <span className="font-metric font-semibold text-foreground/90">{e.weight}%</span>
                </span>
              ))}
            </div>
          </GlassCard>
        </FadeIn>

        {/* ─── 5. Position Detail Card ─── */}
        <FadeIn delay={0.2}>
          <GlassCard gold className="h-full p-5" glow>
            {/* ROI Gauge */}
            <div className="mb-4 flex flex-col items-center">
              <div className="relative h-28 w-28">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke={s.roi >= 0 ? "#00c896" : "#ff4d4f"}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.min(Math.abs(s.roi), 100) * 2.64} 264`}
                    className="transition-all duration-1000 ease-out"
                    style={{ filter: `drop-shadow(0 0 6px ${s.roi >= 0 ? "rgba(0,200,150,0.4)" : "rgba(255,77,79,0.4)"})` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={`font-metric text-lg font-bold ${
                      s.roi >= 0 ? "text-profit" : "text-loss"
                    }`}
                  >
                    {fmtPct(s.roi)}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    ROI
                  </span>
                </div>
              </div>
            </div>

            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Position Detail
            </h3>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Fund" value={fund.name} />
              <Row label="Minimum Investment" value={fmtUSD(fund.minInvest)} />
              <Row label="Fee Structure" value={fund.feeStructure} small />
              <div className="border-t border-border/40 pt-3" />
              <Row label="Units" value={fmtNum(s.units, 4)} />
              <Row label="Average Cost / Unit" value={fmtUSD(s.avgPrice, { decimals: 4 })} />
              <Row label="Current NAV" value={fmtUSD(s.currentNav, { decimals: 4 })} />
              <div className="border-t border-border/40 pt-3" />
              <Row label="Position Opened" value={holding ? fmtDate(holding.updatedAt) : "—"} />
              <Row label="Days Invested" value={daysInvested > 0 ? `${daysInvested} days` : "—"} />
              <Row
                label="Next NAV Update"
                value={nextNavUpdate}
                icon={<RefreshCw className="h-3 w-3 text-gold/60" />}
              />
              <div className="border-t border-gold/20 pt-3">
                <Row
                  label="Total Return"
                  value={fmtPct(s.roi)}
                  highlight={s.roi >= 0 ? "profit" : "loss"}
                />
              </div>
            </dl>
          </GlassCard>
        </FadeIn>
      </div>

      {/* ─── 6. Allocation Breakdown ─── */}
      <FadeIn delay={0.25}>
        <GlassCard className="p-5">
          <div className="flex items-end justify-between">
            <SectionTitle
              title="Allocation Breakdown"
              subtitle="Target weights set by the investment committee"
              className="mb-0"
            />
            <div className="text-right">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                Total Allocation
              </span>
              <div className="font-metric text-base font-semibold text-foreground">
                {allocations.reduce((a: number, b: any) => a + b.weight, 0).toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {allocations.map((a: any) => {
              const usdValue = (a.weight / 100) * s.currentValue;
              const targetWeight = a.targetWeight ?? a.weight;
              const drift = a.weight - targetWeight;
              return (
                <div key={a.id}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2.5 text-foreground/90">
                      <span
                        className="h-3.5 w-3.5 rounded-sm shadow-sm"
                        style={{ background: a.color, boxShadow: `0 0 8px ${a.color}33` }}
                      />
                      <span className="font-medium">{a.asset}</span>
                      {drift !== 0 && (
                        <span
                          className={`text-[10px] font-metric ${
                            drift > 0 ? "text-profit" : "text-loss"
                          }`}
                        >
                          {drift > 0 ? "+" : ""}
                          {drift.toFixed(1)}pp drift
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-metric">
                        {fmtUSD(usdValue)}
                      </span>
                      <span className="font-metric font-semibold text-foreground">
                        {a.weight}%
                      </span>
                    </div>
                  </div>
                  <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-black/40">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: a.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${a.weight}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                    />
                    <div
                      className="absolute top-0 h-full rounded-full border-r border-dashed border-foreground/30"
                      style={{ left: `${targetWeight}%`, width: 0 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </FadeIn>

      {/* ─── 7. Risk Exposure Summary ─── */}
      <FadeIn delay={0.3}>
        <GlassCard className="p-5">
          <SectionTitle
            title="Risk Exposure"
            subtitle="Key risk metrics for your portfolio"
            action={
              <button
                onClick={() => setRoute({ name: "analytics" })}
                className="inline-flex items-center gap-1 text-xs text-gold/70 transition-colors hover:text-gold"
              >
                View Full Analytics <ChevronRight className="h-3 w-3" />
              </button>
            }
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {riskMetrics.map((rm) => (
              <div
                key={rm.label}
                className="rounded-xl border border-border/40 bg-white/[0.02] p-4 transition-all duration-300 hover:border-gold/25 hover:bg-gold/[0.03] hover:shadow-[0_0_16px_rgba(212,175,55,0.1)] gold-glow-hover"
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{rm.icon}</span>
                  <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                    {rm.label}
                  </span>
                </div>
                <div className="mt-2 font-metric text-xl font-semibold text-foreground">
                  {rm.value}
                </div>
                {/* Mini progress bar */}
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: rm.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${rm.pct * 100}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </FadeIn>

      {/* ─── 8. Portfolio Benchmarking ─── */}
      <FadeIn delay={0.33}>
        <GlassCard className="p-5" glow>
          <SectionTitle
            title="Portfolio Benchmarking"
            subtitle="Compare fund performance against major indices"
            action={
              <span className="flex items-center gap-1.5 text-xs text-gold/70">
                <GitCompare className="h-3.5 w-3.5" /> Normalized to 100
              </span>
            }
          />

          {/* Alpha metric tile */}
          {primaryBenchmark && benchmarkChartData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="mt-5"
            >
              <div className="flex items-center gap-4 rounded-xl border border-gold/25 bg-gold/[0.06] p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10">
                  <Trophy className="h-6 w-6 text-gold" />
                </div>
                <div>
                  <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                    Alpha vs {BENCHMARKS[primaryBenchmark].label}
                  </div>
                  <div className={`font-metric text-2xl font-bold ${alphaVsPrimary >= 0 ? "text-profit" : "text-loss"}`}>
                    {alphaVsPrimary >= 0 ? "+" : ""}{alphaVsPrimary.toFixed(2)}%
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                    Active Benchmark
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BENCHMARKS[primaryBenchmark].color }} />
                    <span className="text-sm font-medium text-foreground">{BENCHMARKS[primaryBenchmark].label}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Benchmark selection bar */}
          <div className="mt-5 flex flex-wrap gap-2">
            {(Object.entries(BENCHMARKS) as [BenchmarkKey, typeof BENCHMARKS[BenchmarkKey]][]).map(([key, bm]) => (
              <button
                key={key}
                onClick={() => toggleBenchmark(key)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all duration-200 ${
                  activeBenchmarks.has(key)
                    ? "border-gold/40 bg-gold/10 text-gold shadow-[0_0_12px_rgba(212,175,55,0.1)]"
                    : "border-border/40 bg-white/[0.02] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground/80"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{
                    background: activeBenchmarks.has(key) ? bm.color : "rgba(255,255,255,0.15)",
                  }}
                />
                {bm.label}
              </button>
            ))}
          </div>

          {/* Comparison chart */}
          <div className="mt-5 h-80">
            {benchmarkChartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={benchmarkChartData} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fundStrokeBenchmark" x1="0" y1="0" x2="1" y2="0">
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
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                    tick={{ fill: "#7A7A7A", fontSize: 11 }}
                    stroke="rgba(255,255,255,0.08)"
                    width={52}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(212,175,55,0.3)", strokeDasharray: "4 4" }}
                    contentStyle={{
                      background: "rgba(20,20,22,0.95)",
                      border: "1px solid rgba(212,175,55,0.25)",
                      borderRadius: "10px",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    }}
                    formatter={(v: number, name: string) => {
                      const label = name === "fund" ? "Fund" : BENCHMARKS[name as BenchmarkKey]?.label ?? name;
                      return [`${v.toFixed(2)}%`, label];
                    }}
                    labelStyle={{ color: "#9a9a9a", fontSize: 12 }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(value: string) => {
                      if (value === "fund") return "Nightmare Fund";
                      return BENCHMARKS[value as BenchmarkKey]?.label ?? value;
                    }}
                    iconType="line"
                    wrapperStyle={{ fontSize: 12, color: "#9a9a9a" }}
                  />
                  <ReferenceLine y={100} stroke="rgba(255,255,255,0.1)" strokeDasharray="6 4" />
                  {/* Fund NAV line — gold, solid, 3px */}
                  <Line
                    type="monotone"
                    dataKey="fund"
                    stroke="url(#fundStrokeBenchmark)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: "#D4AF37",
                      stroke: "#0a0a0b",
                      strokeWidth: 2,
                    }}
                  />
                  {/* Benchmark lines — dashed, colored */}
                  {(Object.entries(BENCHMARKS) as [BenchmarkKey, typeof BENCHMARKS[BenchmarkKey]][]).map(([key, bm]) =>
                    activeBenchmarks.has(key) ? (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={bm.color}
                        strokeWidth={2}
                        strokeDasharray="8 4"
                        dot={false}
                        activeDot={{
                          r: 4,
                          fill: bm.color,
                          stroke: "#0a0a0b",
                          strokeWidth: 2,
                        }}
                      />
                    ) : null
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <GitCompare className="h-8 w-8 text-gold/30" />
                  <span>Benchmark data will appear with NAV history</span>
                </div>
              </div>
            )}
          </div>

          {/* Performance comparison table */}
          {benchmarkTableData.length > 0 && (
            <div className="mt-5 space-y-3">
              <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-foreground/50">
                Performance Comparison
              </h4>
              <div className="space-y-2">
                {benchmarkTableData.map((row) => {
                  const fundRow = row as typeof benchmarkTableData[number] & { isFund?: boolean };
                  return (
                    <GlassCard
                      key={fundRow.name}
                      gold={!!fundRow.isFund}
                      className="p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 min-w-[140px]">
                          {fundRow.isFund ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded bg-gold/20">
                              <Trophy className="h-3.5 w-3.5 text-gold" />
                            </span>
                          ) : (
                            <span
                              className="h-6 w-6 rounded flex items-center justify-center text-[10px] font-bold"
                              style={{ background: `${BENCHMARKS[fundRow.name.toLowerCase().replace(" ", "") as BenchmarkKey]?.color ?? "#666"}20`, color: BENCHMARKS[fundRow.name.toLowerCase().replace(" ", "") as BenchmarkKey]?.color ?? "#666" }}
                            >
                              {fundRow.name.charAt(0)}
                            </span>
                          )}
                          <span className={`text-sm font-semibold ${fundRow.isFund ? "text-gold" : "text-foreground"}`}>
                            {fundRow.name}
                          </span>
                        </div>
                        <div className="grid flex-1 grid-cols-5 gap-3 text-center">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-foreground/40">1M</div>
                            <div className={`font-metric text-sm font-semibold ${fundRow["1M"] >= 0 ? "text-profit" : "text-loss"}`}>
                              {fmtPct(fundRow["1M"])}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-foreground/40">3M</div>
                            <div className={`font-metric text-sm font-semibold ${fundRow["3M"] >= 0 ? "text-profit" : "text-loss"}`}>
                              {fmtPct(fundRow["3M"])}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-foreground/40">1Y</div>
                            <div className={`font-metric text-sm font-semibold ${fundRow["1Y"] >= 0 ? "text-profit" : "text-loss"}`}>
                              {fmtPct(fundRow["1Y"])}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-foreground/40">Inception</div>
                            <div className={`font-metric text-sm font-semibold ${fundRow.sinceInception >= 0 ? "text-profit" : "text-loss"}`}>
                              {fmtPct(fundRow.sinceInception)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-foreground/40">Corr</div>
                            <div className="font-metric text-sm font-semibold text-foreground/70">
                              {fundRow.correlation.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            </div>
          )}
        </GlassCard>
      </FadeIn>

      {/* ─── 9. Transaction Summary ─── */}
      <FadeIn delay={0.35}>
        <GlassCard className="p-5">
          <div className="flex items-end justify-between">
            <SectionTitle
              title="Transaction Summary"
              subtitle="Recent deposit and withdrawal activity"
              className="mb-0"
            />
            <button
              onClick={() => setRoute({ name: "transactions" })}
              className="inline-flex items-center gap-1 text-xs text-gold/70 transition-colors hover:text-gold"
            >
              View All <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {/* Quick stats */}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-profit/20 bg-profit/[0.04] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-profit/10">
                  <ArrowUpRight className="h-3.5 w-3.5 text-profit" />
                </span>
                <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                  Total Deposited
                </span>
              </div>
              <div className="mt-2 font-metric text-lg font-semibold text-profit">
                {fmtUSD(totalDeposited)}
              </div>
            </div>
            <div className="rounded-xl border border-info/20 bg-info/[0.04] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/10">
                  <ArrowDownRight className="h-3.5 w-3.5 text-info" />
                </span>
                <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                  Total Withdrawn
                </span>
              </div>
              <div className="mt-2 font-metric text-lg font-semibold text-info">
                {fmtUSD(totalWithdrawn)}
              </div>
            </div>
            <div className="rounded-xl border border-gold/20 bg-gold/[0.04] p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/10">
                  <Target className="h-3.5 w-3.5 text-gold" />
                </span>
                <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-foreground/50">
                  Net Position
                </span>
              </div>
              <div className="mt-2 font-metric text-lg font-semibold text-gold">
                {fmtUSD(totalDeposited - totalWithdrawn)}
              </div>
            </div>
          </div>

          {/* Recent transactions list */}
          {recentTxns.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-foreground/50">
                Recent Activity
              </h4>
              <div className="mt-3 space-y-2">
                {recentTxns.map((txn: any) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between rounded-lg border border-border/30 bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          txn.type === "DEPOSIT" ? "bg-profit/10" : "bg-info/10"
                        }`}
                      >
                        {txn.type === "DEPOSIT" ? (
                          <ArrowUpRight className="h-4 w-4 text-profit" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-info" />
                        )}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-foreground">
                          {txn.type === "DEPOSIT" ? "Deposit" : "Withdrawal"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {fmtDate(txn.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-metric text-sm font-semibold ${
                          txn.type === "DEPOSIT" ? "text-profit" : "text-info"
                        }`}
                      >
                        {txn.type === "DEPOSIT" ? "+" : "-"}
                        {fmtUSD(txn.amount)}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          txn.status === "APPROVED"
                            ? "bg-profit/10 text-profit"
                            : txn.status === "PENDING"
                            ? "bg-warning/10 text-warning"
                            : "bg-loss/10 text-loss"
                        }`}
                      >
                        <span
                          className={`h-1 w-1 rounded-full ${
                            txn.status === "APPROVED"
                              ? "bg-profit"
                              : txn.status === "PENDING"
                              ? "bg-warning"
                              : "bg-loss"
                          }`}
                        />
                        {txn.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentTxns.length === 0 && (
            <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-border/40 py-8 text-sm text-muted-foreground">
              <CircleDollarSign className="mb-2 h-8 w-8 text-gold/20" />
              No transactions yet
            </div>
          )}
        </GlassCard>
      </FadeIn>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Row helper                                                         */
/* ------------------------------------------------------------------ */
function Row({
  label,
  value,
  small,
  highlight,
  icon,
}: {
  label: string;
  value: string;
  small?: boolean;
  highlight?: "profit" | "loss";
  icon?: React.ReactNode;
}) {
  const color =
    highlight === "profit" ? "text-profit" : highlight === "loss" ? "text-loss" : "text-foreground";
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className={`text-right font-medium ${color} ${small ? "text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function getNextNavUpdate(): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const hours = Math.ceil((tomorrow.getTime() - now.getTime()) / 3600000);
  return hours <= 1 ? "< 1 hour" : `~${hours}h`;
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */
function PortfolioSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonCard className="h-20 hover-lift" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <SkeletonMetric key={i} className="h-28" />
        ))}
      </div>
      <SkeletonCard className="h-80 chart-hover-glow" />
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonCard className="h-80 lg:col-span-2 chart-hover-glow" />
        <SkeletonCard className="h-80 hover-lift" />
      </div>
      <SkeletonCard className="h-60 hover-lift" />
      <SkeletonCard className="h-40 hover-lift" />
    </div>
  );
}
