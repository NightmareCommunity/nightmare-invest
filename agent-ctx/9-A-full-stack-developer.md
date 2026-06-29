# Task 9-A: Premium Landing Page Overhaul

## Agent: full-stack-developer
## Status: ✅ Complete

## Summary
Major visual and animation overhaul of the landing page to transform it from a 7/10 to a 9+/10 premium institutional experience. All changes were frontend-only (no backend/API modifications).

## Changes Made

### 1. New CSS Utilities (`src/app/globals.css`)
Added ~150 lines of new CSS utilities in the "ROUND 9-A" section:

- **`.gold-border-sweep`** — Animated gold gradient border that sweeps around elements (used on performance chart card and final CTA card)
- **`.text-gold-shimmer`** — Text with animated gold shimmer effect (used on hero headline "NIGHTMARE ALPHA")
- **`.press-logo-marquee`** — Infinite horizontal scroll for press logos (replaces static flex layout)
- **`.hero-particle-canvas`** — Styling for particle canvas overlay
- **`.hero-glow-pulse`** — Pulsing gold border glow for hero CTA container
- **`.cta-gold-sweep`** — Gold gradient sweep animation on CTA buttons
- **`.section-gold-accent`** — Gold left border accent on section titles
- **`.footer-gold-separator`** — Gold gradient line separator for footer
- **`.footer-link-gold`** — Legal link hover gold effect with animated underline
- **`.backed-by-logo`** — Styling for "Backed by" institutional logo containers
- **`.press-logo-item`** — Press logo with animated gold underline sweep
- All new animations respect `prefers-reduced-motion`

### 2. Landing Page Overhaul (`src/components/public/landing.tsx`)
Complete rewrite (~650 lines) with these enhancements:

#### Animated Particle Background (NEW)
- **`ParticleCanvas`** component — Canvas-based gold particle effect with:
  - 70 particles with varying size (0.5-2px radius) and opacity
  - Gentle floating motion (0.3px/frame velocity)
  - Pulsing opacity animation per particle
  - Connecting lines between nearby particles (constellation effect, 140px threshold)
  - Line opacity fades with distance
  - Responsive resize handling with DPR support
  - Replaces the static `hero-dot-grid` div

#### Animated Counter (NEW)
- **`AnimatedCounter`** component — Counts up from 0 to target value when scrolled into view
- Uses cubic ease-out animation over 2 seconds
- Applied to all 4 hero stats ($284.6M, +147.2%, 2.31, 412)
- Each counter uses `useInView` with `once: true` for single-trigger

#### Scroll-Triggered Animations (NEW)
- **`ScrollReveal`** wrapper component — Fade in + slide up (40px) when entering viewport
- Uses `useInView` with `-80px` margin for early trigger
- Applied to every section: strategy, performance, security, testimonial, final CTA
- Strategy cards: stagger animation with 0.08s delay between cards
- Security items: sequential reveal with 0.1s delay between items
- Process steps: stagger reveal with 0.1s delay

#### Enhanced Hero Section
- Headline now uses `.text-gold-shimmer` (animated gold shimmer on "NIGHTMARE ALPHA")
- Subheadline: increased to `text-xl`/`text-2xl` with `leading-relaxed` for better readability
- CTA buttons: wrapped in `motion.div` with `whileHover` (scale 1.04) and `whileTap` (scale 0.97) spring animations
- Added `.cta-gold-sweep` (gold gradient sweep) on primary CTA buttons
- Increased CTA height to `h-14` for better touch targets
- Added "Backed by leading institutions" row with 6 institutional logos (Sequoia, Paradigm, a16z, Founders Fund, Dragonfly, Server Farm)

#### Enhanced Press Row
- Replaced static flex layout with `.press-logo-marquee` infinite horizontal scroll
- Added 2 more press logos: "FINANCIAL TIMES", "WALL STREET JOURNAL" (total 7)
- Each logo has `.press-logo-item` with animated gold underline sweep
- Marquee pauses on hover

#### Typography Hierarchy Improvements
- Section titles now use `.section-gold-accent` (gold left border accent)
- Better spacing: sections now use `py-28`/`py-36` instead of `py-24`/`py-32`
- Process steps use `.number-badge` component instead of plain text
- Avatar uses `.avatar-gold-ring` (rotating conic gradient border)

#### Performance Section
- NAV chart card now has `.gold-border-sweep` animated border
- Increased top margin from `mt-12` to `mt-14`

#### Premium Footer Enhancement
- Added `.footer-gold-separator` at top of footer (gold gradient line)
- Better spacing: `py-16` instead of `py-12`, `gap-10` instead of `gap-8`
- Legal column header now uses `text-foreground/70` for better contrast
- All legal links use `.footer-link-gold` (hover gold color + animated underline)
- Added "Built with institutional-grade infrastructure" tagline
- Added second `.footer-gold-separator` before bottom bar
- Better bottom bar spacing and layout
- Investor login link remains gold with hover underline

#### Final CTA Section
- Card now has `.gold-border-sweep` animated border + `.hero-glow-pulse` pulsing glow
- CTAs use spring animation on hover/tap

## Files Modified
- `src/app/globals.css` — Added ~150 lines of new CSS utilities
- `src/components/public/landing.tsx` — Complete rewrite with animations and enhancements

## Lint Status
✅ Clean — `bun run lint` passes with no errors

## Dev Server
✅ Running on port 3000, no compilation errors in logs
