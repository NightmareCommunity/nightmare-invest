"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, FadeIn, SkeletonCard } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtUSD, fmtNum, fmtDate } from "@/lib/format";
import { Database, Plus, TrendingUp, Calendar } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { toast } from "sonner";

export function AdminNav() {
  const qc = useQueryClient();
  const [nav, setNav] = useState("");
  const [aum, setAum] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const { data: fundData } = useQuery<any>({ queryKey: ["portfolio"], queryFn: () => api.get("/api/portfolio") });
  const { data } = useQuery<any>({ queryKey: ["admin-nav"], queryFn: () => api.get("/api/admin/nav"), refetchInterval: 30000 });

  const points = (data?.points ?? []).slice().reverse(); // most recent first from API desc; show ascending for chart

  const submit = async () => {
    if (!fundData?.fund?.id) return;
    const navVal = parseFloat(nav);
    if (!navVal || navVal <= 0) return toast.error("Enter a valid NAV");
    setSaving(true);
    try {
      await api.post("/api/admin/nav", {
        fundId: fundData.fund.id,
        nav: navVal,
        aum: aum ? parseFloat(aum) : undefined,
        date,
      });
      toast.success("NAV published");
      setNav(""); setAum("");
      qc.invalidateQueries({ queryKey: ["admin-nav"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      qc.invalidateQueries({ queryKey: ["portfolio"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const chartData = [...points].reverse().slice(-90).map((p: any) => ({ date: p.date, nav: p.nav }));

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">NAV Management</h1>
          <p className="text-sm text-muted-foreground">Publish and review fund Net Asset Value</p>
        </div>
      </FadeIn>

      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.05}>
          <GlassCard gold className="p-6">
            <div className="flex items-center gap-2"><Database className="h-5 w-5 text-gold" /><h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Publish NAV</h3></div>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border-border/60 bg-black/30 pl-9" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">NAV per unit (USD)</Label>
                <Input type="number" step="0.0001" value={nav} onChange={(e) => setNav(e.target.value)} placeholder="148.32" className="border-border/60 bg-black/30 font-metric text-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">AUM (USD, optional)</Label>
                <Input type="number" value={aum} onChange={(e) => setAum(e.target.value)} placeholder="284000000" className="border-border/60 bg-black/30 font-metric" />
              </div>
              <Button onClick={submit} disabled={saving} className="w-full bg-gold-gradient text-black hover:opacity-90">
                <Plus className="mr-1.5 h-4 w-4" /> {saving ? "Publishing…" : "Publish NAV"}
              </Button>
              <p className="text-[11px] text-muted-foreground">Publishing for an existing date overwrites the prior value.</p>
            </div>
          </GlassCard>
        </FadeIn>

        <FadeIn delay={0.1} className="lg:col-span-2">
          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">NAV History</h3>
                <div className="mt-1 font-metric text-2xl font-bold text-gold">
                  {points[0] ? fmtNum(points[0].nav, 4) : "—"}
                </div>
                <div className="text-xs text-muted-foreground">{points[0] ? `As of ${fmtDate(points[0].date)}` : "No data"}</div>
              </div>
              <TrendingUp className="h-6 w-6 text-gold" />
            </div>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })} tick={{ fill: "#7A7A7A", fontSize: 11 }} stroke="rgba(255,255,255,0.08)" minTickGap={40} />
                  <YAxis tickFormatter={(v) => `$${fmtNum(v, 0)}`} tick={{ fill: "#7A7A7A", fontSize: 11 }} stroke="rgba(255,255,255,0.08)" width={56} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: "rgba(20,20,22,0.95)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: "10px" }} formatter={(v: number) => [fmtUSD(v, { decimals: 4 }), "NAV"]} labelFormatter={(d) => new Date(d as string).toLocaleDateString()} />
                  <Line type="monotone" dataKey="nav" stroke="#D4AF37" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </FadeIn>
      </div>

      <FadeIn delay={0.15}>
        <GlassCard className="p-5">
          <SectionTitle title="Recent NAV Points" subtitle={`${points.length} records`} />
          <div className="mt-4 max-h-96 overflow-y-auto scroll-luxury">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card/95 backdrop-blur">
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">NAV</th>
                  <th className="pb-2 pr-4 font-medium">AUM</th>
                  <th className="pb-2 font-medium">Fund</th>
                </tr>
              </thead>
              <tbody>
                {points.slice(0, 60).map((p: any) => (
                  <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-gold/5">
                    <td className="py-2.5 pr-4 text-muted-foreground">{fmtDate(p.date)}</td>
                    <td className="py-2.5 pr-4 font-metric font-semibold text-gold">{fmtNum(p.nav, 4)}</td>
                    <td className="py-2.5 pr-4 font-metric text-foreground">{p.aum ? fmtUSD(p.aum, { compact: true }) : "—"}</td>
                    <td className="py-2.5 text-muted-foreground">{p.fund?.name ?? "—"}</td>
                  </tr>
                ))}
                {points.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No NAV points yet</td></tr>}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </FadeIn>
    </div>
  );
}
