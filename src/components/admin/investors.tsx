"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, FadeIn, SkeletonTable, SkeletonMetric, EmptyState } from "@/components/brand/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { fmtDate, timeAgo } from "@/lib/format";
import { Search, Users, UserCog, ShieldCheck, UserX, UserCheck, Shield, ShieldOff } from "lucide-react";
import { toast } from "sonner";

export function AdminInvestors() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["admin-users", q],
    queryFn: () => api.get(`/api/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });

  const users = data?.users ?? [];

  const save = async () => {
    if (!editing) return;
    try {
      await api.put(`/api/admin/users/${editing.id}`, {
        name: editing.name,
        role: editing.role,
        isActive: editing.isActive,
      });
      toast.success("Investor updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <FadeIn>
          <div className="min-w-0">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
            <h1 className="h2-responsive mt-1 font-bold tracking-tight">Investors</h1>
            <p className="body-responsive text-muted-foreground">Manage investor accounts and access</p>
          </div>
        </FadeIn>
        <FadeIn delay={0.05}>
          <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3">
            {[0, 1, 2].map((i) => <SkeletonMetric key={i} className="h-24" />)}
          </div>
        </FadeIn>
        <FadeIn delay={0.1}>
          <GlassCard className="p-3 sm:p-4 lg:p-5">
            <SectionTitle title="Investor Directory" />
            <div className="mt-4">
              <SkeletonTable rows={5} cols={8} />
            </div>
          </GlassCard>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
            <h1 className="h2-responsive mt-1 font-bold tracking-tight">Investors</h1>
            <p className="body-responsive text-muted-foreground">Manage investor accounts and access</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email…"
              className="tap-target-sm border-border/60 bg-black/30 pl-9"
            />
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <GlassCard className="card-p sm:p-4 hover-lift gold-glow-hover">
            <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /><span className="text-[11px] uppercase tracking-wider">Total</span></div>
            <div className="mt-1 font-metric text-xl sm:text-2xl font-bold text-foreground">{users.length}</div>
          </GlassCard>
          <GlassCard className="card-p sm:p-4 hover-lift gold-glow-hover">
            <div className="flex items-center gap-2 text-muted-foreground"><ShieldCheck className="h-4 w-4 text-gold" /><span className="text-[11px] uppercase tracking-wider">Admins</span></div>
            <div className="mt-1 font-metric text-xl sm:text-2xl font-bold text-gold">{users.filter((u: any) => u.role === "ADMIN").length}</div>
          </GlassCard>
          <GlassCard className="card-p sm:p-4 hover-lift gold-glow-hover">
            <div className="flex items-center gap-2 text-muted-foreground"><UserX className="h-4 w-4 text-loss" /><span className="text-[11px] uppercase tracking-wider">Suspended</span></div>
            <div className="mt-1 font-metric text-xl sm:text-2xl font-bold text-loss">{users.filter((u: any) => !u.isActive).length}</div>
          </GlassCard>
          <GlassCard className="card-p sm:p-4 hover-lift gold-glow-hover">
            <div className="flex items-center gap-2 text-muted-foreground"><Shield className="h-4 w-4 text-profit" /><span className="text-[11px] uppercase tracking-wider">2FA</span></div>
            <div className="mt-1 font-metric text-xl sm:text-2xl font-bold text-profit">{users.filter((u: any) => u.totpEnabled).length}</div>
          </GlassCard>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <GlassCard className="p-3 sm:p-4 lg:p-5">
          <SectionTitle title="Investor Directory" subtitle={`${users.length} accounts`} />
          <div className="mt-4 table-mobile-card overflow-x-auto scroll-x-allowed lg:overflow-visible">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Investor</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 pr-4 font-medium">2FA</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium hide-mobile">Holdings</th>
                  <th className="pb-2 pr-4 font-medium hide-mobile">Txns</th>
                  <th className="pb-2 pr-4 font-medium">Last Login</th>
                  <th className="pb-2 pr-4 font-medium hide-mobile">Joined</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any, idx: number) => (
                  <tr key={u.id} className="investor-row-hover border-b border-border/40 last:border-0 row-enter" style={{ animationDelay: `${idx * 40}ms` }}>
                    <td data-label="Investor" className="py-3 pr-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="investor-avatar-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-xs font-bold text-black">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{u.name}</div>
                          <div className="text-xs text-muted-foreground break-words-mobile">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Role" className="py-3 pr-4">
                      <Badge className={`status-badge-animated ${u.role === "ADMIN" ? "border-gold/30 bg-gold/10 text-gold" : "border-profit/30 bg-profit/10 text-profit"}`}>
                        {u.role}
                      </Badge>
                    </td>
                    <td data-label="2FA" className="py-3 pr-4">
                      {u.totpEnabled ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-profit/30 bg-profit/10 px-2.5 py-0.5 text-[11px] font-semibold text-profit">
                          <Shield className="h-3 w-3" />
                          Enabled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-loss/30 bg-loss/10 px-2.5 py-0.5 text-[11px] font-semibold text-loss">
                          <ShieldOff className="h-3 w-3" />
                          Disabled
                        </span>
                      )}
                    </td>
                    <td data-label="Status" className="py-3 pr-4">
                      {u.isActive ? (
                        <span className="status-badge-animated inline-flex items-center gap-1 text-xs text-profit"><UserCheck className="h-3.5 w-3.5" /> Active</span>
                      ) : (
                        <span className="status-badge-animated inline-flex items-center gap-1 text-xs text-loss"><UserX className="h-3.5 w-3.5" /> Suspended</span>
                      )}
                    </td>
                    <td data-label="Holdings" className="py-3 pr-4 font-metric text-muted-foreground hide-mobile">{u._count.holdings}</td>
                    <td data-label="Txns" className="py-3 pr-4 font-metric text-muted-foreground hide-mobile">{u._count.transactions}</td>
                    <td data-label="Last Login" className="py-3 pr-4 text-muted-foreground">{timeAgo(u.lastLogin)}</td>
                    <td data-label="Joined" className="py-3 pr-4 text-muted-foreground hide-mobile">{fmtDate(u.createdAt)}</td>
                    <td data-label="Actions" className="cell-actions py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(u)} className="tap-target-sm text-gold hover:bg-gold/10 press-scale">
                        <UserCog className="h-4 w-4" />
                        <span className="ml-1.5 show-mobile">Manage</span>
                      </Button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={9}>
                    <EmptyState
                      icon={<Users className="h-7 w-7" />}
                      title="No investors found"
                      description="No investor accounts match your search criteria."
                    />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </FadeIn>

      {/* Edit modal */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="border-gold/20 bg-card/95 backdrop-blur-xl max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto scroll-luxury">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-gold" /> Manage Investor</DialogTitle>
            <DialogDescription>Update role and access for {editing?.email}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Full Name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="tap-target-sm border-border/60 bg-black/30" />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-black/20 px-4 py-3 gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">Administrator Role</div>
                  <div className="text-xs text-muted-foreground">Grant full admin console access</div>
                </div>
                <Switch checked={editing.role === "ADMIN"} onCheckedChange={(c) => setEditing({ ...editing, role: c ? "ADMIN" : "USER" })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-black/20 px-4 py-3 gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground">Account Active</div>
                  <div className="text-xs text-muted-foreground">Suspend to block login access</div>
                </div>
                <Switch checked={editing.isActive} onCheckedChange={(c) => setEditing({ ...editing, isActive: c })} />
              </div>
              {/* 2FA Status (read-only) */}
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-black/20 px-4 py-3 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {editing.totpEnabled ? (
                    <Shield className="h-4 w-4 shrink-0 text-profit" />
                  ) : (
                    <ShieldOff className="h-4 w-4 shrink-0 text-loss" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">Two-Factor Authentication</div>
                    <div className="text-xs text-muted-foreground">
                      {editing.totpEnabled ? "2FA is active for this account" : "2FA is not enabled — account is less secure"}
                    </div>
                  </div>
                </div>
                <span className={`text-xs font-semibold shrink-0 ${editing.totpEnabled ? "text-profit" : "text-loss"}`}>
                  {editing.totpEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button variant="ghost" onClick={() => setEditing(null)} className="btn-full-mobile">Cancel</Button>
            <Button onClick={save} className="bg-gold-gradient text-black hover:opacity-90 press-scale btn-full-mobile">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
