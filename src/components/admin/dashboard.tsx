"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, MetricTile, SectionTitle, StatusPill, TypePill, FadeIn } from "@/components/brand/primitives";
import { fmtUSD, fmtPct, fmtNum, fmtDate, timeAgo } from "@/lib/format";
import { useCountUp } from "@/hooks/use-count-up";
import { useApp } from "@/lib/store";
import { Users, DollarSign, ArrowDownToLine, ArrowUpFromLine, TrendingUp, Activity, Wallet, Database } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export function AdminDashboard() {
  const setRoute = useApp((s) => s.setRoute);
  const { data } = useQuery<any>({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get("/api/admin/dashboard"),
    refetchInterval: 30000,
  });

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-muted/40 shimmer" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0,1,2,3].map((i) => <div key={i} className="h-28 rounded-xl glass shimmer" />)}
        </div>
        <div className="h-80 rounded-xl glass shimmer" />
      </div>
    );
  }

  const m = data.metrics;
  const navTrend = data.navTrend ?? [];

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">{data.fund?.name ?? "—"} · Real-time fund oversight</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminMetric label="Total AUM" value={data.totalAum} icon={<Wallet className="h-4 w-4" />} accent="gold" />
          <AdminMetric label="Active Investors" value={data.activeInvestors} prefix="" icon={<Users className="h-4 w-4" />} sub={`${data.totalUsers} total accounts`} />
          <AdminMetric label="Pending Deposits" value={data.pendingDeposits} prefix="" icon={<ArrowDownToLine className="h-4 w-4" />} accent={data.pendingDeposits > 0 ? "loss" : "neutral"} sub="Awaiting review" />
          <AdminMetric label="Pending Withdrawals" value={data.pendingWithdrawals} prefix="" icon={<ArrowUpFromLine className="h-4 w-4" />} accent={data.pendingWithdrawals > 0 ? "loss" : "neutral"} sub="Awaiting review" />
        </div>
      </FadeIn>

      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.1} className="lg:col-span-2">
          <GlassCard className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">AUM & NAV Trend</h3>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="font-metric text-2xl font-bold text-foreground">{fmtUSD(data.totalAum, { compact: true })}</span>
                  {m && <span className={`text-sm font-semibold ${m.monthlyReturn >= 0 ? "text-profit" : "text-loss"}`}>{fmtPct(m.monthlyReturn)} / mo</span>}
                </div>
              </div>
              {m && (
                <div className="flex gap-4 text-right">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">NAV</div>
                    <div className="font-metric text-sm font-semibold text-gold">{fmtNum(m.nav, 4)}</div>
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
                <AreaChart data={navTrend} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="aumArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })} tick={{ fill: "#7A7A7A", fontSize: 11 }} stroke="rgba(255,255,255,0.08)" minTickGap={40} />
                  <YAxis tickFormatter={(v) => `$${(v / 1e6).toFixed(0)}M`} tick={{ fill: "#7A7A7A", fontSize: 11 }} stroke="rgba(255,255,255,0.08)" width={56} />
                  <Tooltip contentStyle={{ background: "rgba(20,20,22,0.95)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: "10px" }} formatter={(v: number, n) => [fmtUSD(v), n === "aum" ? "AUM" : "NAV"]} labelFormatter={(d) => new Date(d as string).toLocaleDateString()} />
                  <Area type="monotone" dataKey="aum" stroke="#D4AF37" strokeWidth={2} fill="url(#aumArea)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </FadeIn>

        <FadeIn delay={0.15}>
          <GlassCard gold className="h-full p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Capital Flows</h3>
            <div className="mt-4 space-y-4">
              <FlowRow icon={<ArrowDownToLine className="h-4 w-4" />} label="Deposit Volume" value={data.depositVolume} color="text-profit" />
              <FlowRow icon={<ArrowUpFromLine className="h-4 w-4" />} label="Withdrawal Volume" value={data.withdrawalVolume} color="text-info" />
              <div className="border-t border-border/60 pt-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Net Capital</div>
                <div className="mt-1 font-metric text-2xl font-bold text-gold">
                  {fmtUSD(data.depositVolume - data.withdrawalVolume, { compact: true })}
                </div>
              </div>
              <button
                onClick={() => setRoute({ name: "admin-transactions" })}
                className="w-full rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-medium text-gold transition-colors hover:bg-gold/20"
              >
                Review pending transactions →
              </button>
            </div>
          </GlassCard>
        </FadeIn>
      </div>

      {/* Fund metrics */}
      {m && (
        <FadeIn delay={0.2}>
          <SectionTitle title="Fund Performance Metrics" subtitle="Institutional analytics" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Daily Return" value={fmtPct(m.dailyReturn)} accent={m.dailyReturn >= 0 ? "profit" : "loss"} icon={<TrendingUp className="h-4 w-4" />} />
            <MetricTile label="Monthly Return" value={fmtPct(m.monthlyReturn)} accent={m.monthlyReturn >= 0 ? "profit" : "loss"} icon={<TrendingUp className="h-4 w-4" />} />
            <MetricTile label="Annual Return" value={fmtPct(m.annualReturn)} accent={m.annualReturn >= 0 ? "profit" : "loss"} icon={<TrendingUp className="h-4 w-4" />} />
            <MetricTile label="CAGR" value={fmtPct(m.cagr)} accent="gold" icon={<Activity className="h-4 w-4" />} />
            <MetricTile label="Sharpe Ratio" value={fmtNum(m.sharpe, 2)} accent="gold" icon={<Activity className="h-4 w-4" />} />
            <MetricTile label="Volatility" value={fmtPct(m.volatility)} icon={<Database className="h-4 w-4" />} />
            <MetricTile label="Max Drawdown" value={fmtPct(m.maxDrawdown)} accent="loss" />
            <MetricTile label="Inception NAV" value={fmtNum(m.inceptionNav, 2)} accent="gold" />
          </div>
        </FadeIn>
      )}
    </div>
  );
}

function AdminMetric({ label, value, prefix = "$", icon, accent, sub }: { label: string; value: number; prefix?: string; icon: React.ReactNode; accent?: "gold" | "profit" | "loss" | "neutral"; sub?: React.ReactNode }) {
  const animated = useCountUp(value, 1000);
  const display = prefix === "$" ? fmtUSD(animated, { compact: animated > 1e6 }) : `${prefix}${fmtNum(animated, 0)}`;
  return <MetricTile label={label} value={display} icon={icon} accent={accent} sub={sub} />;
}

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
