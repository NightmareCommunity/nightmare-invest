"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Skeleton Components — Premium loading placeholders                 */
/* ------------------------------------------------------------------ */

export function SkeletonCard({ className }: { className?: string }) {
  return <div className={cn("rounded-xl glass shimmer", className)} />;
}

export function SkeletonMetric({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl glass p-4 sm:p-5 space-y-3 min-w-0", className)}>
      <div className="h-3 w-20 sm:w-24 rounded bg-muted/40 shimmer" />
      <div className="h-7 sm:h-8 w-24 sm:w-32 rounded bg-muted/40 shimmer" />
      <div className="h-3 w-16 sm:w-20 rounded bg-muted/30 shimmer" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 flex-1 rounded bg-muted/30 shimmer" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4" style={{ opacity: 1 - i * 0.12 }}>
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 flex-1 rounded bg-muted/20 shimmer" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty State Component — Reusable empty data display                */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <FadeIn className={cn("flex flex-col items-center justify-center gap-3 sm:gap-4 py-10 sm:py-16 text-center px-4", className)}>
      <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-full border border-gold/20 bg-gold/5">
        <span className="text-gold/60">{icon}</span>
      </div>
      <div className="space-y-1 min-w-0">
        <h3 className="text-base sm:text-lg font-semibold text-foreground break-words-mobile">{title}</h3>
        <p className="max-w-sm mx-auto text-sm text-muted-foreground break-words-mobile">{description}</p>
      </div>
      {action}
    </FadeIn>
  );
}

export function GlassCard({
  className,
  children,
  gold = false,
  glow = false,
  hover = false,
  glowOnHover = false,
  compact = false,
  onClick,
}: {
  className?: string;
  children: ReactNode;
  gold?: boolean;
  glow?: boolean;
  hover?: boolean;
  glowOnHover?: boolean;
  /** Use compact mobile-first padding (p-3 sm:p-4) instead of author-supplied. */
  compact?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-xl overflow-hidden group min-w-0",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        compact && "p-3 sm:p-4",
        gold ? "glass-gold" : "glass",
        glow && (gold ? "glow-gold-strong" : "glow-gold"),
        hover && "transition-all duration-300 hover:-translate-y-0.5 hover:glow-gold",
        glowOnHover && "gold-glow-hover",
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
  animated = false,
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
  animated?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const accentColor =
    accent === "profit" ? "text-profit" : accent === "loss" ? "text-loss" : accent === "gold" ? "text-gold" : "text-foreground";
  return (
    <GlassCard className={cn("metric-bottom-border p-3 sm:p-4 lg:p-5 transition-transform duration-200 hover:scale-[1.02] min-w-0", animated && "scale-in", className)} hover glowOnHover>
      <div className="relative min-w-0">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <span className="text-[10px] sm:text-[10.5px] font-medium uppercase leading-tight tracking-[0.12em] text-foreground/60 [overflow-wrap:anywhere] min-w-0">
            {label}
          </span>
          {icon && <span className="shrink-0 text-gold/70">{icon}</span>}
        </div>
        <div className={cn("mt-2 sm:mt-3 font-metric text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-shadow-metric break-words-mobile", accentColor)}>
          {value}
        </div>
        {sub && <div className="mt-1 text-[11px] sm:text-xs text-foreground/50 break-words-mobile">{sub}</div>}
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
    <div className={cn("flex items-end justify-between gap-3 sm:gap-4 min-w-0", className)}>
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg lg:text-xl font-semibold tracking-tight text-foreground break-words-mobile">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground break-words-mobile">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
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
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-medium whitespace-nowrap", s.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot)} />
      <span className="truncate max-w-[10rem] sm:max-w-none">{s.label}</span>
    </span>
  );
}

export function TypePill({ type }: { type: string }) {
  const isDeposit = type === "DEPOSIT";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] sm:text-[11px] font-medium whitespace-nowrap",
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
  direction = "up",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "right" | "none";
}) {
  // Reduced motion distance on small screens for performance & subtlety.
  const initial = (() => {
    if (direction === "right") return { opacity: 0, x: 12 };
    if (direction === "none") return { opacity: 0 };
    return { opacity: 0, y: 8 };
  })();
  const animate = (() => {
    if (direction === "right") return { opacity: 1, x: 0 };
    if (direction === "none") return { opacity: 1 };
    return { opacity: 1, y: 0 };
  })();
  return (
    <motion.div
      initial={initial}
      animate={animate}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
