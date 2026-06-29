"use client";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, FadeIn, SkeletonCard } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PieChart as RPie, Pie, Cell, ResponsiveContainer } from "recharts";
import { Save, Plus, Trash2, Layers, TrendingUp, DollarSign, FileText } from "lucide-react";
import { fmtUSD } from "@/lib/format";
import { toast } from "sonner";

const DEFAULT_COLORS = ["#F7931A", "#627EEA", "#14F195", "#4A90E2", "#D4AF37", "#00C896", "#FF4D4F", "#F5A623"];

export function AdminFund() {
  const qc = useQueryClient();
  const { data } = useQuery<any>({ queryKey: ["portfolio"], queryFn: () => api.get("/api/portfolio") });
  const [allocations, setAllocations] = useState<{ asset: string; weight: number; color: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.allocations) {
      setAllocations(data.allocations.map((a: any) => ({ asset: a.asset, weight: a.weight, color: a.color })));
    }
  }, [data]);

  const total = allocations.reduce((a, b) => a + b.weight, 0);

  const update = (i: number, field: "asset" | "weight" | "color", value: string | number) => {
    setAllocations((prev) => prev.map((a, idx) => (idx === i ? { ...a, [field]: value } : a)));
  };
  const add = () => setAllocations((prev) => [...prev, { asset: "", weight: 0, color: DEFAULT_COLORS[prev.length % DEFAULT_COLORS.length] }]);
  const remove = (i: number) => setAllocations((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!data?.fund?.id) return;
    if (Math.abs(total - 100) > 0.5) return toast.error(`Total must be 100% (currently ${total.toFixed(1)}%)`);
    if (allocations.some((a) => !a.asset.trim())) return toast.error("All assets must have a name");
    setSaving(true);
    try {
      await api.put("/api/admin/allocations", { fundId: data.fund.id, allocations });
      toast.success("Fund allocations updated");
      qc.invalidateQueries({ queryKey: ["portfolio"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (!data) return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Fund Management</h1>
          <p className="text-sm text-muted-foreground">Configure fund metadata and target allocation</p>
        </div>
      </FadeIn>
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonCard className="lg:col-span-2 h-80 hover-lift" />
        <SkeletonCard className="h-80 hover-lift" />
      </div>
      <SkeletonCard className="h-60 hover-lift" />
    </div>
  );

  return (
    <div className="space-y-6">
      <FadeIn>
        <div>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Fund Management</h1>
          <p className="text-sm text-muted-foreground">Configure fund metadata and target allocation</p>
        </div>
      </FadeIn>

      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.05} className="lg:col-span-2">
          <GlassCard className="p-6">
            <SectionTitle title="Fund Configuration" subtitle="Display metadata for investors" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Fund Name" icon={<Layers className="h-4 w-4" />} value={data.fund.name} readOnly />
              <Field label="Slug" icon={<TrendingUp className="h-4 w-4" />} value={data.fund.slug} readOnly />
              <Field label="Minimum Investment" icon={<DollarSign className="h-4 w-4" />} value={fmtUSD(data.fund.minInvest)} readOnly />
              <Field label="Fee Structure" icon={<FileText className="h-4 w-4" />} value={data.fund.feeStructure} readOnly multirow />
            </div>
            <div className="mt-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
              <Textarea
                value={data.fund.description ?? ""}
                readOnly
                placeholder="No description set. Update fund metadata in the database to add marketing copy here."
                className="mt-1.5 border-border/60 bg-black/20 text-sm"
                rows={4}
              />
            </div>
          </GlassCard>
        </FadeIn>

        <FadeIn delay={0.1}>
          <GlassCard gold className="h-full p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Current Allocation</h3>
            <div className="mt-4 flex justify-center">
              <div className="relative h-40 w-40">
                <ResponsiveContainer width="100%" height="100%">
                  <RPie>
                    <Pie data={allocations} dataKey="weight" nameKey="asset" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                      {allocations.map((a, i) => <Cell key={i} fill={a.color} />)}
                    </Pie>
                  </RPie>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
                  <span className={`font-metric text-lg font-bold ${Math.abs(total - 100) > 0.5 ? "text-loss" : "text-gold"}`}>{total.toFixed(0)}%</span>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center text-xs text-muted-foreground">
              {Math.abs(total - 100) > 0.5 ? (
                <span className="text-loss">⚠ Allocations must total 100%</span>
              ) : (
                <span className="text-profit">✓ Balanced</span>
              )}
            </div>
          </GlassCard>
        </FadeIn>
      </div>

      <FadeIn delay={0.15}>
        <GlassCard className="p-6">
          <SectionTitle
            title="Allocation Editor"
            subtitle="Set target weights for each asset class"
            action={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={add} className="border-gold/30 hover:bg-gold/10">
                  <Plus className="mr-1 h-4 w-4" /> Add Asset
                </Button>
                <Button size="sm" onClick={save} disabled={saving} className="save-btn-gold-sweep bg-gold-gradient text-black hover:opacity-90">
                  <Save className="mr-1 h-4 w-4" /> {saving ? "Saving…" : "Save Allocation"}
                </Button>
              </div>
            }
          />
          <div className="mt-4 space-y-2">
            {allocations.map((a, i) => (
              <div key={i} className="allocation-card-glow flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-black/20 p-3">
                <input
                  type="color"
                  value={a.color}
                  onChange={(e) => update(i, "color", e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded border border-border/60 bg-transparent"
                  aria-label="Asset color"
                />
                <Input
                  value={a.asset}
                  onChange={(e) => update(i, "asset", e.target.value)}
                  placeholder="Asset name (e.g. Bitcoin)"
                  className="flex-1 border-border/60 bg-black/30"
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={a.weight}
                    onChange={(e) => update(i, "weight", parseFloat(e.target.value) || 0)}
                    className="w-24 border-border/60 bg-black/30 text-right font-metric"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <div className="hidden flex-1 sm:block">
                  <div className="h-2 overflow-hidden rounded-full bg-black/40">
                    <div className="allocation-weight-transition h-full rounded-full" style={{ width: `${a.weight}%`, background: a.color }} />
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(i)} className="text-loss hover:bg-loss/10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {allocations.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">No allocations. Click "Add Asset" to begin.</div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border/60 bg-black/20 px-4 py-3">
            <span className="text-sm text-muted-foreground">Total Allocation</span>
            <span className={`font-metric text-lg font-bold ${Math.abs(total - 100) > 0.5 ? "text-loss" : "text-profit"}`}>{total.toFixed(1)}%</span>
          </div>
        </GlassCard>
      </FadeIn>
    </div>
  );
}

function Field({ label, value, icon, readOnly, multirow }: { label: string; value: string; icon: React.ReactNode; readOnly?: boolean; multirow?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">{icon}{label}</Label>
      {multirow ? (
        <div className="min-h-[40px] rounded-md border border-border/60 bg-black/20 px-3 py-2.5 text-sm font-medium text-foreground [overflow-wrap:anywhere]">
          {value}
        </div>
      ) : (
        <Input value={value} readOnly={readOnly} className="border-border/60 bg-black/20" />
      )}
    </div>
  );
}
