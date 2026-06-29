"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { GlassCard, SectionTitle, FadeIn } from "@/components/brand/primitives";
import { Input } from "@/components/ui/input";
import { fmtDateTime } from "@/lib/format";
import { History, Search, Shield, User, TrendingUp, Database, ArrowLeftRight, LogIn, KeyRound, Settings, Link2, ShieldCheck, ShieldAlert } from "lucide-react";

const ACTION_ICONS: Record<string, typeof History> = {
  USER_SIGNUP: User,
  USER_LOGIN: LogIn,
  USER_LOGOUT: LogIn,
  PASSWORD_RESET: KeyRound,
  PASSWORD_RESET_REQUESTED: KeyRound,
  USER_UPDATED: Settings,
  TRANSACTION_REQUESTED: ArrowLeftRight,
  TRANSACTION_APPROVED: ArrowLeftRight,
  TRANSACTION_REJECTED: ArrowLeftRight,
  NAV_UPDATED: Database,
  ALLOCATIONS_UPDATED: TrendingUp,
  SYSTEM_SEED: Shield,
  KYC_DOCUMENT_UPLOADED: Shield,
  KYC_DOCUMENT_APPROVED: Shield,
  KYC_DOCUMENT_REJECTED: Shield,
  "2FA_ENABLED": KeyRound,
  "2FA_DISABLED": KeyRound,
  RECOVERY_CODES_GENERATED: KeyRound,
};

export function AdminAudit() {
  const [action, setAction] = useState("");
  const { data } = useQuery<any>({
    queryKey: ["admin-audit", action],
    queryFn: () => api.get(`/api/admin/audit-logs${action ? `?action=${encodeURIComponent(action)}` : ""}`),
  });

  const logs = data?.logs ?? [];
  const chain = data?.chainVerification;
  const chainIntact = chain?.intact === true;

  return (
    <div className="space-y-6">
      <FadeIn>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-gold">Admin Console</span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Audit Logs</h1>
            <p className="text-sm text-muted-foreground">Complete activity trail for compliance</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Filter by action…" className="border-border/60 bg-black/30 pl-9" />
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-4">
          <GlassCard className="p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Events</div>
            <div className="mt-1 font-metric text-2xl font-bold text-foreground">{logs.length}</div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Auth Events</div>
            <div className="mt-1 font-metric text-2xl font-bold text-gold">{logs.filter((l: any) => l.action.includes("LOGIN") || l.action.includes("SIGNUP")).length}</div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Transaction Events</div>
            <div className="mt-1 font-metric text-2xl font-bold text-profit">{logs.filter((l: any) => l.action.includes("TRANSACTION")).length}</div>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Fund Events</div>
            <div className="mt-1 font-metric text-2xl font-bold text-info">{logs.filter((l: any) => l.action.includes("NAV") || l.action.includes("ALLOCATION")).length}</div>
          </GlassCard>
        </div>
      </FadeIn>

      <FadeIn delay={0.075}>
        <GlassCard gold className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-full border ${chainIntact ? "border-profit/40 bg-profit/10" : "border-loss/40 bg-loss/10"}`}>
                {chainIntact ? <ShieldCheck className="h-5 w-5 text-profit" /> : <ShieldAlert className="h-5 w-5 text-loss" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Hash Chain Integrity</h3>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chainIntact ? "border-profit/30 bg-profit/10 text-profit" : "border-loss/30 bg-loss/10 text-loss"}`}>
                    <Link2 className="h-3 w-3" />
                    {chainIntact ? "VERIFIED" : "BROKEN"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-foreground/60">
                  SHA-256 chained audit trail — tamper-evident compliance log
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Verified Entries</div>
              <div className="font-metric text-xl font-bold text-gold">{chain?.verified ?? 0}</div>
              {!chainIntact && chain?.brokenAt && (
                <div className="mt-0.5 text-[11px] text-loss">
                  Broken at #{chain.brokenAt.chainIndex} ({chain.brokenAt.action})
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </FadeIn>

      <FadeIn delay={0.1}>
        <GlassCard className="p-5">
          <SectionTitle title="Event Log" subtitle="Chronological audit trail — SHA-256 hash chained" />
          <div className="mt-4 max-h-[32rem] overflow-y-auto scroll-luxury">
            <div className="space-y-2">
              {logs.map((l: any) => {
                const Icon = ACTION_ICONS[l.action] ?? History;
                const meta = l.metadata ? (() => { try { return JSON.parse(l.metadata); } catch { return null; } })() : null;
                return (
                  <div key={l.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-black/20 p-3 hover:border-gold/30">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gold/10 text-gold">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-metric text-sm font-semibold text-foreground">{l.action}</span>
                        <span className="text-xs text-muted-foreground">by</span>
                        <span className="text-sm text-gold">{l.actor?.name ?? "System"}</span>
                        {l.actor?.email && <span className="text-xs text-muted-foreground">({l.actor.email})</span>}
                        {l.chainIndex && (
                          <span className="rounded border border-border/60 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-foreground/60">
                            #{l.chainIndex}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{fmtDateTime(l.timestamp)}</div>
                      {(l.resourceType || l.resourceId) && (
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {l.resourceType && <span className="mr-2">Resource: {l.resourceType}</span>}
                          {l.resourceId && <span className="font-mono">{l.resourceId.slice(0, 12)}…</span>}
                        </div>
                      )}
                      {l.hash && (
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <Link2 className="h-3 w-3 text-gold/60" />
                          <span className="font-mono">hash: {l.hash.slice(0, 24)}…</span>
                        </div>
                      )}
                      {meta && (
                        <div className="mt-1.5 rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
                          {JSON.stringify(meta).slice(0, 200)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {logs.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                  <History className="h-8 w-8 text-gold/40" />
                  <span>No audit logs found</span>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </FadeIn>
    </div>
  );
}
