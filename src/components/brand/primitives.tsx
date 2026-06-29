"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function GlassCard({
  className,
  children,
  gold = false,
  glow = false,
  hover = false,
  onClick,
}: {
  className?: string;
  children: ReactNode;
  gold?: boolean;
  glow?: boolean;
  hover?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-xl overflow-hidden group",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        gold ? "glass-gold" : "glass",
        glow && (gold ? "glow-gold-strong" : "glow-gold"),
        hover && "transition-all duration-300 hover:-translate-y-0.5 hover:glow-gold",
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* gold top hairline — pulses on gold cards */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent",
          gold && "gold-hairline-pulse"
        )}
      />
      {/* hover brightening overlay */}
      <div className="pointer-events-none absolute inset-0 rounded-xl bg-white/0 transition-colors duration-300 group-hover:bg-white/[0.02]" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export function MetricTile({
  label,
  value,
  sub,
  icon,
  accent,
  trend,
  sparkline,
  className,
  children,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: "gold" | "profit" | "loss" | "neutral";
  trend?: number;
  sparkline?: number[];
  className?: string;
  children?: ReactNode;
}) {
  const accentColor =
    accent === "profit" ? "text-profit" : accent === "loss" ? "text-loss" : accent === "gold" ? "text-gold" : "text-foreground";
  return (
    <GlassCard className={cn("metric-bottom-border p-5 transition-transform duration-200 hover:scale-[1.02]", className)} hover>
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10.5px] font-medium uppercase leading-tight tracking-[0.12em] text-foreground/60 [overflow-wrap:anywhere]">
            {label}
          </span>
          {icon && <span className="shrink-0 text-gold/70">{icon}</span>}
        </div>
        <div className={cn("mt-3 font-metric text-2xl font-semibold tracking-tight text-shadow-metric", accentColor)}>
          {value}
        </div>
        {sub && <div className="mt-1 text-xs text-foreground/50">{sub}</div>}
        {sparkline && sparkline.length >= 2 && (
          <div className="pointer-events-none absolute bottom-2 right-3 opacity-80">
            <SparklineSVG data={sparkline} />
          </div>
        )}
        {children}
      </div>
    </GlassCard>
  );
}

/**
 * Tiny 60×20 SVG line sparkline with a smooth bezier path. Gold stroke, no axes.
 */
function SparklineSVG({ data }: { data: number[] }) {
  const w = 60;
  const h = 20;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  // Map each value to an (x, y) point within the 60×20 box, with 1px padding
  const pad = 1.5;
  const usableW = w - pad * 2;
  const usableH = h - pad * 2;
  const points = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * usableW,
    y: pad + (1 - (v - min) / range) * usableH,
  }));

  // Build a smooth cubic-bezier path using Catmull-Rom → Bezier conversion
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];
    const tension = 0.18;
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * (1 - tension) * 6 * 0.5;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * (1 - tension) * 6 * 0.5;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * (1 - tension) * 6 * 0.5;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * (1 - tension) * 6 * 0.5;
    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  const last = points[points.length - 1];
  const gradId = `spark-${Math.round(last.x * 1000 + last.y)}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={`${path} L ${last.x.toFixed(2)} ${h} L ${points[0].x.toFixed(2)} ${h} Z`}
        fill={`url(#${gradId})`}
        stroke="none"
      />
      <path
        d={path}
        fill="none"
        stroke="#D4AF37"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={1.4} fill="#FFD700" />
    </svg>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    PENDING: { label: "Pending", cls: "text-warning border-warning/30 bg-warning/10", dot: "bg-warning" },
    APPROVED: { label: "Approved", cls: "text-profit border-profit/30 bg-profit/10", dot: "bg-profit" },
    REJECTED: { label: "Rejected", cls: "text-loss border-loss/30 bg-loss/10", dot: "bg-loss" },
  };
  const s = map[status] ?? { label: status, cls: "text-muted-foreground border-border bg-muted", dot: "bg-muted-foreground" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", s.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function TypePill({ type }: { type: string }) {
  const isDeposit = type === "DEPOSIT";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        isDeposit
          ? "border-profit/30 bg-profit/10 text-profit"
          : "border-info/30 bg-info/10 text-info"
      )}
    >
      {isDeposit ? "Deposit" : "Withdrawal"}
    </span>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
