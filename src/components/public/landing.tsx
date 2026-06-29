"use client";
import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
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
  LineChart,
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
  { label: "Assets Under Management", value: "$284.6M", sub: "As of latest NAV" },
  { label: "Since Inception Return", value: "+147.2%", sub: "Net of fees" },
  { label: "Sharpe Ratio", value: "2.31", sub: "Risk-adjusted" },
  { label: "Accredited Investors", value: "412", sub: "Across 23 jurisdictions" },
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

/* ------------------------------------------------------------------ */
/*  Main Landing Component                                             */
/* ------------------------------------------------------------------ */

export function Landing() {
  const setRoute = useApp((s) => s.setRoute);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* ---- Sticky nav ---- */}
      <header className="fixed top-0 left-0 right-0 z-50 topbar-glow-line glass-strong">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            {[
              { label: "Strategy", href: "strategy" },
              { label: "Performance", href: "performance" },
              { label: "Security", href: "security" },
            ].map((n) => (
              <button
                key={n.label}
                onClick={() => scrollTo(n.href)}
                className="text-sm text-foreground/60 transition-colors hover:text-gold"
              >
                {n.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setRoute({ name: "login" })}
              className="text-foreground/60 hover:text-foreground"
            >
              Login
            </Button>
            <Button
              onClick={() => setRoute({ name: "signup" })}
              className="bg-gold-gradient text-black hover:opacity-90 font-semibold"
            >
              Request Access
            </Button>
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/*  HERO — Full viewport                                        */}
      {/* ============================================================ */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
        {/* Gold particle dot grid background */}
        <div className="hero-dot-grid absolute inset-0 z-0" />
        {/* Gold scanning line */}
        <div className="hero-scan-line absolute inset-x-0 z-[1] h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
        {/* Radial gold glow */}
        <div className="absolute -top-40 left-1/2 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-gold/[0.07] blur-[160px]" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0a0a0b] to-transparent z-[2]" />

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-5xl px-4 pt-20 text-center sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Badge */}
            <div className="shimmer-badge mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/[0.06] px-5 py-2 text-xs font-medium text-gold">
              <span className="h-1.5 w-1.5 animate-pulse-gold rounded-full bg-gold" />
              Nightmare Alpha Crypto Fund · Now Accepting Allocations
            </div>

            {/* Headline */}
            <h1 className="text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              <span className="text-gold-gradient text-glow-gold">NIGHTMARE ALPHA</span>
              <br />
              <span className="text-foreground">CRYPTO FUND</span>
            </h1>

            {/* Subheadline */}
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-foreground/55 sm:text-xl">
              Institutional-Grade Digital Asset Management for Accredited Investors
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                onClick={() => setRoute({ name: "signup" })}
                className="group h-13 rounded-lg bg-gold-gradient px-8 text-base font-bold text-black shadow-[0_0_32px_rgba(212,175,55,0.25)] hover:shadow-[0_0_48px_rgba(212,175,55,0.35)] hover:opacity-90 transition-all"
              >
                Request Access
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollTo("strategy")}
                className="h-13 rounded-lg border-gold/30 px-8 text-base text-gold hover:bg-gold/10"
              >
                Learn More
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              For accredited investors only · Minimum commitment $50,000
            </p>
          </motion.div>

          {/* Hero stats row */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-16 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
          >
            {heroStats.map((s) => (
              <GlassCard key={s.label} gold className="stat-card-gold p-4 text-center sm:p-5">
                <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:text-[11px]">
                  {s.label}
                </div>
                <div className="mt-2 font-metric text-xl font-bold text-gold-gradient sm:text-2xl lg:text-3xl">
                  {s.value}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{s.sub}</div>
              </GlassCard>
            ))}
          </motion.div>
        </div>
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
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Fund Strategy
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Disciplined, Multi-Asset Allocation
              </h2>
              <p className="mt-4 text-muted-foreground">
                Actively managed across five strategic buckets, rebalanced by the Nightmare investment
                committee to capture asymmetric upside while preserving capital through market cycles.
              </p>
            </div>
          </FadeIn>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {strategyCards.map((card, i) => (
              <motion.div
                key={card.asset}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
              >
                <GlassCard
                  gold={card.weight >= 25}
                  hover
                  className="h-full p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]" style={{ boxShadow: `inset 0 0 12px ${card.color}15` }}>
                      <card.icon className="h-6 w-6" style={{ color: card.color }} />
                    </div>
                    <span
                      className="font-metric text-3xl font-extrabold"
                      style={{ color: card.color }}
                    >
                      {card.weight}%
                    </span>
                  </div>
                  <div className="mt-4">
                    <h3 className="text-base font-semibold text-foreground">{card.asset}</h3>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {card.ticker}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {card.note}
                  </p>
                  {/* Allocation bar */}
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${card.weight}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.2 + i * 0.06, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${card.color}cc, ${card.color}66)` }}
                    />
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>

          {/* Fee structure */}
          <FadeIn delay={0.3}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              {[
                "2% Management Fee",
                "20% Performance Fee (High-Water Mark)",
                "Monthly Liquidity Windows",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-gold" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  PERFORMANCE — NAV chart + metrics                           */}
      {/* ============================================================ */}
      <section id="performance" className="relative border-y border-border/60 bg-black/30">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Track Record
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Consistent, Risk-Adjusted Returns
              </h2>
              <p className="mt-4 text-muted-foreground">
                Net Asset Value trajectory since inception — net of all fees and expenses.
              </p>
            </div>
          </FadeIn>

          {/* NAV Area Chart */}
          <FadeIn delay={0.15}>
            <GlassCard className="mt-12 p-4 sm:p-6 lg:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Net Asset Value</h3>
                  <p className="text-sm text-muted-foreground">Since inception · NAV per share</p>
                </div>
                <Zap className="h-6 w-6 text-gold" />
              </div>
              <div className="mt-6 h-72 sm:h-80">
                <NavChart />
              </div>
            </GlassCard>
          </FadeIn>

          {/* Stat cards */}
          <FadeIn delay={0.25}>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: "Annual Return", value: "+42.6%", accent: "text-profit" },
                { label: "Sharpe Ratio", value: "2.31", accent: "text-gold" },
                { label: "Max Drawdown", value: "-8.4%", accent: "text-loss" },
                { label: "CAGR", value: "+38.9%", accent: "text-profit" },
              ].map((m) => (
                <GlassCard key={m.label} gold className="stat-card-gold p-5 text-center">
                  <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {m.label}
                  </div>
                  <div className={`mt-2 font-metric text-2xl font-bold ${m.accent} sm:text-3xl`}>
                    {m.value}
                  </div>
                </GlassCard>
              ))}
            </div>
          </FadeIn>

          {/* Period returns */}
          <FadeIn delay={0.35}>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Daily", value: "+0.84%" },
                { label: "Weekly", value: "+3.21%" },
                { label: "Monthly", value: "+8.47%" },
                { label: "YTD", value: "+31.2%" },
              ].map((r) => (
                <div key={r.label} className="rounded-lg border border-border/60 bg-white/[0.02] p-3 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</div>
                  <div className="mt-1 font-metric text-lg font-semibold text-profit">{r.value}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  SECURITY & COMPLIANCE                                       */}
      {/* ============================================================ */}
      <section id="security" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <FadeIn>
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Security & Compliance
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Institutional-Grade Protection
              </h2>
              <p className="mt-4 text-muted-foreground">
                Every layer of the platform reflects institutional standards — from custody and
                compliance to encryption and auditability.
              </p>
            </div>
          </FadeIn>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {securityItems.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
              >
                <GlassCard hover className="h-full p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/10 text-gold">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  TESTIMONIAL & TRUST                                         */}
      {/* ============================================================ */}
      <section className="relative border-y border-border/60 bg-black/30">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            {/* Testimonial */}
            <FadeIn>
              <GlassCard gold glow className="relative overflow-hidden p-8 sm:p-10">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
                <Quote className="h-10 w-10 text-gold/40" />
                <blockquote className="mt-4 text-lg leading-relaxed text-foreground/90 sm:text-xl">
                  &ldquo;Nightmare Invest delivers the institutional rigor and confidentiality our
                  family office demands. The transparency of daily NAV reporting combined with
                  their disciplined risk management sets a new standard for digital-asset
                  fund administration.&rdquo;
                </blockquote>
                <div className="mt-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-gradient text-black font-bold text-lg">
                    M
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Marcus Chen</div>
                    <div className="text-xs text-muted-foreground">
                      Chief Investment Officer · Meridian Family Office, Geneva
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-[11px] text-muted-foreground/60">
                  AUM: $1.2B · Invested since 2023
                </div>
              </GlassCard>
            </FadeIn>

            {/* Trust badges + onboarding */}
            <FadeIn delay={0.15}>
              <div className="space-y-6">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                    Trusted Infrastructure
                  </span>
                  <h3 className="mt-2 text-2xl font-bold text-foreground">
                    Built for Capital That Demands Certainty
                  </h3>
                </div>

                {/* Trust badges */}
                <div className="flex flex-wrap gap-4">
                  {trustBadges.map((b) => (
                    <div
                      key={b.label}
                      className="flex items-center gap-2.5 rounded-lg border border-gold/20 bg-gold/[0.04] px-4 py-3"
                    >
                      <b.icon className="h-5 w-5 text-gold" />
                      <span className="text-sm font-medium text-foreground">{b.label}</span>
                    </div>
                  ))}
                </div>

                {/* Process steps */}
                <div className="space-y-3">
                  {[
                    { step: "01", title: "Request Access", desc: "Submit credentials for accredited-investor verification." },
                    { step: "02", title: "Capital Commitment", desc: "Confirm allocation and execute subscription agreement." },
                    { step: "03", title: "Monitor Performance", desc: "Track NAV, holdings, and analytics in your private portal." },
                    { step: "04", title: "Liquidity Windows", desc: "Request deposits or withdrawals during scheduled windows." },
                  ].map((p) => (
                    <div key={p.step} className="flex items-start gap-4">
                      <span className="font-metric text-lg font-bold text-gold-gradient">{p.step}</span>
                      <div>
                        <div className="text-sm font-semibold text-foreground">{p.title}</div>
                        <div className="text-xs text-muted-foreground">{p.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FINAL CTA                                                   */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 hero-dot-grid opacity-30" />
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[0.06] blur-[160px]" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <FadeIn>
            <GlassCard gold glow className="relative overflow-hidden p-10 text-center sm:p-16 lg:p-20">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
              <div className="relative">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                  Begin Your{" "}
                  <span className="text-gold-gradient text-glow-gold">Investment Journey</span>
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                  Capital allocation is selective. Submit your access request and our investor
                  relations team will respond within 48 hours.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <Button
                    size="lg"
                    onClick={() => setRoute({ name: "signup" })}
                    className="group h-14 rounded-lg bg-gold-gradient px-10 text-base font-bold text-black shadow-[0_0_32px_rgba(212,175,55,0.25)] hover:shadow-[0_0_48px_rgba(212,175,55,0.4)] hover:opacity-90 transition-all"
                  >
                    Begin Access Request
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setRoute({ name: "legal", doc: "risk" })}
                    className="h-14 rounded-lg border-gold/30 px-8 text-base text-foreground hover:bg-gold/10"
                  >
                    Risk Disclosure
                  </Button>
                </div>
                <p className="mt-6 text-xs text-muted-foreground">
                  For accredited investors only. Minimum investment $50,000.
                </p>
              </div>
            </GlassCard>
          </FadeIn>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER                                                      */}
      {/* ============================================================ */}
      <footer className="mt-auto border-t border-border/60 bg-black/40">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="md:col-span-2">
              <Logo />
              <p className="mt-4 max-w-sm text-sm text-muted-foreground">
                Nightmare Invest is a private institutional crypto hedge fund portal for accredited
                investors. This is not a retail product.
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Legal</div>
              <ul className="mt-3 space-y-2 text-sm">
                <li><button onClick={() => setRoute({ name: "legal", doc: "tos" })} className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</button></li>
                <li><button onClick={() => setRoute({ name: "legal", doc: "privacy" })} className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</button></li>
                <li><button onClick={() => setRoute({ name: "legal", doc: "cookies" })} className="text-muted-foreground hover:text-foreground transition-colors">Cookie Policy</button></li>
                <li><button onClick={() => setRoute({ name: "legal", doc: "risk" })} className="text-muted-foreground hover:text-foreground transition-colors">Risk Disclosure</button></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Investor Relations</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>ir@nightmare.invest</li>
                <li>Zug · Geneva · Singapore</li>
                <li className="pt-2"><button onClick={() => setRoute({ name: "login" })} className="text-gold hover:underline transition-colors">Investor Login →</button></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} Nightmare Invest. All rights reserved.</span>
            <span>This platform is intended for accredited investors. Digital assets are subject to high volatility and risk of loss.</span>
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
