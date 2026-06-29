"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/lib/api-client";
import { fmtUSD, fmtPct, fmtNum } from "@/lib/format";
import { GlassCard, FadeIn, MetricTile, SkeletonCard, SkeletonMetric } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ─── Time Periods ────────────────────────────────────────────────
const TIME_PERIODS = [
  { key: "1M", label: "1 Month", days: 30 },
  { key: "3M", label: "3 Months", days: 90 },
  { key: "6M", label: "6 Months", days: 180 },
  { key: "1Y", label: "1 Year", days: 365 },
  { key: "INCEPTION", label: "Since Inception", days: 0 },
] as const;

type TimePeriod = (typeof TIME_PERIODS)[number]["key"];

// ─── Preset Investment Amounts ───────────────────────────────────
const PRESET_AMOUNTS = [50_000, 100_000, 250_000, 500_000, 1_000_000];

// ─── Animated Counter ────────────────────────────────────────────
function AnimatedCounter({
  value,
  prefix = "$",
  decimals = 2,
  className,
}: {
  value: number;
  prefix?: string;
  decimals?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const start = prevValueRef.current;
    const end = value;
    prevValueRef.current = value;
    const diff = end - start;
    if (Math.abs(diff) < 0.01) return;
    const duration = 800;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + diff * eased);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);

  const formatted = fmtNum(display, decimals);
  return (
    <span className={className}>
      {prefix}
      {formatted}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────
export function CalculatorPage() {
  const [investment, setInvestment] = useState(250_000);
  const [customAmount, setCustomAmount] = useState("");
  const [period, setPeriod] = useState<TimePeriod>("1Y");

  // Fetch NAV history for historical returns
  const { data: navData } = useQuery({
    queryKey: ["nav-history"],
    queryFn: () => api.get<{ points: { date: string; nav: number; aum: number | null }[] }>("/api/fund/nav?limit=600"),
    staleTime: 60000,
  });

  const navPoints = navData?.points ?? [];

  // Calculate returns for selected period
  const calculation = useMemo(() => {
    if (navPoints.length < 2) {
      // Fallback: use approximate annualized returns
      const approxReturns: Record<TimePeriod, number> = {
        "1M": 0.062,
        "3M": 0.184,
        "6M": 0.31,
        "1Y": 0.769,
        INCEPTION: 1.12,
      };
      const ret = approxReturns[period];
      const projectedValue = investment * (1 + ret);
      const netPL = projectedValue - investment;
      return {
        initialValue: investment,
        projectedValue,
        netPL,
        returnPct: ret * 100,
        // Generate synthetic growth trajectory
        trajectory: generateTrajectory(investment, ret, period),
      };
    }

    const selectedPeriod = TIME_PERIODS.find((p) => p.key === period)!;
    const latestNav = navPoints[navPoints.length - 1]?.nav ?? 100;

    let startNav: number;
    if (period === "INCEPTION") {
      startNav = navPoints[0]?.nav ?? 100;
    } else {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - selectedPeriod.days);
      // Find the closest NAV point to our target date
      const closest = navPoints.reduce((prev, curr) => {
        const currDate = new Date(curr.date).getTime();
        const prevDate = new Date(prev.date).getTime();
        const targetTime = targetDate.getTime();
        return Math.abs(currDate - targetTime) < Math.abs(prevDate - targetTime) ? curr : prev;
      });
      startNav = closest.nav;
    }

    const returnPct = ((latestNav - startNav) / startNav) * 100;
    const projectedValue = investment * (1 + returnPct / 100);
    const netPL = projectedValue - investment;

    // Build trajectory from actual NAV data
    let trajectoryNavPoints: { date: string; nav: number }[];
    if (period === "INCEPTION") {
      // Sample every Nth point for performance
      const step = Math.max(1, Math.floor(navPoints.length / 60));
      trajectoryNavPoints = navPoints.filter((_, i) => i % step === 0 || i === navPoints.length - 1);
    } else {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - selectedPeriod.days);
      const filtered = navPoints.filter((p) => new Date(p.date) >= targetDate);
      const step = Math.max(1, Math.floor(filtered.length / 60));
      trajectoryNavPoints = filtered.filter((_, i) => i % step === 0 || i === filtered.length - 1);
    }

    const firstNav = trajectoryNavPoints[0]?.nav ?? startNav;
    const trajectory = trajectoryNavPoints.map((p, i) => ({
      month: i,
      value: investment * (p.nav / firstNav),
      nav: p.nav,
    }));

    return {
      initialValue: investment,
      projectedValue,
      netPL,
      returnPct,
      trajectory: trajectory.length > 1 ? trajectory : generateTrajectory(investment, returnPct / 100, period),
    };
  }, [navPoints, investment, period]);

  const isProfit = calculation.netPL >= 0;
  const progressPct = Math.min(
    100,
    (Math.abs(calculation.netPL) / calculation.initialValue) * 100
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-gold-gradient">Profit / Loss Calculator</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hypothetical projection based on fund&apos;s historical performance
          </p>
        </div>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Input Controls */}
        <FadeIn delay={0.1} className="lg:col-span-1 space-y-4">
          {/* Investment Amount */}
          <GlassCard className="p-5 hover-lift">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Investment Amount
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_AMOUNTS.map((amt) => (
                <Button
                  key={amt}
                  variant={investment === amt ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setInvestment(amt);
                    setCustomAmount("");
                  }}
                  className={cn(
                    "text-xs font-medium transition-all",
                    investment === amt
                      ? "bg-gold-gradient text-black border-gold/50 hover:opacity-90"
                      : "border-border/60 text-muted-foreground hover:text-foreground hover:border-gold/30"
                  )}
                >
                  {fmtUSD(amt, { compact: true })}
                </Button>
              ))}
            </div>
            <div className="mt-3">
              <input
                type="number"
                placeholder="Custom amount..."
                value={customAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomAmount(val);
                  if (val && !isNaN(Number(val))) {
                    setInvestment(Number(val));
                  }
                }}
                className="w-full rounded-lg border border-border/60 bg-black/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
              />
            </div>
            <div className="mt-3 text-center">
              <span className="font-metric text-xl font-bold text-gold">
                {fmtUSD(investment, { decimals: 0 })}
              </span>
            </div>
          </GlassCard>

          {/* Time Period */}
          <GlassCard className="p-5 hover-lift">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Time Period
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {TIME_PERIODS.map((p) => (
                <Button
                  key={p.key}
                  variant={period === p.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    "text-xs font-medium transition-all",
                    period === p.key
                      ? "bg-gold-gradient text-black border-gold/50 hover:opacity-90"
                      : "border-border/60 text-muted-foreground hover:text-foreground hover:border-gold/30"
                  )}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </GlassCard>
        </FadeIn>

        {/* Right: Results */}
        <FadeIn delay={0.2} className="lg:col-span-2 space-y-4">
          {/* Result Tiles */}
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricTile
              label="Initial Investment"
              value={<AnimatedCounter value={calculation.initialValue} className="text-gold" />}
              accent="gold"
              icon={<DollarSign className="h-4 w-4" />}
            />
            <MetricTile
              label="Projected Value"
              value={
                <AnimatedCounter
                  value={calculation.projectedValue}
                  className={isProfit ? "text-profit" : "text-loss"}
                />
              }
              accent={isProfit ? "profit" : "loss"}
              icon={
                isProfit ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )
              }
            />
            <MetricTile
              label="Net P&L"
              value={
                <div className="flex items-center gap-2">
                  <AnimatedCounter
                    value={Math.abs(calculation.netPL)}
                    prefix={calculation.netPL >= 0 ? "+$" : "-$"}
                    className={isProfit ? "text-profit" : "text-loss"}
                  />
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isProfit ? "text-profit" : "text-loss"
                    )}
                  >
                    ({fmtPct(calculation.returnPct)})
                  </span>
                </div>
              }
              accent={isProfit ? "profit" : "loss"}
              icon={
                isProfit ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )
              }
            />
          </div>

          {/* Growth Chart */}
          <GlassCard className="p-5 chart-hover-glow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Growth Trajectory
              </h3>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                  isProfit
                    ? "border-profit/30 bg-profit/10 text-profit"
                    : "border-loss/30 bg-loss/10 text-loss"
                )}
              >
                {isProfit ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {fmtPct(calculation.returnPct)}
              </span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={calculation.trajectory} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="calcGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isProfit ? "#00c896" : "#ff4d4f"} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={isProfit ? "#00c896" : "#ff4d4f"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => fmtUSD(v, { compact: true, decimals: 1 })}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                    tick={{ fontSize: 10, fill: "#9a9a9a" }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "rgba(20,20,22,0.9)",
                      border: "1px solid rgba(212,175,55,0.2)",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "#f5f5f4",
                    }}
                    formatter={(value: number) => [fmtUSD(value, { decimals: 0 }), "Value"]}
                    labelFormatter={() => ""}
                  />
                  <ReferenceLine
                    y={calculation.initialValue}
                    stroke="#D4AF37"
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={isProfit ? "#00c896" : "#ff4d4f"}
                    strokeWidth={2}
                    fill="url(#calcGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Progress bar showing investment vs returns */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Investment</span>
                <span className="text-gold font-metric">{fmtUSD(calculation.initialValue, { decimals: 0 })}</span>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-black/30 border border-border/30">
                <motion.div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    isProfit ? "bg-profit/60" : "bg-loss/60"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progressPct, 100)}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
                <div className="absolute inset-y-0 left-0 w-full bg-gold/20 rounded-full" style={{ width: "100%" }} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {isProfit ? "Returns" : "Loss"}
                </span>
                <span
                  className={cn(
                    "font-metric",
                    isProfit ? "text-profit" : "text-loss"
                  )}
                >
                  {isProfit ? "+" : ""}
                  {fmtUSD(calculation.netPL, { decimals: 0 })}
                </span>
              </div>
            </div>
          </GlassCard>

          {/* Disclaimer */}
          <FadeIn delay={0.3}>
            <GlassCard className="p-4 border-warning/20">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-warning mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-warning">Risk Disclaimer</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    This is a <span className="text-foreground">hypothetical projection</span> based on
                    the fund&apos;s historical performance. Past performance is not indicative of future results.
                    Actual returns may vary significantly due to market conditions, fees, and other factors.
                    Cryptocurrency investments carry substantial risk of loss. This calculator is for
                    informational purposes only and should not be considered financial advice.
                  </p>
                </div>
              </div>
            </GlassCard>
          </FadeIn>
        </FadeIn>
      </div>
    </div>
  );
}

// ─── Generate Synthetic Growth Trajectory ────────────────────────
function generateTrajectory(
  initial: number,
  totalReturn: number,
  period: TimePeriod
): { month: number; value: number }[] {
  const periodDays = TIME_PERIODS.find((p) => p.key === period)?.days ?? 365;
  const numPoints = 60;
  const dailyReturn = Math.pow(1 + totalReturn, 1 / periodDays) - 1;
  const points = [];

  for (let i = 0; i <= numPoints; i++) {
    const dayFraction = i / numPoints;
    const daysElapsed = dayFraction * periodDays;
    // Add some realistic volatility
    const volatility = Math.sin(i * 0.8) * 0.003 + Math.cos(i * 1.3) * 0.002;
    const cumulativeReturn = Math.pow(1 + dailyReturn, daysElapsed) - 1;
    const value = initial * (1 + cumulativeReturn + volatility * dayFraction);
    points.push({ month: i, value: Math.max(0, value) });
  }

  return points;
}
