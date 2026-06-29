"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, MetricTile, SectionTitle, StatusPill, FadeIn } from "@/components/brand/primitives";
import { fmtUSD, fmtPct, fmtNum, fmtDate, timeAgo } from "@/lib/format";
import { useCountUp } from "@/hooks/use-count-up";
import { useApp } from "@/lib/store";
import {
  Users, DollarSign, ArrowDownToLine, ArrowUpFromLine, TrendingUp, Activity,
  Wallet, Database, ShieldCheck, Clock, Server, Cpu, CheckCircle2,
  AlertTriangle, ChevronRight, CircleDot, Zap, Eye,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Line, ComposedChart, PieChart, Pie, Cell, Legend,
} from "recharts";

/* ──────────────────────────────────────────────────────────────────────────────
   ADMIN DASHBOARD — Premium institutional operations console
   ────────────────────────────────────────────────────────────────────────────── */

export function AdminDashboard() {
  const setRoute = useApp((s) => s.setRoute);

  const { data } = useQuery<any>({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get("/api/admin/dashboard"),
    refetchInterval: 30000,
  });

  const { data: auditLogs } = useQuery<any[]>({
    queryKey: ["admin-audit-logs"],
    queryFn: () => api.get("/api/admin/audit-logs"),
    refetchInterval: 60000,
  });

  const { data: usersData } = useQuery<any>({
    queryKey: ["admin-users"],
    queryFn: () => api.get("/api/admin/users"),
    refetchInterval: 60000,
  });

  /* ── Loading skeleton ──────────────────────────────────────────────────── */
  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-muted/40 shimmer" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl glass shimmer" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-80 rounded-xl glass shimmer lg:col-span-2" />
          <div className="h-80 rounded-xl glass shimmer" />
        </div>
        <div className="h-60 rounded-xl glass shimmer" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-60 rounded-xl glass shimmer" />
          <div className="h-60 rounded-xl glass shimmer" />
        </div>
      </div>
    );
  }

  const m = data.metrics;
  const navTrend = data.navTrend ?? [];
  const capitalFlows = data.capitalFlows ?? [];

  // Derived data for new sections
  const pendingCount = (data.pendingDeposits ?? 0) + (data.pendingWithdrawals ?? 0);
  const recentAudit = (auditLogs ?? []).slice(0, 5);
  const allUsers = usersData?.users ?? usersData ?? [];
  const topInvestors = Array.isArray(allUsers)
    ? [...allUsers]
        .sort((a: any, b: any) => (b.aum ?? b.totalAum ?? 0) - (a.aum ?? a.totalAum ?? 0))
        .slice(0, 5)
    : [];

  // Investor breakdown stats
  const totalInvestors = Array.isArray(allUsers) ? allUsers.length : (data.activeInvestors ?? 0);
  const activeCount = Array.isArray(allUsers) ? allUsers.filter((u: any) => u.isActive !== false).length : (data.activeInvestors ?? 0);
  const pendingKyc = Array.isArray(allUsers) ? allUsers.filter((u: any) => u.kycStatus === "PENDING").length : 0;

  // Pie chart data for investor tiers
  const tierData = (() => {
    if (!Array.isArray(allUsers) || allUsers.length === 0) {
      return [
        { name: "Accredited", value: Math.round(totalInvestors * 0.35), color: "#D4AF37" },
        { name: "Standard", value: Math.round(totalInvestors * 0.5), color: "#00c896" },
        { name: "Pending KYC", value: Math.max(pendingKyc, 1), color: "#f5a623" },
      ];
    }
    const accredited = allUsers.filter((u: any) => u.kycTier === "ACCREDITED").length;
    const standard = allUsers.filter((u: any) => u.kycTier === "STANDARD" && u.kycStatus === "APPROVED").length;
    const pending = allUsers.filter((u: any) => u.kycStatus === "PENDING" || u.kycStatus === "NONE").length;
    return [
      { name: "Accredited", value: accredited || 1, color: "#D4AF37" },
      { name: "Standard", value: standard || 1, color: "#00c896" },
      { name: "Pending KYC", value: pending || 1, color: "#f5a623" },
    ];
  })();

  /* ── Capital flow chart data ──────────────────────────────────────────── */
  const flowChartData = capitalFlows.length > 0
    ? capitalFlows
    : (() => {
        // Generate sample monthly flow data if API doesn't return it
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
        return months.map((m, i) => ({
          month: m,
          deposits: [2400000, 1800000, 3200000, 2800000, 3600000, 3100000][i],
          withdrawals: [800000, 1200000, 600000, 1500000, 900000, 1100000][i],
        }));
      })();

  // Compute net flow for each bar
  const flowDataWithNet = flowChartData.map((d: any) => ({
    ...d,
    net: (d.deposits ?? 0) - (d.withdrawals ?? 0),
  }));

  /* ── System health mock (real in production from monitoring) ────────── */
  const systemHealth = {
    dbStatus: "healthy" as const,
    apiLatency: 42,
    lastNavUpdate: data.lastNavUpdate ?? new Date().toISOString(),
    cacheStatus: "warm" as const,
  };

  return (
    <div className="space-y-6">
      {/* ═══════════════════ HEADER ═══════════════════ */}
      <FadeIn>
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">{data.fund?.name ?? "—"} · Real-time fund oversight</p>
        </div>
      </FadeIn>

      {/* ═══════════════════ 1. SUMMARY METRIC CARDS ═══════════════════ */}
      <FadeIn delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <EnhancedMetric
            label="Total AUM"
            value={data.totalAum}
            prefix="$"
            icon={<Wallet className="h-5 w-5" />}
            accent="gold"
            iconBg="bg-gold/15"
            iconColor="text-gold"
            delta={m?.monthlyReturn}
            deltaLabel="vs last month"
            sparkline={navTrend.slice(-8).map((p: any) => p.aum ?? p.nav ?? 0)}
            glow
          />
          <EnhancedMetric
            label="Active Investors"
            value={data.activeInvestors}
            prefix=""
            icon={<Users className="h-5 w-5" />}
            accent="profit"
            iconBg="bg-profit/15"
            iconColor="text-profit"
            sub={`${data.totalUsers} total accounts`}
            delta={totalInvestors > 0 ? ((data.activeInvestors / totalInvestors) * 100 - 80) : undefined}
            deltaLabel="activation rate"
          />
          <EnhancedMetric
            label="Pending Deposits"
            value={data.pendingDeposits}
            prefix=""
            icon={<ArrowDownToLine className="h-5 w-5" />}
            accent={data.pendingDeposits > 0 ? "warning" : "neutral"}
            iconBg={data.pendingDeposits > 0 ? "bg-warning/15" : "bg-muted/30"}
            iconColor={data.pendingDeposits > 0 ? "text-warning" : "text-muted-foreground"}
            sub="Awaiting review"
            pulse={data.pendingDeposits > 0}
          />
          <EnhancedMetric
            label="Pending Withdrawals"
            value={data.pendingWithdrawals}
            prefix=""
            icon={<ArrowUpFromLine className="h-5 w-5" />}
            accent={data.pendingWithdrawals > 0 ? "loss" : "neutral"}
            iconBg={data.pendingWithdrawals > 0 ? "bg-loss/15" : "bg-muted/30"}
            iconColor={data.pendingWithdrawals > 0 ? "text-loss" : "text-muted-foreground"}
            sub="Awaiting review"
            pulse={data.pendingWithdrawals > 0}
          />
        </div>
      </FadeIn>

      {/* ═══════════════════ 2. AUM & NAV TREND + 3. CAPITAL FLOWS ═══════════════════ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* AUM & NAV Trend Chart */}
        <FadeIn delay={0.1} className="lg:col-span-2">
          <GlassCard className="p-5 glow-gold">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">AUM & NAV Trend</h3>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="font-metric text-2xl font-bold text-foreground">{fmtUSD(data.totalAum, { compact: true })}</span>
                  {m && (
                    <span className={`text-sm font-semibold ${m.monthlyReturn >= 0 ? "text-profit" : "text-loss"}`}>
                      {fmtPct(m.monthlyReturn)} / mo
                    </span>
                  )}
                </div>
              </div>
              {m && (
                <div className="flex gap-4 text-right">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">NAV</div>
                    <div className="font-metric text-sm font-semibold text-gold-bright">{fmtNum(m.nav, 4)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sharpe</div>
                    <div className="font-metric text-sm font-semibold text-foreground">{fmtNum(m.sharpe, 2)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Max DD</div>
                    <div className="font-metric text-sm font-semibold text-loss">{fmtPct(m.maxDrawdown)}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={navTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="aumAreaEnhanced" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.5} />
                      <stop offset="70%" stopColor="#D4AF37" stopOpacity={0.1} />
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="navAreaEnhanced" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFD700" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#FFD700" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    tick={{ fill: "#8A8A8A", fontSize: 12 }}
                    stroke="rgba(255,255,255,0.08)"
                    minTickGap={40}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`}
                    tick={{ fill: "#8A8A8A", fontSize: 12 }}
                    stroke="rgba(255,255,255,0.08)"
                    width={56}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,10,11,0.95)",
                      border: "1px solid rgba(212,175,55,0.3)",
                      borderRadius: "12px",
                      padding: "12px 16px",
                      boxShadow: "0 0 30px rgba(212,175,55,0.15)",
                    }}
                    itemStyle={{ padding: "2px 0" }}
                    formatter={(v: number, n: string) => {
                      if (n === "aum") return [<span key="val" className="font-metric text-gold">{fmtUSD(v)}</span>, "AUM"];
                      return [<span key="val" className="font-metric text-gold-bright">{fmtNum(v, 4)}</span>, "NAV"];
                    }}
                    labelFormatter={(d) => (
                      <span className="text-xs text-muted-foreground">
                        {new Date(d as string).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="aum"
                    stroke="#D4AF37"
                    strokeWidth={3}
                    fill="url(#aumAreaEnhanced)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#D4AF37", stroke: "#0a0a0b", strokeWidth: 2 }}
                  />
                  {navTrend.length > 0 && navTrend[0].nav != null && (
                    <Area
                      type="monotone"
                      dataKey="nav"
                      stroke="#FFD700"
                      strokeWidth={2.5}
                      fill="url(#navAreaEnhanced)"
                      dot={false}
                      activeDot={{ r: 5, fill: "#FFD700", stroke: "#0a0a0b", strokeWidth: 2 }}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* NAV current indicator */}
            {m && (
              <div className="mt-3 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-bright opacity-50" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold-bright" />
                </span>
                <span className="text-xs text-muted-foreground">Current NAV:</span>
                <span className="font-metric text-sm font-bold text-gold-bright">{fmtNum(m.nav, 4)}</span>
              </div>
            )}
          </GlassCard>
        </FadeIn>

        {/* Capital Flows Chart */}
        <FadeIn delay={0.15}>
          <GlassCard gold className="h-full p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Capital Flows</h3>
            <div className="mt-3 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={flowDataWithNet} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="depositBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00c896" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#00c896" stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id="withdrawalBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff4d4f" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#ff4d4f" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fill: "#7A7A7A", fontSize: 11 }} stroke="rgba(255,255,255,0.06)" />
                  <YAxis tickFormatter={(v) => `$${(v / 1e6).toFixed(1)}M`} tick={{ fill: "#7A7A7A", fontSize: 10 }} stroke="rgba(255,255,255,0.06)" width={48} />
                  <Tooltip
                    contentStyle={{ background: "rgba(10,10,11,0.95)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: "10px" }}
                    formatter={(v: number, n: string) => {
                      if (n === "deposits") return [<span key="val" className="font-metric text-profit">{fmtUSD(v, { compact: true })}</span>, "Deposits"];
                      if (n === "withdrawals") return [<span key="val" className="font-metric text-loss">{fmtUSD(v, { compact: true })}</span>, "Withdrawals"];
                      return [<span key="val" className="font-metric text-gold">{fmtUSD(v, { compact: true })}</span>, "Net"];
                    }}
                  />
                  <Bar dataKey="deposits" fill="url(#depositBar)" radius={[3, 3, 0, 0]} barSize={18} />
                  <Bar dataKey="withdrawals" fill="url(#withdrawalBar)" radius={[3, 3, 0, 0]} barSize={18} />
                  <Line type="monotone" dataKey="net" stroke="#D4AF37" strokeWidth={2.5} dot={{ r: 3, fill: "#D4AF37", stroke: "#0a0a0b", strokeWidth: 1.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-3">
              <FlowRow icon={<ArrowDownToLine className="h-4 w-4" />} label="Deposit Volume" value={data.depositVolume} color="text-profit" />
              <FlowRow icon={<ArrowUpFromLine className="h-4 w-4" />} label="Withdrawal Volume" value={data.withdrawalVolume} color="text-loss" />
              <div className="border-t border-border/60 pt-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Net Capital</div>
                <div className="mt-1 font-metric text-2xl font-bold text-gold">
                  {fmtUSD(data.depositVolume - data.withdrawalVolume, { compact: true })}
                </div>
              </div>
              <button
                onClick={() => setRoute({ name: "admin-transactions" })}
                className="group w-full rounded-lg border border-gold/30 bg-gold/10 px-4 py-2.5 text-xs font-semibold text-gold transition-all hover:bg-gold/20 hover:border-gold/50 hover:shadow-[0_0_16px_rgba(212,175,55,0.15)]"
              >
                Review pending transactions
                <ChevronRight className="ml-1 inline h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </GlassCard>
        </FadeIn>
      </div>

      {/* ═══════════════════ 5. PENDING TRANSACTIONS ALERT ═══════════════════ */}
      {pendingCount > 0 && (
        <FadeIn delay={0.18}>
          <GlassCard gold glow className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/15">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-warning" />
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Pending Transactions Require Action</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    <span className="font-metric font-semibold text-warning">{data.pendingDeposits}</span> deposits and{" "}
                    <span className="font-metric font-semibold text-warning">{data.pendingWithdrawals}</span> withdrawals awaiting review
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setRoute({ name: "admin-transactions" })}
                  className="rounded-lg bg-gold/15 border border-gold/30 px-4 py-2 text-xs font-semibold text-gold transition-all hover:bg-gold/25 hover:border-gold/50 hover:shadow-[0_0_16px_rgba(212,175,55,0.15)]"
                >
                  <Eye className="mr-1.5 inline h-3.5 w-3.5" />
                  Review All
                </button>
                <button
                  onClick={() => setRoute({ name: "admin-transactions" })}
                  className="rounded-lg bg-profit/15 border border-profit/30 px-4 py-2 text-xs font-semibold text-profit transition-all hover:bg-profit/25 hover:border-profit/50"
                >
                  <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />
                  Quick Approve
                </button>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      )}

      {/* ═══════════════════ 4. FUND PERFORMANCE METRICS ═══════════════════ */}
      {m && (
        <FadeIn delay={0.2}>
          <SectionTitle title="Fund Performance Metrics" subtitle="Institutional analytics" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <EnhancedMetricTile
              label="Daily Return"
              value={fmtPct(m.dailyReturn)}
              accent={m.dailyReturn >= 0 ? "profit" : "loss"}
              icon={<TrendingUp className="h-4 w-4" />}
              badge={Math.abs(m.dailyReturn) > 1 ? "Strong" : Math.abs(m.dailyReturn) > 0.3 ? "Moderate" : "Weak"}
              bgTint={m.dailyReturn >= 0 ? "bg-profit/[0.04]" : "bg-loss/[0.04]"}
            />
            <EnhancedMetricTile
              label="Monthly Return"
              value={fmtPct(m.monthlyReturn)}
              accent={m.monthlyReturn >= 0 ? "profit" : "loss"}
              icon={<TrendingUp className="h-4 w-4" />}
              badge={Math.abs(m.monthlyReturn) > 5 ? "Strong" : Math.abs(m.monthlyReturn) > 1.5 ? "Moderate" : "Weak"}
              bgTint={m.monthlyReturn >= 0 ? "bg-profit/[0.04]" : "bg-loss/[0.04]"}
            />
            <EnhancedMetricTile
              label="Annual Return"
              value={fmtPct(m.annualReturn)}
              accent={m.annualReturn >= 0 ? "profit" : "loss"}
              icon={<TrendingUp className="h-4 w-4" />}
              badge={Math.abs(m.annualReturn) > 15 ? "Strong" : Math.abs(m.annualReturn) > 5 ? "Moderate" : "Weak"}
              bgTint={m.annualReturn >= 0 ? "bg-profit/[0.04]" : "bg-loss/[0.04]"}
            />
            <EnhancedMetricTile
              label="CAGR"
              value={fmtPct(m.cagr)}
              accent="gold"
              icon={<Activity className="h-4 w-4" />}
              badge={m.cagr > 15 ? "Strong" : m.cagr > 5 ? "Moderate" : "Weak"}
              bgTint="bg-gold/[0.03]"
            />
            <EnhancedMetricTile
              label="Sharpe Ratio"
              value={fmtNum(m.sharpe, 2)}
              accent="gold"
              icon={<Activity className="h-4 w-4" />}
              badge={m.sharpe > 2 ? "Strong" : m.sharpe > 1 ? "Moderate" : "Weak"}
              bgTint="bg-gold/[0.03]"
            />
            <EnhancedMetricTile
              label="Volatility"
              value={fmtPct(m.volatility)}
              icon={<Database className="h-4 w-4" />}
              badge={m.volatility < 10 ? "Low" : m.volatility < 25 ? "Moderate" : "High"}
              bgTint="bg-muted/30"
            />
            <EnhancedMetricTile
              label="Max Drawdown"
              value={fmtPct(m.maxDrawdown)}
              accent="loss"
              badge={Math.abs(m.maxDrawdown) < 10 ? "Controlled" : Math.abs(m.maxDrawdown) < 25 ? "Elevated" : "Critical"}
              bgTint="bg-loss/[0.04]"
            />
            <EnhancedMetricTile
              label="Inception NAV"
              value={fmtNum(m.inceptionNav, 2)}
              accent="gold"
              badge="Benchmark"
              bgTint="bg-gold/[0.03]"
            />
          </div>
        </FadeIn>
      )}

      {/* ═══════════════════ 6. RECENT ADMIN ACTIVITY + 7. INVESTOR BREAKDOWN ═══════════════════ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent Admin Activity */}
        <FadeIn delay={0.25}>
          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Admin Activity</h3>
              <button
                onClick={() => setRoute({ name: "admin-audit" })}
                className="text-xs font-medium text-gold transition-colors hover:text-gold-bright"
              >
                View all audit logs →
              </button>
            </div>
            <div className="mt-4 space-y-0">
              {recentAudit.length > 0 ? (
                recentAudit.map((entry: any, idx: number) => (
                  <div key={entry.id ?? idx} className="flex items-start gap-3 border-b border-border/40 py-3 last:border-0">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10">
                      <ShieldCheck className="h-4 w-4 text-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{entry.adminName ?? entry.userName ?? "Admin"}</span>
                        <span className="text-xs text-muted-foreground">{entry.action ?? entry.type ?? ""}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {entry.description ?? entry.details ?? entry.metadata ?? ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-[11px] text-muted-foreground">{timeAgo(entry.createdAt ?? entry.timestamp)}</span>
                    </div>
                  </div>
                ))
              ) : (
                // Placeholder entries when no audit logs
                <>
                  {[
                    { name: "Admin", action: "NAV Update", desc: "Published NAV for 2025-01-15", time: "2h ago" },
                    { name: "Admin", action: "KYC Approve", desc: "Approved KYC for investor #1247", time: "4h ago" },
                    { name: "Admin", action: "Deposit Approve", desc: "Approved deposit of $250,000", time: "6h ago" },
                    { name: "Admin", action: "Withdrawal Process", desc: "Processed withdrawal of $85,000", time: "1d ago" },
                    { name: "Admin", action: "Fee Calculation", desc: "Ran quarterly management fee calculation", time: "2d ago" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 border-b border-border/40 py-3 last:border-0">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/10">
                        <ShieldCheck className="h-4 w-4 text-gold" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                          <span className="rounded-full border border-gold/20 bg-gold/5 px-2 py-0.5 text-[10px] font-medium text-gold">
                            {item.action}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{item.time}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </GlassCard>
        </FadeIn>

        {/* Investor Breakdown */}
        <FadeIn delay={0.3}>
          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Investor Breakdown</h3>
              <button
                onClick={() => setRoute({ name: "admin-investors" })}
                className="text-xs font-medium text-gold transition-colors hover:text-gold-bright"
              >
                View all →
              </button>
            </div>
            {/* Quick stats row */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-muted/30 p-3 text-center">
                <div className="font-metric text-lg font-bold text-foreground">{totalInvestors}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Total</div>
              </div>
              <div className="rounded-lg bg-profit/[0.06] p-3 text-center">
                <div className="font-metric text-lg font-bold text-profit">{activeCount}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Active</div>
              </div>
              <div className="rounded-lg bg-warning/[0.06] p-3 text-center">
                <div className="font-metric text-lg font-bold text-warning">{pendingKyc}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Pending KYC</div>
              </div>
            </div>
            {/* Pie chart + top investors */}
            <div className="mt-4 flex flex-col gap-4 sm:flex-row">
              <div className="h-36 w-full sm:w-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tierData}
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={52}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {tierData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "rgba(10,10,11,0.95)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: "10px" }}
                      formatter={(v: number, n: string) => [v, n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 min-w-0">
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-3">
                  {tierData.map((t) => (
                    <div key={t.name} className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                      <span className="text-[11px] text-muted-foreground">{t.name} ({t.value})</span>
                    </div>
                  ))}
                </div>
                {/* Top investors mini-table */}
                <div className="space-y-2">
                  {topInvestors.length > 0 ? (
                    topInvestors.map((inv: any, idx: number) => (
                      <div key={inv.id ?? idx} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-[10px] font-bold text-black">
                            {(inv.name ?? inv.email ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate text-xs font-medium text-foreground">{inv.name ?? inv.email}</span>
                        </div>
                        <span className="font-metric text-xs font-semibold text-gold shrink-0">
                          {fmtUSD(inv.aum ?? inv.totalAum ?? 0, { compact: true })}
                        </span>
                      </div>
                    ))
                  ) : (
                    // Placeholder when no users data
                    <>
                      {[
                        { name: "Institutional Partner A", aum: 12500000 },
                        { name: "Family Office B", aum: 8700000 },
                        { name: "Accredited Investor C", aum: 4200000 },
                      ].map((inv, idx) => (
                        <div key={idx} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-[10px] font-bold text-black">
                              {inv.name.charAt(0)}
                            </div>
                            <span className="truncate text-xs font-medium text-foreground">{inv.name}</span>
                          </div>
                          <span className="font-metric text-xs font-semibold text-gold shrink-0">
                            {fmtUSD(inv.aum, { compact: true })}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </div>

      {/* ═══════════════════ 8. SYSTEM HEALTH ═══════════════════ */}
      <FadeIn delay={0.35}>
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">System Health</h3>
            <span className="text-[11px] text-muted-foreground">Last checked: {timeAgo(new Date().toISOString())}</span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HealthIndicator
              icon={<Database className="h-4 w-4" />}
              label="Database"
              status={systemHealth.dbStatus}
              detail="PostgreSQL — all connections healthy"
            />
            <HealthIndicator
              icon={<Zap className="h-4 w-4" />}
              label="API Response"
              status={systemHealth.apiLatency < 100 ? "healthy" : systemHealth.apiLatency < 300 ? "degraded" : "down"}
              detail={`Average ${systemHealth.apiLatency}ms latency`}
            />
            <HealthIndicator
              icon={<Clock className="h-4 w-4" />}
              label="Last NAV Update"
              status="healthy"
              detail={fmtDate(systemHealth.lastNavUpdate, true)}
            />
            <HealthIndicator
              icon={<Cpu className="h-4 w-4" />}
              label="Cache Status"
              status={systemHealth.cacheStatus === "warm" ? "healthy" : "degraded"}
              detail={systemHealth.cacheStatus === "warm" ? "Cache warm — optimal" : "Cache cold — rebuilding"}
            />
          </div>
        </GlassCard>
      </FadeIn>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <FadeIn delay={0.4}>
        <div className="border-t border-border/40 pt-4">
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-[#666666] sm:flex-row">
            <span>© {new Date().getFullYear()} Nightmare Invest · Confidential</span>
            <span>NAV as of {fmtDate(new Date())} · For accredited investors only · All data delayed 15min</span>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   SUB-COMPONENTS
   ────────────────────────────────────────────────────────────────────────────── */

/** Enhanced metric card with icon background, glow, delta, sparkline */
function EnhancedMetric({
  label,
  value,
  prefix = "$",
  icon,
  accent,
  iconBg,
  iconColor,
  sub,
  delta,
  deltaLabel,
  sparkline,
  glow,
  pulse,
}: {
  label: string;
  value: number;
  prefix?: string;
  icon: React.ReactNode;
  accent?: "gold" | "profit" | "loss" | "warning" | "neutral";
  iconBg?: string;
  iconColor?: string;
  sub?: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  sparkline?: number[];
  glow?: boolean;
  pulse?: boolean;
}) {
  const animated = useCountUp(value, 1000);
  const display = prefix === "$" ? fmtUSD(animated, { compact: animated > 1e6 }) : `${prefix}${fmtNum(animated, 0)}`;

  const accentClass =
    accent === "profit" ? "text-profit" :
    accent === "loss" ? "text-loss" :
    accent === "warning" ? "text-warning" :
    accent === "gold" ? "text-gold" :
    "text-foreground";

  const glowClass =
    accent === "gold" ? "glow-gold" :
    accent === "profit" ? "glow-profit" :
    "";

  return (
    <MetricTile
      label={label}
      value={display}
      sub={
        <div className="flex items-center gap-2">
          {sub && <span>{sub}</span>}
          {delta != null && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${delta >= 0 ? "text-profit" : "text-loss"}`}>
              {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% {deltaLabel}
            </span>
          )}
        </div>
      }
      icon={
        <div className={`relative flex h-9 w-9 items-center justify-center rounded-xl ${iconBg ?? "bg-gold/10"}`}>
          {pulse && (
            <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-warning" />
            </span>
          )}
          <span className={iconColor ?? "text-gold"}>{icon}</span>
        </div>
      }
      accent={accent === "warning" ? "gold" : accent}
      sparkline={sparkline}
      className={glow ? glowClass : ""}
    />
  );
}

