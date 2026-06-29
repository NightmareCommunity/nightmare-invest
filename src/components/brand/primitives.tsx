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
        "relative rounded-xl overflow-hidden",
        gold ? "glass-gold" : "glass",
        glow && (gold ? "glow-gold-strong" : "glow-gold"),
        hover && "transition-all duration-300 hover:-translate-y-0.5 hover:glow-gold",
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* gold top hairline */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      {children}
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
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: "gold" | "profit" | "loss" | "neutral";
  trend?: number;
  className?: string;
}) {
  const accentColor =
    accent === "profit" ? "text-profit" : accent === "loss" ? "text-loss" : accent === "gold" ? "text-gold" : "text-foreground";
  return (
    <GlassCard className={cn("p-5", className)} hover>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-gold/70">{icon}</span>}
      </div>
      <div className={cn("mt-3 font-metric text-2xl font-semibold tracking-tight", accentColor)}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </GlassCard>
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
