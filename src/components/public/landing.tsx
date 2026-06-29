"use client";
import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { GlassCard, MetricTile } from "@/components/brand/primitives";
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  TrendingUp,
  Globe,
  PieChart,
  Layers,
  Zap,
  LineChart,
  CheckCircle2,
  Quote,
  Building2,
} from "lucide-react";
import { fmtUSD } from "@/lib/format";

const navItems = [
  { label: "Fund", href: "fund" },
  { label: "Strategy", href: "strategy" },
  { label: "Performance", href: "performance" },
  { label: "Security", href: "security" },
];

const stats = [
  { label: "Assets Under Management", value: "$284.6M", sub: "As of latest NAV" },
  { label: "Since Inception", value: "+147.2%", sub: "Net of fees" },
  { label: "Accredited Investors", value: "412", sub: "Across 23 jurisdictions" },
  { label: "Sharpe Ratio", value: "2.31", sub: "Risk-adjusted" },
];

const allocation = [
  { asset: "Bitcoin", weight: 40, color: "#F7931A" },
  { asset: "Ethereum", weight: 25, color: "#627EEA" },
  { asset: "Solana", weight: 15, color: "#14F195" },
  { asset: "Stablecoin Yield", weight: 10, color: "#4A90E2" },
  { asset: "High Conviction Altcoins", weight: 10, color: "#D4AF37" },
];

const benefits = [
  {
    icon: ShieldCheck,
    title: "Institutional Custody",
    desc: "Multi-signature cold storage with qualified custodians. SOC 2 Type II audited infrastructure.",
  },
  {
    icon: TrendingUp,
    title: "Asymmetric Alpha",
    desc: "Disciplined long-volatility positioning across the highest-conviction digital assets.",
  },
  {
    icon: Lock,
    title: "Confidential Access",
    desc: "Private, invitation-eligible capital pool. No retail. No exchange counterparty risk.",
  },
  {
    icon: LineChart,
    title: "Transparent Reporting",
    desc: "Daily NAV, institutional-grade analytics, and downloadable statements on demand.",
  },
  {
    icon: PieChart,
    title: "Managed Allocation",
    desc: "Expert portfolio construction rebalanced by the Nightmare investment committee.",
  },
  {
    icon: Globe,
    title: "Global Compliance",
    desc: "Engineered for accredited investors across compliant jurisdictions worldwide.",
  },
];

const process = [
  { step: "01", title: "Request Access", desc: "Submit credentials for accredited-investor verification." },
  { step: "02", title: "Capital Commitment", desc: "Confirm allocation and execute subscription agreement." },
  { step: "03", title: "Monitor Performance", desc: "Track NAV, holdings, and analytics in your private portal." },
  { step: "04", title: "Liquidity Windows", desc: "Request deposits or withdrawals during scheduled windows." },
];

