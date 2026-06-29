"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, MetricTile, SectionTitle, FadeIn } from "@/components/brand/primitives";
import { fmtUSD, fmtNum, fmtPct, fmtDate } from "@/lib/format";
import { Wallet, Layers, TrendingUp, TrendingDown, Activity, Download } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";

export function PortfolioPage() {
  const { data } = useQuery<any>({
    queryKey: ["portfolio"],
    queryFn: () => api.get("/api/portfolio"),
  });

  if (!data) return <div className="h-80 rounded-xl glass shimmer" />;

  const { summary: s, metrics: m, allocations, fund, holding } = data;
  const exposureData = allocations.map((a: any) => ({
    name: a.asset.split(" ")[0],
    value: (a.weight / 100) * s.currentValue,
    color: a.color,
    weight: a.weight,
  }));

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Investor Portal</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Portfolio</h1>
          <p className="text-sm text-muted-foreground">{fund.name}</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="Current Value" value={fmtUSD(s.currentValue)} accent="gold" icon={<Wallet className="h-4 w-4" />} />
          <MetricTile label="Invested Capital" value={fmtUSD(s.investedCapital)} icon={<Activity className="h-4 w-4" />} />
          <MetricTile label="Unrealized P&L" value={fmtUSD(s.unrealizedPnl)} accent={s.unrealizedPnl >= 0 ? "profit" : "loss"} icon={s.unrealizedPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} sub={`${fmtPct(s.roi)} ROI`} />
          <MetricTile label="Units Held" value={fmtNum(s.units, 4)} accent="gold" icon={<Layers className="h-4 w-4" />} sub={`Avg ${fmtUSD(s.avgPrice, { decimals: 4 })}`} />
        </div>
      </FadeIn>

      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.1} className="lg:col-span-2">
          <GlassCard className="p-5">
            <SectionTitle title="Asset Exposure" subtitle="USD value across fund allocations" />
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exposureData} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fill: "#7A7A7A", fontSize: 11 }} stroke="rgba(255,255,255,0.08)" />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: "#7A7A7A", fontSize: 11 }} stroke="rgba(255,255,255,0.08)" width={56} />
                  <Tooltip
                    cursor={{ fill: "rgba(212,175,55,0.06)" }}
                    contentStyle={{ background: "rgba(20,20,22,0.95)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: "10px" }}
                    formatter={(v: number) => [fmtUSD(v), "Exposure"]}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {exposureData.map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </FadeIn>

        <FadeIn delay={0.15}>
          <GlassCard gold className="h-full p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Position Detail</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Fund" value={fund.name} />
              <Row label="Minimum Investment" value={fmtUSD(fund.minInvest)} />
              <Row label="Fee Structure" value={fund.feeStructure} small />
              <Row label="Units" value={fmtNum(s.units, 4)} />
              <Row label="Average Cost / Unit" value={fmtUSD(s.avgPrice, { decimals: 4 })} />
              <Row label="Current NAV" value={fmtUSD(s.currentNav, { decimals: 4 })} />
              <Row label="Position Opened" value={holding ? fmtDate(holding.updatedAt) : "—"} />
              <div className="border-t border-border/60 pt-3">
                <Row label="Total Return" value={fmtPct(s.roi)} highlight={s.roi >= 0 ? "profit" : "loss"} />
              </div>
            </dl>
          </GlassCard>
        </FadeIn>
      </div>

      <FadeIn delay={0.2}>
        <GlassCard className="p-5">
          <SectionTitle title="Allocation Breakdown" subtitle="Target weights set by the investment committee" />
          <div className="mt-4 space-y-3">
            {allocations.map((a: any) => (
              <div key={a.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-foreground/90">
                    <span className="h-3 w-3 rounded-sm" style={{ background: a.color }} />
                    {a.asset}
                  </span>
                  <span className="font-metric font-semibold text-foreground">{a.weight}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-black/40">
                  <div className="h-full rounded-full" style={{ width: `${a.weight}%`, background: a.color }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </FadeIn>
    </div>
  );
}

function Row({ label, value, small, highlight }: { label: string; value: string; small?: boolean; highlight?: "profit" | "loss" }) {
  const color = highlight === "profit" ? "text-profit" : highlight === "loss" ? "text-loss" : "text-foreground";
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-medium ${color} ${small ? "text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
