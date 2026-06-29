"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, FadeIn } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fmtDate } from "@/lib/format";
import {
  Megaphone, Plus, Trash2, TrendingUp, PieChart, Shield, BarChart3,
  MessageSquare, AlertTriangle, Pin, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface FundUpdate {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  pinned: boolean;
  createdAt: string;
  author: { name: string } | null;
}

const CATEGORIES = [
  { value: "GENERAL", label: "General", icon: MessageSquare, color: "text-muted-foreground" },
  { value: "PERFORMANCE", label: "Performance", icon: TrendingUp, color: "text-profit" },
  { value: "STRATEGY", label: "Strategy", icon: PieChart, color: "text-gold" },
  { value: "REGULATORY", label: "Regulatory", icon: Shield, color: "text-info" },
  { value: "MARKET", label: "Market", icon: BarChart3, color: "text-warning" },
];

const PRIORITIES = [
  { value: "NORMAL", label: "Normal", color: "text-muted-foreground" },
  { value: "IMPORTANT", label: "Important", color: "text-warning" },
  { value: "URGENT", label: "Urgent", color: "text-loss" },
];

export function AdminFundUpdates() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "GENERAL",
    priority: "NORMAL",
    pinned: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ updates: FundUpdate[] }>({
    queryKey: ["admin-fund-updates"],
    queryFn: () => api.get("/api/fund/updates?limit=50"),
  });

  const updates = data?.updates ?? [];

  const submit = async () => {
    if (!form.title || !form.body) return toast.error("Title and body are required");
    setSubmitting(true);
    try {
      await api.post("/api/admin/fund-updates", form);
      toast.success("Fund update published");
      setOpen(false);
      setForm({ title: "", body: "", category: "GENERAL", priority: "NORMAL", pinned: false });
      qc.invalidateQueries({ queryKey: ["admin-fund-updates"] });
      qc.invalidateQueries({ queryKey: ["fund-updates"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteUpdate = async (id: string) => {
    setDeleting(id);
    try {
      await api.delete(`/api/admin/fund-updates?id=${id}`);
      toast.success("Update deleted");
      qc.invalidateQueries({ queryKey: ["admin-fund-updates"] });
      qc.invalidateQueries({ queryKey: ["fund-updates"] });
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  const getCategoryConfig = (cat: string) => CATEGORIES.find((c) => c.value === cat) ?? CATEGORIES[0];
  const getPriorityConfig = (pri: string) => PRIORITIES.find((p) => p.value === pri) ?? PRIORITIES[0];

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Administration</span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Fund Updates</h1>
            <p className="text-sm text-muted-foreground">Publish news, commentary and updates for investors</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-gold-gradient text-black hover:opacity-90">
            <Plus className="mr-1.5 h-4 w-4" /> New Update
          </Button>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-3">
          <GlassCard className="p-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-gold" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Updates</span>
            </div>
            <div className="mt-1 font-metric text-2xl font-bold text-foreground">{updates.length}</div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2">
              <Pin className="h-4 w-4 text-gold" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Pinned</span>
            </div>
            <div className="mt-1 font-metric text-2xl font-bold text-gold">{updates.filter((u) => u.pinned).length}</div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Important / Urgent</span>
            </div>
            <div className="mt-1 font-metric text-2xl font-bold text-warning">
              {updates.filter((u) => u.priority !== "NORMAL").length}
            </div>
          </GlassCard>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <GlassCard className="p-5">
          <SectionTitle title="All Updates" subtitle={`${updates.length} published`} />
          <div className="mt-4 space-y-3">
            <AnimatePresence>
              {updates.map((u) => {
                const catCfg = getCategoryConfig(u.category);
                const priCfg = getPriorityConfig(u.priority);
                const CatIcon = catCfg.icon;
                return (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="group rounded-lg border border-border/60 bg-black/20 p-4 transition-colors hover:border-gold/20"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/10`}>
                          <CatIcon className={`h-4 w-4 ${catCfg.color}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-semibold text-foreground">{u.title}</h4>
                            {u.pinned && (
                              <Badge className="border-gold/30 bg-gold/10 text-gold text-[10px]">
                                <Pin className="mr-0.5 h-2.5 w-2.5" /> Pinned
                              </Badge>
                            )}
                            <Badge className={`text-[10px] ${priCfg.color} border-current/30 bg-current/10`}>
                              {priCfg.label}
                            </Badge>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{u.body}</p>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground/70">
                            <Badge variant="outline" className="text-[10px]">{u.category}</Badge>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDate(u.createdAt)}</span>
                            {u.author && <span>by {u.author.name}</span>}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteUpdate(u.id)}
                        disabled={deleting === u.id}
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-loss"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {updates.length === 0 && !isLoading && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No updates yet. Click "New Update" to publish your first fund announcement.
              </div>
            )}
            {isLoading && (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-lg glass shimmer" />)}
              </div>
            )}
          </div>
        </GlassCard>
      </FadeIn>

      {/* Create Update Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-gold/20 bg-card/95 backdrop-blur-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-gold" /> Publish Fund Update
            </DialogTitle>
            <DialogDescription>
              This update will be visible to all investors on their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Q2 2026 Performance Update"
                className="border-border/60 bg-black/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Body</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Write your update here..."
                className="border-border/60 bg-black/30 min-h-[120px]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger className="border-border/60 bg-black/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger className="border-border/60 bg-black/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.pinned}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, pinned: checked }))}
              />
              <Label className="text-sm text-muted-foreground">Pin to top of investor dashboard</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="bg-gold-gradient text-black hover:opacity-90">
              {submitting ? "Publishing…" : "Publish Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
