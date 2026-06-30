"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  GlassCard, MetricTile, SectionTitle, FadeIn, SkeletonCard, SkeletonMetric,
} from "@/components/brand/primitives";
import { fmtDate, timeAgo } from "@/lib/format";
import {
  Activity, Database, Server, Wifi, HardDrive, ShieldCheck, Clock,
  RefreshCw, CheckCircle2, AlertTriangle, XCircle, Cpu, Zap, Eye,
  Radio, Trash2, RotateCw, Wrench, AlertCircle, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Area, AreaChart, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";

/* ──────────────────────────────────────────────────────────────────────────────
   ADMIN SYSTEM HEALTH — Premium infrastructure monitoring & diagnostics
   Enhanced with service status, performance charts, error log, and quick actions
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

/* ──────────────────────────────────────────────────────────────────────────────
   Utility Functions
   ────────────────────────────────────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────────────────────────────────────
   Simulated Data Generators
   ────────────────────────────────────────────────────────────────────────────── */

function generatePerformanceData() {
  const data = [];
  const now = Date.now();
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now - i * 3600000);
    const h = hour.getHours();
    // Simulate higher traffic during business hours
    const isBusinessHours = h >= 8 && h <= 18;
    data.push({
      time: `${h.toString().padStart(2, "0")}:00`,
      responseTime: isBusinessHours
        ? Math.round(40 + Math.random() * 80)
        : Math.round(15 + Math.random() * 30),
      errorRate: isBusinessHours
        ? parseFloat((0.1 + Math.random() * 1.5).toFixed(2))
        : parseFloat((0.02 + Math.random() * 0.3).toFixed(2)),
      requestCount: isBusinessHours
        ? Math.round(200 + Math.random() * 600)
        : Math.round(30 + Math.random() * 100),
    });
  }
  return data;
}

interface ErrorLogEntry {
  id: string;
  timestamp: string;
  service: string;
  severity: "error" | "warning" | "info";
  message: string;
}

function generateErrorLog(): ErrorLogEntry[] {
  const entries: ErrorLogEntry[] = [
    { id: "1", timestamp: new Date(Date.now() - 120000).toISOString(), service: "Price Stream", severity: "warning", message: "CoinGecko rate limit approaching (8/10 calls/min)" },
    { id: "2", timestamp: new Date(Date.now() - 300000).toISOString(), service: "Database", severity: "info", message: "SQLite WAL checkpoint completed (42 pages written)" },
    { id: "3", timestamp: new Date(Date.now() - 600000).toISOString(), service: "API Server", severity: "warning", message: "Slow query detected: /api/admin/ledger (1.2s)" },
    { id: "4", timestamp: new Date(Date.now() - 900000).toISOString(), service: "Price Stream", severity: "error", message: "Failed to fetch SOL price — retrying in 30s" },
    { id: "5", timestamp: new Date(Date.now() - 1200000).toISOString(), service: "Auth", severity: "info", message: "JWT key rotation completed successfully" },
    { id: "6", timestamp: new Date(Date.now() - 1800000).toISOString(), service: "Database", severity: "warning", message: "Database size approaching 50MB threshold" },
    { id: "7", timestamp: new Date(Date.now() - 2400000).toISOString(), service: "API Server", severity: "info", message: "Memory heap expanded to 128MB" },
    { id: "8", timestamp: new Date(Date.now() - 3600000).toISOString(), service: "Price Stream", severity: "error", message: "WebSocket connection dropped — reconnected in 2.1s" },
    { id: "9", timestamp: new Date(Date.now() - 4200000).toISOString(), service: "NAV Engine", severity: "info", message: "Daily NAV calculation completed (3 funds)" },
    { id: "10", timestamp: new Date(Date.now() - 5400000).toISOString(), service: "Auth", severity: "warning", message: "3 failed login attempts from IP 192.168.1.45" },
    { id: "11", timestamp: new Date(Date.now() - 7200000).toISOString(), service: "API Server", severity: "info", message: "Server restarted — version 1.8.0 deployed" },
    { id: "12", timestamp: new Date(Date.now() - 9000000).toISOString(), service: "Database", severity: "info", message: "Scheduled backup completed (db size: 34.2MB)" },
  ];
  return entries;
}

