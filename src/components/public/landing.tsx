"use client";
import { useRef, useEffect, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useApp } from "@/lib/store";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { GlassCard, FadeIn } from "@/components/brand/primitives";
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  TrendingUp,
  Globe,
  Layers,
  Zap,
  CheckCircle2,
  Quote,
  Building2,
  FileCheck2,
  Wallet,
  BarChart3,
  ChevronDown,
  BadgeCheck,
  Eye,
  Scale,
  Gauge,
  Users,
  Menu,
  X,
} from "lucide-react";
import { fmtUSD, fmtPct, fmtNum } from "@/lib/format";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */

const heroStats = [
  { label: "Assets Under Management", value: 284.6, prefix: "$", suffix: "M", sub: "As of latest NAV", icon: Wallet, decimals: 1 },
  { label: "Since Inception Return", value: 147.2, prefix: "+", suffix: "%", sub: "Net of fees", icon: TrendingUp, decimals: 1 },
  { label: "Sharpe Ratio", value: 2.31, prefix: "", suffix: "", sub: "Risk-adjusted", icon: Gauge, decimals: 2 },
  { label: "Accredited Investors", value: 412, prefix: "", suffix: "", sub: "Across 23 jurisdictions", icon: Users, decimals: 0 },
];

const strategyCards = [
  {
    icon: Wallet,
    asset: "Bitcoin",
    ticker: "BTC",
    weight: 40,
    color: "#F7931A",
    note: "Core position — long-term store-of-value thesis with tactical rebalancing around halving cycles.",
  },
  {
    icon: Layers,
    asset: "Ethereum",
    ticker: "ETH",
    weight: 25,
    color: "#627EEA",
    note: "Smart-contract ecosystem exposure via the leading Layer 1, including staking yield.",
  },
  {
    icon: Zap,
    asset: "Solana",
    ticker: "SOL",
    weight: 15,
    color: "#14F195",
    note: "High-throughput blockchain growth play — DeFi, DePIN, and consumer applications.",
  },
  {
    icon: BarChart3,
    asset: "Stablecoin Yield",
    ticker: "USDC/USDT",
    weight: 10,
    color: "#4A90E2",
    note: "Low-volatility anchor generating 4-8% APY through institutional DeFi lending strategies.",
  },
  {
    icon: TrendingUp,
    asset: "High-Conviction Alts",
    ticker: "Various",
    weight: 10,
    color: "#D4AF37",
    note: "Concentrated bets on emerging L1s, infrastructure, and AI-crypto convergence narratives.",
  },
];

const securityItems = [
  {
    icon: ShieldCheck,
    title: "Institutional Custody",
    desc: "Multi-signature cold storage with qualified custodians. SOC 2 Type II audited infrastructure.",
  },
  {
    icon: Lock,
    title: "256-bit Encryption",
    desc: "End-to-end AES-256 encryption for all data at rest and in transit. Zero-knowledge architecture.",
  },
  {
    icon: FileCheck2,
    title: "Audit Trail",
    desc: "Immutable on-chain audit logs for every transaction, NAV publication, and portfolio action.",
  },
  {
    icon: BadgeCheck,
    title: "SOC 2 Compliance",
    desc: "Independently audited security controls meeting the highest institutional standards.",
  },
  {
    icon: Eye,
    title: "Transparent Reporting",
    desc: "Daily NAV, institutional-grade analytics, and downloadable statements on demand.",
  },
  {
    icon: Scale,
    title: "Global Compliance",
    desc: "Engineered for accredited investors across compliant jurisdictions worldwide.",
  },
];

const trustBadges = [
  { label: "Regulated", icon: Building2 },
  { label: "Audited", icon: FileCheck2 },
  { label: "Insured", icon: ShieldCheck },
];

/* As-featured-in text-based press row */
const pressLogos = ["BLOOMBERG", "COINDESK", "FORBES", "REUTERS", "THE BLOCK", "FINANCIAL TIMES", "WALL STREET JOURNAL"];

/* Backed-by institutional logos — large monospace placeholder style */
const backedByLogos = [
  { name: "BLACKROCK", sub: "Asset Management" },
  { name: "FIDELITY", sub: "Investments" },
  { name: "GOLDMAN SACHS", sub: "Securities" },
  { name: "SEQUOIA", sub: "Capital" },
  { name: "PARADIGM", sub: "Ventures" },
  { name: "a16z", sub: "Crypto" },
];