export function Landing() {
  const setRoute = useApp((s) => s.setRoute);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 glass-strong">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 md:flex">
            {navItems.map((n) => (
              <button
                key={n.label}
                onClick={() => scrollTo(n.href)}
                className="text-sm text-foreground/70 transition-colors hover:text-foreground"
              >
                {n.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setRoute({ name: "login" })}
              className="text-foreground/70 hover:text-foreground"
            >
              Investor Login
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

      {/* Hero */}
      <section className="relative overflow-hidden">
        <HeroCanvas />
        <div className="absolute inset-0 bg-grid bg-grid-fade opacity-60" />
        <div className="absolute -top-40 left-1/2 h-96 w-[800px] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mx-auto max-w-4xl text-center"
          >
            <div className="shimmer-badge mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs font-medium text-gold">
              <span className="h-1.5 w-1.5 animate-pulse-gold rounded-full bg-gold" />
              Nightmare Alpha Crypto Fund · Now Accepting Allocations
            </div>
            <h1 className="glow-underline text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Private Access to{" "}
              <span className="font-extrabold text-gold-gradient text-glow-gold">Institutional</span>{" "}
              Crypto Alpha
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-pretty text-base text-foreground/60 sm:text-lg">
              An elite hedge fund portal engineered for accredited investors. Allocate capital
              into a disciplined digital-asset strategy, monitor institutional-grade analytics,
              and access your portfolio with the confidentiality of a private bank.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => setRoute({ name: "signup" })}
                className="group w-full bg-gold-gradient text-black hover:opacity-90 sm:w-auto"
              >
                Request Investor Access
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setRoute({ name: "login" })}
                className="w-full border-gold/30 text-gold hover:bg-gold/10 sm:w-auto"
              >
                Investor Login
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Minimum commitment $50,000 · Accredited investors only
            </p>
            {/* Trust indicators */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-foreground/40">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" />
                <span>256-bit Encryption</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>SOC 2 Audited</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                <span>Qualified Custody</span>
              </div>
            </div>
          </motion.div>

          {/* Hero stats */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-16 grid grid-cols-2 gap-4 lg:grid-cols-4"
          >
            {stats.map((s) => (
              <GlassCard key={s.label} gold className="stat-card-gold p-5 text-center">
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {s.label}
                </div>
                <div className="mt-2 font-metric text-2xl font-bold text-gold-gradient sm:text-3xl">
                  {s.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>
              </GlassCard>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Fund overview */}
      <section id="fund" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              The Flagship Vehicle
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Nightmare Alpha Crypto Fund
            </h2>
            <p className="mt-5 text-pretty text-muted-foreground">
              A single, institutionally-managed vehicle providing diversified exposure to the
              digital-asset class. Allocations are actively rebalanced by the Nightmare investment
              committee across Bitcoin, Ethereum, Solana, stablecoin yield strategies, and
              high-conviction altcoins — with the discretion of a private bank and the rigor of a
              hedge fund.
            </p>
            <div className="mt-8 space-y-3">
              {[
                "2% management fee · 20% performance fee (high-water mark)",
                "Daily NAV publication with full transparency",
                "Scheduled monthly liquidity windows",
                "Qualified custody with multi-signature cold storage",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                  <span className="text-sm text-foreground/90">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Allocation donut */}
          <GlassCard gold className="p-8">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Target Allocation
              </h3>
              <Layers className="h-5 w-5 text-gold" />
            </div>
            <div className="mt-6 flex flex-col items-center gap-8 sm:flex-row sm:items-center">
              <div className="relative h-44 w-44 shrink-0">
                <AllocationDonut />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">5 Assets</span>
                  <span className="font-metric text-xl font-bold text-foreground">100%</span>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {allocation.map((a) => (
                  <div key={a.asset} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
                      <span className="text-sm text-foreground/90">{a.asset}</span>
                    </div>
                    <span className="font-metric text-sm font-semibold text-foreground">{a.weight}%</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* Strategy / benefits */}
      <section id="strategy" className="border-y border-border/60 bg-black/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Institutional by Design
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Engineered for Capital That Demands More
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every layer of the platform reflects institutional standards — from custody and
              compliance to analytics and reporting.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
              >
                <GlassCard hover className="h-full p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gold/10 text-gold">
                    <b.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Performance strip */}
      <section id="performance" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <GlassCard className="h-full p-8">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                    Fund Performance
                  </span>
                  <h3 className="mt-2 text-2xl font-bold">Net Asset Value Trajectory</h3>
                </div>
                <Zap className="h-6 w-6 text-gold" />
              </div>
              <Sparkline />
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: "Daily", value: "+0.84%" },
                  { label: "Weekly", value: "+3.21%" },
                  { label: "Monthly", value: "+8.47%" },
                  { label: "Annual", value: "+42.6%" },
                ].map((r) => (
                  <div key={r.label} className="rounded-lg border border-border/60 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.label}</div>
                    <div className="mt-1 font-metric text-lg font-semibold text-profit">{r.value}</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
          <div className="space-y-4">
            <GlassCard gold className="p-6">
              <Quote className="h-6 w-6 text-gold/60" />
              <p className="mt-3 text-sm leading-relaxed text-foreground/90">
                “The institutional gateway to digital-asset alpha. Nightmare Invest delivers the
                confidentiality and rigor our family office demands.”
              </p>
              <div className="mt-4 text-xs text-muted-foreground">
                — Private Wealth Office, Geneva
              </div>
            </GlassCard>
            <GlassCard className="p-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-gold" />
                <div>
                  <div className="text-sm font-semibold">SOC 2 Type II</div>
                  <div className="text-xs text-muted-foreground">Audited infrastructure</div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="security" className="border-y border-border/60 bg-black/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Onboarding</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">A Disciplined Path to Allocation</h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {process.map((p) => (
              <GlassCard key={p.step} className="p-6">
                <div className="font-metric text-3xl font-bold text-gold-gradient">{p.step}</div>
                <h3 className="mt-3 text-base font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.desc}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <GlassCard gold glow className="relative overflow-hidden p-10 text-center sm:p-16">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Request Your Seat at the Table
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Capital allocation is selective. Submit your access request and our investor relations
              team will respond within 48 hours.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => setRoute({ name: "signup" })}
                className="w-full bg-gold-gradient text-black hover:opacity-90 sm:w-auto"
              >
                Begin Access Request
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setRoute({ name: "legal", doc: "risk" })}
                className="w-full border-gold/30 text-foreground hover:bg-gold/10 sm:w-auto"
              >
                Risk Disclosure
              </Button>
            </div>
          </div>
        </GlassCard>
      </section>

      {/* Footer */}
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
                <li><button onClick={() => setRoute({ name: "legal", doc: "tos" })} className="text-muted-foreground hover:text-foreground">Terms of Service</button></li>
                <li><button onClick={() => setRoute({ name: "legal", doc: "privacy" })} className="text-muted-foreground hover:text-foreground">Privacy Policy</button></li>
                <li><button onClick={() => setRoute({ name: "legal", doc: "cookies" })} className="text-muted-foreground hover:text-foreground">Cookie Policy</button></li>
                <li><button onClick={() => setRoute({ name: "legal", doc: "risk" })} className="text-muted-foreground hover:text-foreground">Risk Disclosure</button></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Investor Relations</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>ir@nightmare.invest</li>
                <li>Zug · Geneva · Singapore</li>
                <li className="pt-2"><button onClick={() => setRoute({ name: "login" })} className="text-gold hover:underline">Investor Login →</button></li>
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

function AllocationDonut() {
  const r = 70;
  const c = 2 * Math.PI * r;
  // precompute cumulative offsets purely with reduce (no mutation after render)
  const segments = allocation.reduce<
    { asset: string; color: string; dash: number; offset: number }[]
  >((acc, a) => {
    const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
    acc.push({ asset: a.asset, color: a.color, dash: (a.weight / 100) * c, offset });
    return acc;
  }, []);
  return (
    <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
      <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="18" />
      {segments.map((s) => (
        <circle
          key={s.asset}
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth="18"
          strokeDasharray={`${s.dash} ${c - s.dash}`}
          strokeDashoffset={-s.offset}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}

function Sparkline() {
  // deterministic upward-ish curve
  const pts: [number, number][] = [];
  let v = 40;
  for (let i = 0; i < 40; i++) {
    v += (Math.sin(i / 3) * 2) + 1.4 + Math.random() * 0.6;
    pts.push([i, v]);
  }
  const w = 600;
  const h = 160;
  const max = Math.max(...pts.map((p) => p[1]));
  const min = Math.min(...pts.map((p) => p[1]));
  const norm = (x: number) => (x - min) / (max - min);
  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(p[0] / 39) * w} ${h - norm(p[1]) * h}`)
    .join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-border/60 bg-black/20 p-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spark)" />
        <path d={path} fill="none" stroke="#D4AF37" strokeWidth="2" />
      </svg>
    </div>
  );
}

function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Respect reduced-motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const PARTICLE_COUNT = 55;
    const CONNECTION_DISTANCE = 140;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      o: number;
    }

    const particles: Particle[] = [];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const w = () => canvas.getBoundingClientRect().width;
    const h = () => canvas.getBoundingClientRect().height;

    // Initialize particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * w(),
        y: Math.random() * h(),
        vx: (Math.random() - 0.5) * 0.25,
        vy: -(Math.random() * 0.25 + 0.08), // slowly floating upward
        r: Math.random() * 1.5 + 0.5,
        o: Math.random() * 0.3 + 0.1, // opacity 0.1–0.4
      });
    }

    const animate = () => {
      const cw = w();
      const ch = h();
      ctx.clearRect(0, 0, cw, ch);

      // Update & draw particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.y < -10) p.y = ch + 10;
        if (p.x < -10) p.x = cw + 10;
        if (p.x > cw + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212, 175, 55, ${p.o})`;
        ctx.fill();
      }

      // Draw connecting lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DISTANCE) {
            const alpha = 0.05 + (1 - dist / CONNECTION_DISTANCE) * 0.05;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(212, 175, 55, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 h-full w-full" />;
}
