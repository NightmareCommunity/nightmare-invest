# Task 3: Landing Page Redesign

## Summary
Complete redesign of the landing page from a basic 4/10 QA-rated page to a premium institutional-grade experience.

## Key Changes
1. **Hero Section**: Full viewport height with CSS gold dot grid background, animated scanning line, bold "NIGHTMARE ALPHA CRYPTO FUND" headline, dual CTAs, hero stats row
2. **Live Ticker Tape**: Marquee scrolling crypto prices from /api/market/prices with pause-on-hover
3. **Strategy Section**: 5 individual allocation cards with animated progress bars
4. **Performance Section**: Recharts AreaChart for NAV + stat cards (Annual Return, Sharpe, MaxDD, CAGR)
5. **Security & Compliance**: 6-card grid layout
6. **Testimonial & Trust**: Featured institutional quote + trust badges + onboarding steps
7. **Final CTA**: Bold investment journey section

## CSS Additions (globals.css)
- `.hero-dot-grid` - Radial gold dot pattern with mask fade
- `.hero-scan-line` - Vertical scanning line animation (8s cycle)
- `@keyframes particle-pulse` - Opacity pulse effect

## Technical Notes
- Replaced canvas-based HeroCanvas with pure CSS dot grid (no JS runtime)
- NAV chart uses Recharts with real API fallback to deterministic data
- All data fetching via TanStack Query with proper stale times
- Full responsive design with mobile-first approach