/* ------------------------------------------------------------------ */
/*  Particle Canvas Component                                          */
/* ------------------------------------------------------------------ */

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      opacity: number;
      pulseSpeed: number;
      pulsePhase: number;
    }

    const PARTICLE_COUNT = 70;
    const CONNECTION_DISTANCE = 140;

    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.5 + 0.2,
        pulseSpeed: Math.random() * 0.01 + 0.005,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    let time = 0;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      time += 1;

      // Update and draw particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Pulse opacity
        const pulsedOpacity = p.opacity + Math.sin(time * p.pulseSpeed + p.pulsePhase) * 0.15;
        const clampedOpacity = Math.max(0.05, Math.min(0.7, pulsedOpacity));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 55, ${clampedOpacity})`;
        ctx.fill();
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DISTANCE) {
            const lineOpacity = (1 - dist / CONNECTION_DISTANCE) * 0.12;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(212, 175, 55, ${lineOpacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-particle-canvas" />;
}

/* ------------------------------------------------------------------ */
/*  Animated Counter Component                                         */
/* ------------------------------------------------------------------ */

function AnimatedCounter({
  value,
  prefix,
  suffix,
  decimals,
  duration = 2,
}: {
  value: number;
  prefix: string;
  suffix: string;
  decimals: number;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    let startTime: number | null = null;
    const startValue = 0;
    const endValue = value;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [isInView, value, duration]);

  const formatted = decimals === 0
    ? Math.round(displayValue).toLocaleString()
    : displayValue.toFixed(decimals);

  return (
    <span ref={ref} className="font-metric text-gold-gradient">
      {prefix}{formatted}{suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Scroll-Reveal Section Wrapper                                      */
/* ------------------------------------------------------------------ */

function ScrollReveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Landing Component                                             */
/* ------------------------------------------------------------------ */

export function Landing() {
  const setRoute = useApp((s) => s.setRoute);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const navItems = [
    { label: "Strategy", href: "strategy" },
    { label: "Performance", href: "performance" },
    { label: "Security", href: "security" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* ---- Sticky nav ---- */}
      <header className="fixed top-0 left-0 right-0 z-50 topbar-glow-line glass-strong safe-area-top">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((n) => (
              <button
                key={n.label}
                onClick={() => scrollTo(n.href)}
                className="text-sm text-foreground/60 transition-colors hover:text-gold gold-underline-accent"
              >
                {n.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setRoute({ name: "login" })}
              className="hidden sm:inline-flex text-foreground/60 hover:text-foreground transition-colors tap-target-sm"
            >
              Login
            </Button>
            <Button
              onClick={() => setRoute({ name: "signup" })}
              className="bg-gold-gradient text-black hover:opacity-90 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] tap-target-sm"
            >
              Request Access
            </Button>
            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileNavOpen}
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground/70 hover:bg-gold/10 hover:text-gold transition-colors tap-target-sm"
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown nav */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden overflow-hidden border-t border-border/40 bg-[#0a0a0b]/95 backdrop-blur-xl"
            >
              <div className="px-4 py-3 space-y-1">
                {navItems.map((n) => (
                  <button
                    key={n.label}
                    onClick={() => {
                      scrollTo(n.href);
                      setMobileNavOpen(false);
                    }}
                    className="block w-full text-left px-3 py-2.5 rounded-md text-sm text-foreground/70 hover:bg-gold/10 hover:text-gold transition-colors tap-target-sm"
                  >
                    {n.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setRoute({ name: "login" });
                    setMobileNavOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2.5 rounded-md text-sm text-foreground/70 hover:bg-gold/10 hover:text-gold transition-colors tap-target-sm sm:hidden"
                >
                  Login
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ============================================================ */}
      {/*  HERO — Full viewport with particle canvas                   */}
      {/* ============================================================ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden pt-16 sm:pt-20">
        {/* Animated particle canvas */}
        <ParticleCanvas />
        {/* Gold scanning line */}
        <div className="hero-scan-line absolute inset-x-0 z-[1] h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
        {/* Radial gold glow */}
        <div className="absolute -top-40 left-1/2 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-gold/[0.07] blur-[160px]" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0a0a0b] to-transparent z-[2]" />

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-5xl px-4 pt-12 pb-10 text-center sm:px-6 sm:pt-20 sm:pb-12 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Badge — enhanced with better padding, rounded corners, subtle shadow */}
            <div className="premium-chip mx-auto mb-6 sm:mb-8 shimmer-badge rounded-full shadow-[0_0_16px_rgba(212,175,55,0.15),0_2px_8px_rgba(0,0,0,0.3)] px-4 py-2 sm:px-5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-gold-bright shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
              </span>
              <span className="break-words-mobile">Nightmare Alpha Crypto Fund · Now Accepting Allocations</span>
            </div>

            {/* Headline — gold shimmer on main text only */}
            <h1 className="h1-responsive text-balance font-extrabold tracking-tight">
              <span className="text-gold-shimmer text-glow-gold">NIGHTMARE ALPHA</span>
              <span className="mx-2 inline-block h-5 w-px translate-y-[-3px] bg-gradient-to-b from-transparent via-gold/50 to-transparent sm:mx-3 sm:h-6 lg:mx-4 lg:h-8" />
              <span className="font-black tracking-tight text-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                CRYPTO FUND
              </span>
            </h1>

            {/* Subheadline — larger, better spacing */}
            <p className="body-responsive mx-auto mt-5 sm:mt-8 max-w-2xl text-pretty leading-relaxed text-foreground/65 sm:text-xl sm:leading-relaxed">
              Institutional-Grade Digital Asset Management for Accredited Investors
            </p>

            {/* CTAs — with micro-animation enhancements */}
            <div className="mt-8 sm:mt-12 flex flex-col items-stretch sm:flex-row justify-center gap-3 sm:gap-4">
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="w-full sm:w-auto"
              >
                <Button
                  size="lg"
                  onClick={() => setRoute({ name: "signup" })}
                  className="group h-12 sm:h-14 rounded-lg bg-gold-gradient px-6 sm:px-8 text-sm sm:text-base font-bold text-black shadow-[0_0_32px_rgba(212,175,55,0.25)] hover:shadow-[0_0_48px_rgba(212,175,55,0.4)] transition-shadow cta-gold-sweep w-full tap-target"
                >
                  Request Access
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1.5" />
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="w-full sm:w-auto"
              >
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => scrollTo("strategy")}
                  className="group h-12 sm:h-14 rounded-lg border-gold/30 px-6 sm:px-8 text-sm sm:text-base text-gold hover:bg-gold/10 transition-all w-full tap-target"
                >
                  Learn More
                  <ChevronDown className="ml-2 h-4 w-4 translate-y-px transition-transform group-hover:translate-y-1" />
                </Button>
              </motion.div>
            </div>
            <p className="mt-4 sm:mt-5 text-[11px] sm:text-xs uppercase tracking-[0.16em] sm:tracking-[0.18em] text-foreground/45 break-words-mobile">
              For accredited investors only · Minimum commitment $50,000
            </p>
          </motion.div>

          {/* Hero stats row with animated counters */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-12 sm:mt-16 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
          >
            {heroStats.map((s) => {
              const Icon = s.icon;
              return (
                <GlassCard
                  key={s.label}
                  gold
                  className="stat-card-gold gold-corner-accent glass-card-hover p-3 sm:p-4 lg:p-5 text-left min-w-0"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] sm:tracking-[0.16em] text-muted-foreground min-w-0 [overflow-wrap:anywhere]">
                      <Icon className="h-3 w-3 shrink-0 text-gold/70" />
                      <span className="truncate sm:truncate-none">{s.label}</span>
                    </div>
                  </div>
                  <div className="mt-2 font-metric text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold break-words-mobile">
                    <AnimatedCounter
                      value={s.value}
                      prefix={s.prefix}
                      suffix={s.suffix}
                      decimals={s.decimals}
                    />
                  </div>
                  <div className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground break-words-mobile">{s.sub}</div>
                </GlassCard>
              );
            })}
          </motion.div>

          {/* "Backed by" institutional logos row — large, prominent */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-12 sm:mt-16 flex flex-col items-center gap-4 sm:gap-5"
          >
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.24em] sm:tracking-[0.32em] text-gold/60 text-center">
              Backed by Leading Institutions
            </span>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-3 sm:gap-4 w-full">
              {backedByLogos.map((b) => (
                <div
                  key={b.name}
                  className="group flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 sm:px-6 sm:py-4 transition-all duration-300 hover:border-gold/25 hover:bg-gold/[0.04] hover:shadow-[0_0_20px_rgba(212,175,55,0.08)] min-w-0"
                >
                  <span className="font-mono text-xs sm:text-base font-bold tracking-[0.12em] sm:tracking-[0.16em] text-foreground/40 transition-colors duration-300 group-hover:text-foreground/70 text-center break-words-mobile">
                    {b.name}
                  </span>
                  <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.16em] sm:tracking-[0.2em] text-muted-foreground/35 transition-colors duration-300 group-hover:text-gold/60">
                    {b.sub}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* As-featured-in press row — marquee */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.65 }}
            className="mt-8 sm:mt-10 flex flex-col items-center gap-3"
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.24em] sm:tracking-[0.28em] text-muted-foreground/50">
              As featured in
            </span>
            <div className="press-logo-marquee-container relative w-full max-w-3xl overflow-hidden">
              <div className="press-logo-marquee">
                {[0, 1].map((set) => (
                  <div key={set} className="inline-flex items-center gap-6 sm:gap-10 px-3 sm:px-5">
                    {pressLogos.map((logo) => (
                      <span
                        key={`${set}-${logo}`}
                        className="press-logo-item font-metric text-xs sm:text-sm font-bold tracking-[0.16em] sm:tracking-[0.18em] text-muted-foreground/40 transition-colors hover:text-foreground/70 whitespace-nowrap"
                      >
                        {logo}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scroll-down indicator */}
        <motion.button
          type="button"
          aria-label="Scroll to strategy section"
          onClick={() => scrollTo("strategy")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="scroll-indicator absolute bottom-4 sm:bottom-6 left-1/2 z-10 -translate-x-1/2"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.button>
      </section>

      {/* ============================================================ */}
      {/*  LIVE TICKER TAPE                                            */}
      {/* ============================================================ */}
      <TickerTape />

      {/* ============================================================ */}
      {/*  FUND STRATEGY — Allocation cards                            */}
      {/* ============================================================ */}
      <section id="strategy" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-40" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-36">
          <ScrollReveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="section-gold-accent inline-block text-left mx-auto">
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-gold">
                  Fund Strategy
                </span>
                <h2 className="mt-3 h2-responsive font-bold tracking-tight">
                  Disciplined, Multi-Asset Allocation
                </h2>
              </div>
              <p className="body-responsive mt-4 sm:mt-5 text-muted-foreground leading-relaxed">
                Actively managed across five strategic buckets, rebalanced by the Nightmare investment
                committee to capture asymmetric upside while preserving capital through market cycles.
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-10 sm:mt-16 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {strategyCards.map((card, i) => (
              <ScrollReveal key={card.asset} delay={i * 0.08}>
                <GlassCard
                  gold={card.weight >= 25}
                  hover
                  className="h-full p-5 sm:p-6 min-w-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]" style={{ boxShadow: `inset 0 0 12px ${card.color}15` }}>
                      <card.icon className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: card.color }} />
                    </div>
                    <span
                      className="font-metric text-2xl sm:text-3xl font-extrabold break-words-mobile"
                      style={{ color: card.color }}
                    >
                      {card.weight}%
                    </span>
                  </div>
                  <div className="mt-4 min-w-0">
                    <h3 className="text-base font-semibold text-foreground">{card.asset}</h3>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground break-words-mobile">
                      {card.ticker}
                    </span>
                  </div>
                  <p className="body-responsive mt-3 leading-relaxed text-muted-foreground">
                    {card.note}
                  </p>
                  {/* Allocation bar */}
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${card.weight}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, delay: 0.3 + i * 0.08, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${card.color}cc, ${card.color}66)` }}
                    />
                  </div>
                </GlassCard>
              </ScrollReveal>
            ))}
          </div>

          {/* Fee structure */}
          <ScrollReveal delay={0.3}>
            <div className="mt-8 sm:mt-12 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
              {[
                "2% Management Fee",
                "20% Performance Fee (High-Water Mark)",
                "Monthly Liquidity Windows",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-gold" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  PERFORMANCE — NAV chart + metrics                           */}
      {/* ============================================================ */}
      <section id="performance" className="relative border-y border-border/60 bg-black/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-36">
          <ScrollReveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="section-gold-accent inline-block text-left mx-auto">
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-gold">
                  Track Record
                </span>
                <h2 className="mt-3 h2-responsive font-bold tracking-tight">
                  Consistent, Risk-Adjusted Returns
                </h2>
              </div>
              <p className="body-responsive mt-4 sm:mt-5 text-muted-foreground leading-relaxed">
                Net Asset Value trajectory since inception — net of all fees and expenses.
              </p>
            </div>
          </ScrollReveal>

          {/* NAV Area Chart */}
          <ScrollReveal delay={0.15}>
            <GlassCard className="mt-8 sm:mt-14 p-3 sm:p-6 lg:p-8 gold-border-sweep min-w-0">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground truncate">Net Asset Value</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">Since inception · NAV per share</p>
                </div>
                <Zap className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 text-gold" />
              </div>
              <div className="mt-4 sm:mt-6 h-56 sm:h-80 chart-mobile">
                <NavChart />
              </div>
            </GlassCard>
          </ScrollReveal>

          {/* Stat cards */}
          <ScrollReveal delay={0.25}>
            <div className="mt-6 sm:mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {[
                { label: "Annual Return", value: "+42.6%", accent: "text-profit" },
                { label: "Sharpe Ratio", value: "2.31", accent: "text-gold" },
                { label: "Max Drawdown", value: "-8.4%", accent: "text-loss" },
                { label: "CAGR", value: "+38.9%", accent: "text-profit" },
              ].map((m) => (
                <GlassCard key={m.label} gold className="stat-card-gold p-3 sm:p-5 text-center min-w-0">
                  <div className="text-[10px] font-medium uppercase tracking-[0.12em] sm:tracking-[0.16em] text-muted-foreground break-words-mobile">
                    {m.label}
                  </div>
                  <div className={`mt-2 font-metric text-xl sm:text-2xl font-bold ${m.accent} lg:text-3xl break-words-mobile`}>
                    {m.value}
                  </div>
                </GlassCard>
              ))}
            </div>
          </ScrollReveal>

          {/* Period returns */}
          <ScrollReveal delay={0.35}>
            <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
              {[
                { label: "Daily", value: "+0.84%" },
                { label: "Weekly", value: "+3.21%" },
                { label: "Monthly", value: "+8.47%" },
                { label: "YTD", value: "+31.2%" },
              ].map((r) => (
                <div key={r.label} className="rounded-lg border border-border/60 bg-white/[0.02] p-3 text-center min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</div>
                  <div className="mt-1 font-metric text-base sm:text-lg font-semibold text-profit break-words-mobile">{r.value}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SECURITY & COMPLIANCE — sequential reveal                   */}
      {/* ============================================================ */}
      <section id="security" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-36">
          <ScrollReveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="section-gold-accent inline-block text-left mx-auto">
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-gold">
                  Security & Compliance
                </span>
                <h2 className="mt-3 h2-responsive font-bold tracking-tight">
                  Institutional-Grade Protection
                </h2>
              </div>
              <p className="body-responsive mt-4 sm:mt-5 text-muted-foreground leading-relaxed">
                Every layer of the platform reflects institutional standards — from custody and
                compliance to encryption and auditability.
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-10 sm:mt-16 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {securityItems.map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 0.1}>
                <GlassCard hover className="h-full p-5 sm:p-6 min-w-0">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
                    <item.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <h3 className="mt-3 sm:mt-4 text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="body-responsive mt-2 leading-relaxed text-muted-foreground">{item.desc}</p>
                </GlassCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  TESTIMONIAL & TRUST                                         */}
      {/* ============================================================ */}
      <section className="relative border-y border-border/60 bg-black/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-36">
          <div className="grid gap-6 sm:gap-8 lg:grid-cols-2 lg:items-center">
            {/* Testimonial */}
            <ScrollReveal>
              <GlassCard gold glow className="relative overflow-hidden p-6 sm:p-8 lg:p-10 min-w-0">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
                <Quote className="h-8 w-8 sm:h-10 sm:w-10 text-gold/40" />
                <blockquote className="mt-3 sm:mt-4 text-base sm:text-lg lg:text-xl leading-relaxed text-foreground/90 break-words-mobile">
                  &ldquo;Nightmare Invest delivers the institutional rigor and confidentiality our
                  family office demands. The transparency of daily NAV reporting combined with
                  their disciplined risk management sets a new standard for digital-asset
                  fund administration.&rdquo;
                </blockquote>
                <div className="mt-5 sm:mt-6 flex items-center gap-3 sm:gap-4">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-black font-bold text-base sm:text-lg avatar-gold-ring">
                    M
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">Marcus Chen</div>
                    <div className="text-xs text-muted-foreground break-words-mobile">
                      Chief Investment Officer · Meridian Family Office, Geneva
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-[11px] text-muted-foreground/60">
                  AUM: $1.2B · Invested since 2023
                </div>
              </GlassCard>
            </ScrollReveal>

            {/* Trust badges + onboarding */}
            <ScrollReveal delay={0.15}>
              <div className="space-y-5 sm:space-y-6">
                <div className="section-gold-accent">
                  <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] sm:tracking-[0.2em] text-gold">
                    Trusted Infrastructure
                  </span>
                  <h3 className="mt-2 text-xl sm:text-2xl font-bold text-foreground break-words-mobile">
                    Built for Capital That Demands Certainty
                  </h3>
                </div>

                {/* Trust badges */}
                <div className="flex flex-wrap gap-2 sm:gap-4">
                  {trustBadges.map((b) => (
                    <div
                      key={b.label}
                      className="flex items-center gap-2 sm:gap-2.5 rounded-lg border border-gold/20 bg-gold/[0.04] px-3 py-2 sm:px-4 sm:py-3 transition-all hover:border-gold/40 hover:bg-gold/[0.08]"
                    >
                      <b.icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-gold" />
                      <span className="text-xs sm:text-sm font-medium text-foreground">{b.label}</span>
                    </div>
                  ))}
                </div>

                {/* Process steps */}
                <div className="space-y-3 sm:space-y-4">
                  {[
                    { step: "01", title: "Request Access", desc: "Submit credentials for accredited-investor verification." },
                    { step: "02", title: "Capital Commitment", desc: "Confirm allocation and execute subscription agreement." },
                    { step: "03", title: "Monitor Performance", desc: "Track NAV, holdings, and analytics in your private portal." },
                    { step: "04", title: "Liquidity Windows", desc: "Request deposits or withdrawals during scheduled windows." },
                  ].map((p, i) => (
                    <ScrollReveal key={p.step} delay={i * 0.1}>
                      <div className="flex items-start gap-3 sm:gap-4">
                        <span className="number-badge shrink-0">{p.step}</span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground">{p.title}</div>
                          <div className="text-xs text-muted-foreground break-words-mobile">{p.desc}</div>
                        </div>
                      </div>
                    </ScrollReveal>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FINAL CTA                                                   */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-dot-grid opacity-30" />
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.06] blur-[160px]" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-36">
          <ScrollReveal>
            <GlassCard gold glow className="relative overflow-hidden p-6 sm:p-12 lg:p-20 text-center gold-border-sweep hero-glow-pulse min-w-0">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
              <div className="relative">
                <h2 className="h2-responsive sm:text-4xl lg:text-5xl font-bold tracking-tight break-words-mobile">
                  Begin Your{" "}
                  <span className="text-gold-gradient text-glow-gold">Investment Journey</span>
                </h2>
                <p className="body-responsive mx-auto mt-4 sm:mt-6 max-w-xl text-muted-foreground leading-relaxed">
                  Capital allocation is selective. Submit your access request and our investor
                  relations team will respond within 48 hours.
                </p>
                <div className="mt-8 sm:mt-10 flex flex-col items-stretch sm:flex-row justify-center gap-3 sm:gap-4">
                  <motion.div
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    className="w-full sm:w-auto"
                  >
                    <Button
                      size="lg"
                      onClick={() => setRoute({ name: "signup" })}
                      className="group h-12 sm:h-14 rounded-lg bg-gold-gradient px-6 sm:px-10 text-sm sm:text-base font-bold text-black shadow-[0_0_32px_rgba(212,175,55,0.25)] hover:shadow-[0_0_48px_rgba(212,175,55,0.4)] transition-shadow cta-gold-sweep w-full tap-target"
                    >
                      Begin Access Request
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1.5" />
                    </Button>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    className="w-full sm:w-auto"
                  >
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => setRoute({ name: "legal", doc: "risk" })}
                      className="h-12 sm:h-14 rounded-lg border-gold/30 px-6 sm:px-8 text-sm sm:text-base text-foreground hover:bg-gold/10 transition-all w-full tap-target"
                    >
                      Risk Disclosure
                    </Button>
                  </motion.div>
                </div>
                <p className="mt-5 sm:mt-6 text-xs text-muted-foreground">
                  For accredited investors only. Minimum investment $50,000.
                </p>
              </div>
            </GlassCard>
          </ScrollReveal>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  PREMIUM FOOTER                                              */}
      {/* ============================================================ */}
      <footer className="mt-auto bg-black/40 safe-area-bottom">
        {/* Gold gradient separator */}
        <div className="footer-gold-separator" />

        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
          <div className="grid gap-8 sm:gap-10 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
            <div className="sm:col-span-2 md:col-span-2">
              <Logo />
              <p className="mt-4 sm:mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground break-words-mobile">
                Nightmare Invest is a private institutional crypto hedge fund portal for accredited
                investors. This is not a retail product.
              </p>
              <p className="mt-3 sm:mt-4 text-xs text-muted-foreground/50 tracking-wide">
                Built with institutional-grade infrastructure
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Legal</div>
              <ul className="mt-4 space-y-3 text-sm">
                <li><button onClick={() => setRoute({ name: "legal", doc: "tos" })} className="text-muted-foreground footer-link-gold tap-target-sm inline-block">Terms of Service</button></li>
                <li><button onClick={() => setRoute({ name: "legal", doc: "privacy" })} className="text-muted-foreground footer-link-gold tap-target-sm inline-block">Privacy Policy</button></li>
                <li><button onClick={() => setRoute({ name: "legal", doc: "cookies" })} className="text-muted-foreground footer-link-gold tap-target-sm inline-block">Cookie Policy</button></li>
                <li><button onClick={() => setRoute({ name: "legal", doc: "risk" })} className="text-muted-foreground footer-link-gold tap-target-sm inline-block">Risk Disclosure</button></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Investor Relations</div>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li className="footer-link-gold break-words-mobile">ir@nightmare.invest</li>
                <li className="break-words-mobile">Zug · Geneva · Singapore</li>
                <li className="pt-2"><button onClick={() => setRoute({ name: "login" })} className="text-gold hover:underline transition-colors tap-target-sm inline-block">Investor Login →</button></li>
              </ul>
            </div>
          </div>

          {/* Gold divider before bottom bar */}
          <div className="footer-gold-separator mt-10 sm:mt-12" />

          <div className="mt-6 sm:mt-8 flex flex-col items-start justify-between gap-3 sm:gap-4 pt-2 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} Nightmare Invest. All rights reserved.</span>
            <span className="max-w-md sm:text-right break-words-mobile">This platform is intended for accredited investors. Digital assets are subject to high volatility and risk of loss.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  NAV CHART (Recharts)                                              */
