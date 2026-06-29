"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  GlassCard, MetricTile, SectionTitle, FadeIn, SkeletonCard, SkeletonMetric,
} from "@/components/brand/primitives";
import { fmtDate, timeAgo } from "@/lib/format";
import {
  Activity, Database, Server, Wifi, HardDrive, ShieldCheck, Clock,
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, Cpu, Zap, Eye,
  Radio, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

/* ──────────────────────────────────────────────────────────────────────────────
   ADMIN SYSTEM HEALTH — Premium infrastructure monitoring & diagnostics
   ────────────────────────────────────────────────────────────────────────────── */

interface HealthData {
  overallHealth: "healthy" | "degraded" | "critical";
  dbStatus: string;
  dbLatency: number;
  apiLatency: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  uptime: number;
  lastNavUpdate: string | null;
  activeConnections: number;
  cacheStatus: "warm" | "cold";
  priceFeedStatus: "live" | "stale";
  cachedAssets: number;
  version: string;
  environment: string;
  accessExpiry: string;
  twoFaRate: number;
  activity: {
    id: string;
    type: "nav-update" | "price-feed" | "admin-action";
    description: string;
    timestamp: string;
  }[];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function HealthIndicator({ status }: { status: "healthy" | "degraded" | "critical" | "live" | "stale" | "warm" | "cold" }) {
  const colorMap: Record<string, { dot: string; pulse: string; glow: string }> = {
    healthy: { dot: "bg-emerald-400", pulse: "animate-pulse", glow: "shadow-[0_0_8px_rgba(52,211,153,0.6)]" },
    live: { dot: "bg-emerald-400", pulse: "animate-pulse", glow: "shadow-[0_0_8px_rgba(52,211,153,0.6)]" },
    warm: { dot: "bg-emerald-400", pulse: "animate-pulse", glow: "shadow-[0_0_8px_rgba(52,211,153,0.6)]" },
    degraded: { dot: "bg-amber-400", pulse: "animate-pulse", glow: "shadow-[0_0_8px_rgba(251,191,36,0.6)]" },
    stale: { dot: "bg-amber-400", pulse: "animate-pulse", glow: "shadow-[0_0_8px_rgba(251,191,36,0.6)]" },
    cold: { dot: "bg-amber-400", pulse: "animate-pulse", glow: "shadow-[0_0_8px_rgba(251,191,36,0.6)]" },
    critical: { dot: "bg-red-500", pulse: "animate-pulse", glow: "shadow-[0_0_8px_rgba(239,68,68,0.6)]" },
  };
  const c = colorMap[status] ?? colorMap.healthy;
  return (
    <span className={cn("inline-block h-2.5 w-2.5 rounded-full", c.dot, c.pulse, c.glow)} />
  );
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "nav-update": return <Database className="h-3.5 w-3.5 text-gold" />;
    case "price-feed": return <Wifi className="h-3.5 w-3.5 text-emerald-400" />;
    case "admin-action": return <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />;
    default: return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

export function SystemHealth() {
  const [lastChecked, setLastChecked] = useState(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);

  const { data, isLoading, refetch } = useQuery<HealthData>({
    queryKey: ["admin-system-health"],
    queryFn: () => api.get("/api/admin/system-health"),
    refetchInterval: 30000,
    retry: 1,
  });

  // Track seconds since last check
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastChecked) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastChecked]);

  const handleRefresh = async () => {
    await refetch();
    setLastChecked(Date.now());
    setSecondsAgo(0);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SectionTitle title="System Health" subtitle="Infrastructure monitoring & diagnostics" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonMetric key={i} />
          ))}
        </div>
        <SkeletonCard className="h-64" />
      </div>
    );
  }

  if (!data) return null;

  const overallIcon = data.overallHealth === "healthy"
    ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
    : data.overallHealth === "degraded"
    ? <AlertTriangle className="h-5 w-5 text-amber-400" />
    : <XCircle className="h-5 w-5 text-red-500" />;

  const overallLabel = data.overallHealth === "healthy"
    ? "All Systems Operational"
    : data.overallHealth === "degraded"
    ? "Degraded Performance"
    : "Critical Issues Detected";

  const overallColor = data.overallHealth === "healthy"
    ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/5"
    : data.overallHealth === "degraded"
    ? "text-amber-400 border-amber-400/30 bg-amber-400/5"
    : "text-red-500 border-red-500/30 bg-red-500/5";

  const heapPct = data.memoryUsage.heapTotal > 0
    ? Math.round((data.memoryUsage.heapUsed / data.memoryUsage.heapTotal) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              System <span className="bg-gradient-to-r from-gold to-amber-300 bg-clip-text text-transparent">Health</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Infrastructure monitoring &amp; diagnostics</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium", overallColor)}>
              {overallIcon}
              <span>{overallLabel}</span>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Health Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Database */}
        <FadeIn delay={0.05}>
          <GlassCard className="p-5 hover-lift">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/10">
                  <Database className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="text-sm font-semibold text-foreground">Database</span>
              </div>
              <HealthIndicator status={data.dbStatus === "healthy" ? "healthy" : "critical"} />
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                <span className={cn("font-medium", data.dbStatus === "healthy" ? "text-emerald-400" : "text-red-500")}>
                  {data.dbStatus === "healthy" ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Latency</span>
                <span className={cn("font-mono font-medium", data.dbLatency < 100 ? "text-emerald-400" : data.dbLatency < 500 ? "text-amber-400" : "text-red-500")}>
                  {data.dbLatency}ms
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Engine</span>
                <span className="font-medium text-foreground">SQLite</span>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* API Server */}
        <FadeIn delay={0.1}>
          <GlassCard className="p-5 hover-lift">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
                  <Server className="h-4 w-4 text-gold" />
                </div>
                <span className="text-sm font-semibold text-foreground">API Server</span>
              </div>
              <HealthIndicator status="healthy" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Response Time</span>
                <span className={cn("font-mono font-medium", data.apiLatency < 100 ? "text-emerald-400" : data.apiLatency < 500 ? "text-amber-400" : "text-red-500")}>
                  {data.apiLatency}ms
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Uptime</span>
                <span className="font-mono font-medium text-foreground">{formatUptime(data.uptime)}</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Heap Usage</span>
                  <span className="font-mono text-foreground">{heapPct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/30">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      heapPct < 60 ? "bg-emerald-400" : heapPct < 85 ? "bg-amber-400" : "bg-red-500"
                    )}
                    style={{ width: `${Math.min(heapPct, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{formatBytes(data.memoryUsage.heapUsed)}</span>
                  <span>{formatBytes(data.memoryUsage.heapTotal)}</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Price Feed */}
        <FadeIn delay={0.15}>
          <GlassCard className="p-5 hover-lift">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
                  <Wifi className="h-4 w-4 text-gold" />
                </div>
                <span className="text-sm font-semibold text-foreground">Price Feed</span>
              </div>
              <HealthIndicator status={data.priceFeedStatus} />
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                <span className={cn("font-medium", data.priceFeedStatus === "live" ? "text-emerald-400" : "text-amber-400")}>
                  {data.priceFeedStatus === "live" ? "Live" : "Stale"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Source</span>
                <span className="font-medium text-foreground">CoinGecko</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Cached Assets</span>
                <span className="font-mono font-medium text-foreground">{data.cachedAssets}</span>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Cache */}
        <FadeIn delay={0.2}>
          <GlassCard className="p-5 hover-lift">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
                  <HardDrive className="h-4 w-4 text-gold" />
                </div>
                <span className="text-sm font-semibold text-foreground">Cache</span>
              </div>
              <HealthIndicator status={data.cacheStatus} />
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                <span className={cn("font-medium", data.cacheStatus === "warm" ? "text-emerald-400" : "text-amber-400")}>
                  {data.cacheStatus === "warm" ? "Warm" : "Cold"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Entries</span>
                <span className="font-mono font-medium text-foreground">{data.cachedAssets}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">TTL</span>
                <span className="font-medium text-foreground">30s</span>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* NAV Engine */}
        <FadeIn delay={0.25}>
          <GlassCard className="p-5 hover-lift">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
                  <Cpu className="h-4 w-4 text-gold" />
                </div>
                <span className="text-sm font-semibold text-foreground">NAV Engine</span>
              </div>
              <HealthIndicator status={data.lastNavUpdate ? "healthy" : "critical"} />
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Last Update</span>
                <span className="font-medium text-foreground">
                  {data.lastNavUpdate ? timeAgo(data.lastNavUpdate) : "Never"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-emerald-400">Active</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Next Scheduled</span>
                <span className="font-medium text-foreground">4:00 PM EST</span>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Authentication */}
        <FadeIn delay={0.3}>
          <GlassCard className="p-5 hover-lift">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
                  <ShieldCheck className="h-4 w-4 text-gold" />
                </div>
                <span className="text-sm font-semibold text-foreground">Authentication</span>
              </div>
              <HealthIndicator status="healthy" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Active Sessions (24h)</span>
                <span className="font-mono font-medium text-foreground">{data.activeConnections}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">JWT Expiry</span>
                <span className="font-mono font-medium text-foreground">{data.accessExpiry}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">2FA Adoption</span>
                <span className={cn("font-mono font-medium", data.twoFaRate >= 50 ? "text-emerald-400" : "text-amber-400")}>
                  {data.twoFaRate}%
                </span>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </div>

      {/* System Info Bar */}
      <FadeIn delay={0.35}>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-black/30 px-3 py-1.5 text-xs">
            <Zap className="h-3 w-3 text-gold" />
            <span className="text-muted-foreground">Version</span>
            <span className="font-mono font-medium text-foreground">{data.version}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-black/30 px-3 py-1.5 text-xs">
            <Server className="h-3 w-3 text-gold" />
            <span className="text-muted-foreground">Environment</span>
            <span className="font-mono font-medium text-foreground">{data.environment}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-black/30 px-3 py-1.5 text-xs">
            <Clock className="h-3 w-3 text-gold" />
            <span className="text-muted-foreground">Uptime</span>
            <span className="font-mono font-medium text-foreground">{formatUptime(data.uptime)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-black/30 px-3 py-1.5 text-xs">
            <Cpu className="h-3 w-3 text-gold" />
            <span className="text-muted-foreground">RSS</span>
            <span className="font-mono font-medium text-foreground">{formatBytes(data.memoryUsage.rss)}</span>
          </div>
        </div>
      </FadeIn>

      {/* Activity Timeline */}
      <FadeIn delay={0.4}>
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold text-foreground">Activity Timeline</h3>
            </div>
          </div>
          <div className="max-h-80 space-y-0 overflow-y-auto scroll-luxury">
            {data.activity.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No recent activity</div>
            ) : (
              data.activity.map((event, idx) => (
                <div
                  key={event.id}
                  className="group flex items-start gap-3 border-b border-border/30 py-3 last:border-0"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/30">
                    <ActivityIcon type={event.type} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground leading-relaxed">{event.description}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(event.timestamp)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </FadeIn>

      {/* Auto-refresh bar */}
      <FadeIn delay={0.45}>
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-black/30 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Last checked: <span className="font-mono text-foreground">{secondsAgo}s</span> ago</span>
            <span className="text-muted-foreground/50">·</span>
            <span>Auto-refresh every 30s</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-7 gap-1.5 border-gold/20 text-xs text-gold hover:bg-gold/10"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh Now
          </Button>
        </div>
      </FadeIn>
    </div>
  );
}