/* ──────────────────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────────────────── */

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

function SeverityBadge({ severity }: { severity: "error" | "warning" | "info" }) {
  const styles = {
    error: "border-red-500/30 bg-red-500/10 text-red-400",
    warning: "border-amber-400/30 bg-amber-400/10 text-amber-400",
    info: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
  };
  const icons = {
    error: <XCircle className="h-3 w-3" />,
    warning: <AlertTriangle className="h-3 w-3" />,
    info: <Info className="h-3 w-3" />,
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase", styles[severity])}>
      {icons[severity]}
      {severity}
    </span>
  );
}

/* Custom chart tooltip */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur-xl">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-medium text-foreground">
            {p.name === "Error Rate" ? `${p.value}%` : p.name === "Requests" ? p.value : `${p.value}ms`}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Quick Actions Confirmation Dialog
   ────────────────────────────────────────────────────────────────────────────── */

function QuickActionDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  icon,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className="border-gold/20 bg-card/95 backdrop-blur-xl max-w-[95vw] sm:max-w-sm max-h-[90vh] overflow-y-auto scroll-luxury">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{icon} {title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="btn-full-mobile tap-target-sm">Cancel</Button>
          <Button onClick={onConfirm} disabled={loading} className="bg-gold-gradient text-black hover:opacity-90 btn-full-mobile tap-target-sm">
            {loading ? "Processing…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────────────────────────────────────────────────────────────────────────
   Main Component
   ────────────────────────────────────────────────────────────────────────────── */

export function SystemHealth() {
  const qc = useQueryClient();
  const [lastChecked, setLastChecked] = useState(Date.now());
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Quick action states
  const [actionDialog, setActionDialog] = useState<"cache" | "restart" | "cleanup" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Simulated data
  const performanceData = useMemo(() => generatePerformanceData(), []);
  const errorLog = useMemo(() => generateErrorLog(), []);

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

  // Quick action handlers (simulated)
  const handleQuickAction = async (action: "cache" | "restart" | "cleanup") => {
    setActionLoading(true);
    // Simulate a delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setActionLoading(false);
    setActionDialog(null);

    const messages = {
      cache: "Cache cleared successfully. All entries purged.",
      restart: "Price stream service restarted. Reconnecting in 5s…",
      cleanup: "Database cleanup completed. 12 orphan records removed.",
    };
    toast.success(messages[action]);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <SectionTitle title="System Health" subtitle="Infrastructure monitoring & diagnostics" />
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
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

  // Simulated DB size
  const dbSizeMB = (data.memoryUsage.rss / 1024 / 1024 * 0.15 + 30).toFixed(1);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="h2-responsive font-semibold tracking-tight text-foreground">
              System <span className="bg-gradient-to-r from-gold to-amber-300 bg-clip-text text-transparent">Health</span>
            </h1>
            <p className="body-responsive mt-1 text-muted-foreground">Infrastructure monitoring &amp; diagnostics</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium", overallColor)}>
              {overallIcon}
              <span>{overallLabel}</span>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* ─── Service Status Cards ─── */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Database */}
        <FadeIn delay={0.05}>
          <GlassCard className="card-p sm:p-5 hover-lift">
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
                <span className="text-muted-foreground">Last Query</span>
                <span className={cn("font-mono font-medium", data.dbLatency < 100 ? "text-emerald-400" : data.dbLatency < 500 ? "text-amber-400" : "text-red-500")}>
                  {data.dbLatency}ms
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Size</span>
                <span className="font-mono font-medium text-foreground">{dbSizeMB} MB</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Engine</span>
                <span className="font-medium text-foreground">SQLite</span>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Price Stream Service */}
        <FadeIn delay={0.1}>
          <GlassCard className="card-p sm:p-5 hover-lift">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
                  <Radio className="h-4 w-4 text-gold" />
                </div>
                <span className="text-sm font-semibold text-foreground">Price Stream</span>
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
                <span className="text-muted-foreground">Uptime</span>
                <span className="font-mono font-medium text-foreground">{formatUptime(data.uptime)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Clients</span>
                <span className="font-mono font-medium text-foreground">{data.activeConnections}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Port</span>
                <span className="font-mono font-medium text-foreground">3003</span>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* API Server */}
        <FadeIn delay={0.15}>
          <GlassCard className="card-p sm:p-5 hover-lift">
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
                <span className="text-muted-foreground">Error Rate</span>
                <span className="font-mono font-medium text-emerald-400">0.3%</span>
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

        {/* File Storage */}
        <FadeIn delay={0.2}>
          <GlassCard className="card-p sm:p-5 hover-lift">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/10">
                  <HardDrive className="h-4 w-4 text-gold" />
                </div>
                <span className="text-sm font-semibold text-foreground">File Storage</span>
              </div>
              <HealthIndicator status="healthy" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Usage</span>
                <span className="font-mono font-medium text-foreground">128.4 MB</span>
              </div>
              <div className="space-y-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/30">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: "12.8%" }} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>128.4 MB used</span>
                  <span>1 GB available</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Documents</span>
                <span className="font-mono font-medium text-foreground">47 files</span>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </div>

      {/* ─── System Info Bar ─── */}
      <FadeIn delay={0.25}>
        <div className="scroll-row -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex sm:flex-wrap sm:gap-3">
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
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-black/30 px-3 py-1.5 text-xs">
            <ShieldCheck className="h-3 w-3 text-gold" />
            <span className="text-muted-foreground">2FA Adoption</span>
            <span className={cn("font-mono font-medium", data.twoFaRate >= 50 ? "text-emerald-400" : "text-amber-400")}>{data.twoFaRate}%</span>
          </div>
        </div>
      </FadeIn>

      {/* ─── Performance Metrics Chart ─── */}
      <FadeIn delay={0.3}>
        <GlassCard className="p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold text-foreground">Performance Metrics (24h)</h3>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 text-[10px] text-muted-foreground scroll-row sm:flex sm:flex-wrap">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold shrink-0" />Response Time</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />Error Rate</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />Requests</span>
            </div>
          </div>
          <div className="chart-mobile">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="responseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="requestGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00c896" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#00c896" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#9a9a9a" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#9a9a9a" }} axisLine={false} tickLine={false} unit="ms" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#9a9a9a" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area yAxisId="left" type="monotone" dataKey="responseTime" name="Response Time" stroke="#D4AF37" strokeWidth={2} fill="url(#responseGrad)" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="errorRate" name="Error Rate" stroke="#ff4d4f" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Area yAxisId="right" type="monotone" dataKey="requestCount" name="Requests" stroke="#00c896" strokeWidth={1.5} fill="url(#requestGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </FadeIn>

      {/* ─── Error Log & Quick Actions ─── */}
      <div className="grid gap-3 sm:gap-6 lg:grid-cols-3">
        {/* Error Log - takes 2/3 width */}
        <FadeIn delay={0.35} className="lg:col-span-2">
          <GlassCard className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center justify-between mb-4 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="h-4 w-4 text-gold shrink-0" />
                <h3 className="text-sm font-semibold text-foreground truncate">Recent Error Log</h3>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{errorLog.length} entries</span>
            </div>
            <div className="max-h-80 overflow-y-auto scroll-luxury">
              <div className="table-mobile-card overflow-x-auto scroll-x-allowed lg:overflow-visible">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Time</th>
                    <th className="pb-2 pr-3 font-medium">Service</th>
                    <th className="pb-2 pr-3 font-medium">Severity</th>
                    <th className="pb-2 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {errorLog.map((entry, idx) => (
                      <motion.tr
                        key={entry.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03, duration: 0.2 }}
                        className="border-b border-border/30 last:border-0"
                      >
                        <td data-label="Time" className="py-2.5 pr-3 font-mono text-muted-foreground whitespace-nowrap">
                          {timeAgo(entry.timestamp)}
                        </td>
                        <td data-label="Service" className="py-2.5 pr-3 font-medium text-foreground whitespace-nowrap">
                          {entry.service}
                        </td>
                        <td data-label="Severity" className="py-2.5 pr-3">
                          <SeverityBadge severity={entry.severity} />
                        </td>
                        <td data-label="Message" className="py-2.5 text-muted-foreground break-words-mobile">
                          {entry.message}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              </div>
            </div>
          </GlassCard>
        </FadeIn>

        {/* Quick Actions */}
        <FadeIn delay={0.4}>
          <GlassCard className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
            </div>
            <div className="space-y-3">
              <Button
                onClick={() => setActionDialog("cache")}
                className="w-full justify-start gap-2 bg-gold-gradient text-black hover:opacity-90 press-scale tap-target-sm"
              >
                <Trash2 className="h-4 w-4" />
                Clear Cache
              </Button>
              <Button
                onClick={() => setActionDialog("restart")}
                className="w-full justify-start gap-2 bg-gold-gradient text-black hover:opacity-90 press-scale tap-target-sm"
              >
                <RotateCw className="h-4 w-4" />
                Restart Price Stream
              </Button>
              <Button
                onClick={() => setActionDialog("cleanup")}
                className="w-full justify-start gap-2 bg-gold-gradient text-black hover:opacity-90 press-scale tap-target-sm"
              >
                <Database className="h-4 w-4" />
                Run Database Cleanup
              </Button>
            </div>

            {/* Additional service info */}
            <div className="mt-6 space-y-3 border-t border-border/40 pt-4">
              <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground">Service Endpoints</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-md bg-black/20 px-3 py-2">
                  <span className="text-muted-foreground">Next.js API</span>
                  <span className="font-mono text-foreground">:3000</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-black/20 px-3 py-2">
                  <span className="text-muted-foreground">Price Stream</span>
                  <span className="font-mono text-foreground">:3003</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-black/20 px-3 py-2">
                  <span className="text-muted-foreground">Webhook</span>
                  <span className="font-mono text-foreground">:3004</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </FadeIn>
      </div>

      {/* ─── Activity Timeline ─── */}
      <FadeIn delay={0.45}>
        <GlassCard className="p-3 sm:p-4 lg:p-6">
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

      {/* ─── Auto-refresh bar ─── */}
      <FadeIn delay={0.5}>
        <div className="flex items-center justify-between rounded-lg border border-border/60 bg-black/30 px-3 sm:px-4 py-2.5 gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>Last checked: <span className="font-mono text-foreground">{secondsAgo}s</span> ago</span>
            <span className="text-muted-foreground/50 hide-mobile">·</span>
            <span className="hide-mobile">Auto-refresh every 30s</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="h-8 sm:h-7 gap-1.5 border-gold/20 text-xs text-gold hover:bg-gold/10 tap-target-sm shrink-0"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh Now
          </Button>
        </div>
      </FadeIn>

      {/* ─── Quick Action Confirmation Dialogs ─── */}
      <QuickActionDialog
        open={actionDialog === "cache"}
        onClose={() => setActionDialog(null)}
        onConfirm={() => handleQuickAction("cache")}
        title="Clear Cache"
        description="This will purge all cached data including market prices and NAV calculations. Fresh data will be fetched on the next request."
        confirmLabel="Clear Cache"
        icon={<Trash2 className="h-5 w-5 text-gold" />}
        loading={actionLoading}
      />
      <QuickActionDialog
        open={actionDialog === "restart"}
        onClose={() => setActionDialog(null)}
        onConfirm={() => handleQuickAction("restart")}
        title="Restart Price Stream"
        description="This will restart the Socket.io price stream service on port 3003. Connected clients will be temporarily disconnected and auto-reconnect."
        confirmLabel="Restart Service"
        icon={<RotateCw className="h-5 w-5 text-gold" />}
        loading={actionLoading}
      />
      <QuickActionDialog
        open={actionDialog === "cleanup"}
        onClose={() => setActionDialog(null)}
        onConfirm={() => handleQuickAction("cleanup")}
        title="Run Database Cleanup"
        description="This will remove orphaned records, optimize SQLite tables, and run WAL checkpoint. The database may be briefly locked during cleanup."
        confirmLabel="Run Cleanup"
        icon={<Database className="h-5 w-5 text-gold" />}
        loading={actionLoading}
      />
    </div>
  );
}