/* ------------------------------------------------------------------ */

function NavChart() {
  const { data: fundData } = useQuery<{
    fund: { id: string } | null;
    metrics: Record<string, number>;
  }>({
    queryKey: ["fund"],
    queryFn: () => api.get("/api/fund"),
    staleTime: 60000,
  });

  const { data: navHistory } = useQuery<{ date: string; nav: number; aum: number }[]>({
    queryKey: ["nav-history", fundData?.fund?.id],
    queryFn: () => api.get(`/api/fund/nav-history?fundId=${fundData!.fund!.id}&range=ALL`),
    enabled: !!fundData?.fund?.id,
    staleTime: 60000,
  });

  // Generate fallback deterministic data if no real data
  const chartData = navHistory && navHistory.length > 0
    ? navHistory.map((p) => ({
        date: new Date(p.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        NAV: p.nav,
      }))
    : generateFallbackNav();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.35} />
            <stop offset="50%" stopColor="#D4AF37" stopOpacity={0.1} />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "rgba(255,255,255,0.35)" }}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: "rgba(255,255,255,0.35)" }}
          tickFormatter={(v: number) => `$${fmtNum(v, 0)}`}
          domain={["dataMin * 0.95", "dataMax * 1.02"]}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "rgba(20, 20, 22, 0.9)",
            border: "1px solid rgba(212, 175, 55, 0.3)",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#f5f5f4",
            backdropFilter: "blur(12px)",
          }}
          labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: "11px" }}
          formatter={(value: number) => [fmtUSD(value, { decimals: 2 }), "NAV"]}
        />
        <Area
          type="monotone"
          dataKey="NAV"
          stroke="#D4AF37"
          strokeWidth={2}
          fill="url(#navGradient)"
          dot={false}
          activeDot={{ r: 4, fill: "#FFD700", stroke: "#D4AF37", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function generateFallbackNav() {
  const data: { date: string; NAV: number }[] = [];
  let nav = 100;
  const months = [
    "Jan 23","Feb 23","Mar 23","Apr 23","May 23","Jun 23",
    "Jul 23","Aug 23","Sep 23","Oct 23","Nov 23","Dec 23",
    "Jan 24","Feb 24","Mar 24","Apr 24","May 24","Jun 24",
    "Jul 24","Aug 24","Sep 24","Oct 24","Nov 24","Dec 24",
    "Jan 25","Feb 25","Mar 25","Apr 25","May 25","Jun 25",
  ];
  // Use a seeded pseudo-random for deterministic output
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  };
  for (const m of months) {
    nav += (rand() * 8 - 1.5);
    nav = Math.max(nav, 85);
    data.push({ date: m, NAV: Math.round(nav * 100) / 100 });
  }
  return data;
}

/* ------------------------------------------------------------------ */
/*  TICKER TAPE (live crypto prices)                                   */
/* ------------------------------------------------------------------ */

interface TickerPrice {
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
}

function TickerTape() {
  const { data } = useQuery<{ prices: TickerPrice[]; updatedAt: string }>({
    queryKey: ["market-prices"],
    queryFn: () => api.get("/api/market/prices"),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const prices = data?.prices ?? [];

  const renderItem = (p: TickerPrice, key: string) => (
    <div key={key} className="flex items-center gap-2.5 px-5 text-[12px] font-medium">
      <span className="font-semibold uppercase tracking-wide text-gold">{p.symbol}</span>
      <span className="font-metric text-foreground/90">
        {fmtUSD(p.priceUsd, { decimals: p.priceUsd > 1000 ? 0 : 2 })}
      </span>
      <span className={`font-metric ${p.change24h >= 0 ? "text-profit" : "text-loss"}`}>
        {p.change24h >= 0 ? "▲" : "▼"} {fmtPct(Math.abs(p.change24h))}
      </span>
      <span className="ml-4 text-gold/20">│</span>
    </div>
  );

  // Loading fallback
  if (prices.length === 0) {
    return (
      <div className="flex h-9 items-center overflow-hidden border-y border-gold/15 bg-black/95 backdrop-blur-sm">
        <div className="flex h-full shrink-0 items-center gap-1.5 border-r border-gold/15 bg-black px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
          Live
        </div>
        <div className="flex-1 px-4 text-[12px] text-muted-foreground">
          Loading live market prices…
        </div>
      </div>
    );
  }

  return (
    <div className="ticker-tape-container flex h-9 items-center overflow-hidden border-y border-gold/15 bg-black/95 backdrop-blur-sm">
      <div className="flex h-full shrink-0 items-center gap-1.5 border-r border-gold/15 bg-black px-4 text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
        Live
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div className="ticker-tape-track">
          {prices.map((p) => renderItem(p, `a-${p.symbol}`))}
          <div aria-hidden="true" className="inline-flex">
            {prices.map((p) => renderItem(p, `b-${p.symbol}`))}
          </div>
        </div>
      </div>
    </div>
  );
}