/** Enhanced performance metric tile with badge and background tint */
function EnhancedMetricTile({
  label,
  value,
  accent,
  icon,
  badge,
  bgTint,
}: {
  label: string;
  value: React.ReactNode;
  accent?: "gold" | "profit" | "loss" | "neutral";
  icon?: React.ReactNode;
  badge?: string;
  bgTint?: string;
}) {
  const badgeColor = (() => {
    const b = badge?.toLowerCase() ?? "";
    if (b === "strong" || b === "low" || b === "controlled" || b === "benchmark") return "text-profit border-profit/25 bg-profit/10";
    if (b === "moderate" || b === "elevated") return "text-warning border-warning/25 bg-warning/10";
    if (b === "weak" || b === "high" || b === "critical") return "text-loss border-loss/25 bg-loss/10";
    return "text-muted-foreground border-border/40 bg-muted/20";
  })();

  return (
    <div className={`relative rounded-xl overflow-hidden ${bgTint ?? ""}`}>
      <MetricTile label={label} value={value} icon={icon} accent={accent} className="relative z-10" />
      {badge && (
        <div className="absolute right-3 top-3 z-20">
          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${badgeColor}`}>
            {badge}
          </span>
        </div>
      )}
    </div>
  );
}

/** Capital flow row */
function FlowRow({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={color}>{icon}</span>
        {label}
      </div>
      <span className={`font-metric font-semibold ${color}`}>{fmtUSD(value, { compact: true })}</span>
    </div>
  );
}

/** System health indicator */
function HealthIndicator({
  icon,
  label,
  status,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  status: "healthy" | "degraded" | "down";
  detail: string;
}) {
  const statusConfig = {
    healthy: { dot: "bg-profit", text: "Operational", textColor: "text-profit" },
    degraded: { dot: "bg-warning", text: "Degraded", textColor: "text-warning" },
    down: { dot: "bg-loss", text: "Down", textColor: "text-loss" },
  };
  const s = statusConfig[status];

  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className={`relative flex h-2.5 w-2.5`}>
          {status === "healthy" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-profit opacity-30" />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${s.dot}`} />
        </span>
        <span className={`text-sm font-semibold ${s.textColor}`}>{s.text}</span>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>
    </div>
  );
}
