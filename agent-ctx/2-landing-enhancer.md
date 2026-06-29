# Task 2: Landing Page Hero Enhancement

## Agent: landing-enhancer

## Task Summary
Enhance the landing page with a much more premium, dynamic, and impactful hero section.

## Changes Made

### Files Modified
1. **`src/components/public/landing.tsx`** — All hero section enhancements
2. **`src/app/globals.css`** — New CSS utility classes and keyframes

### Detailed Changes

#### 1. HeroCanvas Component (new)
- Created canvas-based animated gold particle constellation effect
- 55 gold particles (#D4AF37) with opacity range 0.1–0.4
- Particles slowly float upward with slight horizontal drift
- Connecting lines between nearby particles (140px distance) with alpha 0.05–0.1
- Uses requestAnimationFrame for performance
- Respects `prefers-reduced-motion: reduce` — exits early if set
- Placed as first child in hero section with `className="absolute inset-0 z-0 h-full w-full"`
- Handles devicePixelRatio for sharp rendering on Retina displays
- Properly cleans up animation frame and resize listener on unmount

#### 2. Nav Contrast Improvements
- Nav section buttons: `text-muted-foreground` → `text-foreground/70 hover:text-foreground`
- Investor Login button: `text-muted-foreground` → `text-foreground/70 hover:text-foreground`

#### 3. Hero Badge Enhancement
- Added `shimmer-badge` CSS class with `::after` pseudo-element shimmer overlay
- Border changed from `border-gold/20` to `border-gold/30`
- Shimmer animation: linear gradient sweeping across at 3s interval

#### 4. Hero Text Improvements
- "Institutional" span: added `font-extrabold` for bolder emphasis
- Headline `h1`: added `glow-underline` class with animated gold underline
- Glow underline: 200px wide gold gradient line that pulses opacity (0.3–0.7) and scaleX (0.7–1.0) over 3s
- Subtext paragraph: `text-muted-foreground` → `text-foreground/60` for better contrast
- Subtext margin-top: `mt-6` → `mt-8` for breathing room after the glow underline

#### 5. CTA Button Balance
- Secondary button (Investor Login): `text-foreground` → `text-gold`
- Already had `border-gold/30 hover:bg-gold/10` — kept consistent
- Both buttons now have gold-themed styling with equal visual weight

#### 6. Trust Indicators
- Added row of three trust badges below CTA buttons and minimum commitment text
- "256-bit Encryption" with Lock icon
- "SOC 2 Audited" with ShieldCheck icon
- "Qualified Custody" with Building2 icon
- Styled with `text-foreground/40` for subtle, institutional look
- Responsive: `flex-wrap` for mobile

#### 7. Stats Section Enhancement
- Added `stat-card-gold` CSS class to each stat GlassCard
- Gold top-border: 2px solid rgba(212,175,55,0.4)
- Hover glow: box-shadow 0 0 24px rgba(212,175,55,0.15) with transition

### New CSS Classes Added to globals.css
- `.shimmer-badge` — relative/overflow-hidden container for shimmer
- `.shimmer-badge::after` — animated shimmer overlay (3s linear infinite)
- `.glow-underline` — position relative for ::after positioning
- `.glow-underline::after` — animated gold gradient line below headline
- `@keyframes glow-pulse` — opacity + scaleX animation for glow underline
- `.stat-card-gold` — gold top-border with hover glow effect

### New Imports
- `useRef`, `useEffect` from React
- `Building2` from lucide-react

## Verification
- ESLint: clean (zero errors)
- Dev server: compiles successfully, page renders
- All animations respect reduced-motion preference
