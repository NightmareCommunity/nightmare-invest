# Task ID: 4c — Public/Brand Mobile Optimization

**Agent:** full-stack-developer
**Task:** Apply mobile-first responsive optimization to public/brand/shared components.

## Files Modified
- `src/components/brand/primitives.tsx`
- `src/components/public/landing.tsx`
- `src/components/public/auth-screen.tsx`
- `src/components/public/legal-page.tsx`
- `src/components/brand/notification-center.tsx`
- `src/components/brand/welcome-modal.tsx`
- `src/components/brand/onboarding-wizard.tsx`

## Key Changes

### primitives.tsx
- `GlassCard`: added `min-w-0` to root, new optional `compact` prop (p-3 sm:p-4).
- `MetricTile`: padding `p-3 sm:p-4 lg:p-5`, font `text-xl sm:text-2xl lg:text-3xl`, value `break-words-mobile`, label `min-w-0`.
- `SectionTitle`: responsive `text-base sm:text-lg lg:text-xl`, action wrapped in `shrink-0` to prevent overflow.
- `StatusPill` / `TypePill`: compact mobile text, `whitespace-nowrap`, status label truncated with `max-w-[10rem]`.
- `SkeletonMetric`: responsive padding and widths.
- `EmptyState`: smaller icon, compact padding on mobile, `break-words-mobile`.
- `FadeIn`: reduced motion distance (y:8 instead of 12, x:12 instead of 16).

### landing.tsx
- Removed dead imports (`useCallback`, `useAnimation`, `Hexagon`, `Landmark`, `Server`).
- Added `Menu`/`X` imports + mobile hamburger nav (slide-down AnimatePresence drawer, `md:hidden`).
- Desktop nav hidden on mobile, "Login" button hidden on mobile (in drawer instead).
- Hero: `h1-responsive`, `body-responsive`, CTAs stacked + `btn-full-mobile` + `tap-target` + `h-12 sm:h-14`.
- Hero stats: `grid-cols-2` (already), compact `p-3 sm:p-4 lg:p-5`, value `text-lg sm:text-xl lg:text-2xl xl:text-3xl`.
- "Backed by" logos: `grid-cols-2 sm:flex sm:flex-wrap` for clean mobile grid.
- Press marquee: smaller text on mobile, `whitespace-nowrap` to prevent wrap-induced overflow.
- All sections: `py-16 sm:py-24 lg:py-36` (down from `py-28 lg:py-36`).
- Strategy/Security grids: explicit `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, `min-w-0` on cards.
- Performance NAV chart: `chart-mobile` class (responsive height), `p-3 sm:p-6 lg:p-8`.
- Performance stat cards: `grid-cols-2` (was already), compact `p-3 sm:p-5`.
- Testimonial card: `p-6 sm:p-8 lg:p-10`, all text `break-words-mobile`, avatar shrink-0.
- Trust badges: smaller padding on mobile.
- Process steps: `gap-3 sm:gap-4`, `min-w-0` on text container, `number-badge shrink-0`.
- Final CTA: `p-6 sm:p-12 lg:p-20`, CTAs full-width on mobile with `tap-target`.
- Footer: `grid-cols-1 sm:grid-cols-2 md:grid-cols-4`, `safe-area-bottom`, `break-words-mobile` everywhere, links wrapped in `tap-target-sm inline-block`.
- All headings switched to `h2-responsive`.

### auth-screen.tsx
- Container: `py-16 sm:py-12`, `safe-area-top safe-area-bottom`.
- Wrapper: `max-w-[95vw] sm:max-w-md`.
- Heading: `h2-responsive`.
- GlassCard padding: `p-5 sm:p-7`.
- All Input components: explicit `h-12` (touch-friendly 48px).
- Submit button: `w-full h-12 tap-target`.
- Toggle links: `tap-target-sm`, wrapped with `flex-wrap` to prevent overflow.
- 2FA Challenge: OTP slots responsive `h-10 w-10 sm:h-12 sm:w-12`, wrapped in `scroll-row` for horizontal scroll if overflow, gap reduced on mobile.
- Demo credentials: `break-words-mobile`.

### legal-page.tsx
- Header: `h-14 sm:h-16`, `safe-area-top`, "Home" button `tap-target-sm`.
- Main: `py-8 sm:py-12`.
- Title: `h2-responsive`, "Last updated" smaller text.
- Icon box: `h-10 w-10 sm:h-12 sm:w-12`.
- TOC sidebar: `GlassCard compact`, max-height with `overflow-y-auto scroll-luxury` on mobile, full-height on desktop.
- Section headings: `h3-responsive`.
- Paragraphs: `body-responsive`, `break-words-mobile`.
- Footer: `mt-auto safe-area-bottom`.
- Return button: `tap-target-sm`.

### notification-center.tsx
- Bell trigger: `tap-target-sm`.
- PopoverContent: `w-[95vw] max-w-[380px] sm:w-96` (full-width sheet on mobile).
- Header: `min-w-0` on title row, title `truncate`.
- "Mark all" replaced with `Button` ghost sm with `CheckCheck` icon, `tap-target-sm` (compact label).
- Empty state: compact (`py-8`), smaller icon, secondary message line.
- Notification items: `min-w-0` everywhere, description `line-clamp-2 break-words-mobile`.
- ScrollArea: `max-h-[70vh] sm:max-h-96` (taller on mobile).
- Footer: `safe-area-bottom`.

### welcome-modal.tsx
- DialogContent: `max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto overscroll-contain p-5 sm:p-6 safe-area-bottom`.
- Shield icon: `h-12 w-12 sm:h-14 sm:w-14`.
- Title: `text-xl sm:text-2xl`.
- Feature cards: `grid-cols-1 sm:grid-cols-2` (stack on mobile), `flex items-start gap-3`, icon `shrink-0`, `min-w-0` on text container.
- "Enter Portal" button: `w-full sm:w-auto h-12 tap-target btn-full-mobile`.

### onboarding-wizard.tsx
- Container: `p-2 sm:p-4 safe-area-top safe-area-bottom`.
- Modal: `max-w-[95vw] sm:max-w-2xl max-h-[94vh] flex flex-col`.
- GlassCard: `flex flex-col max-h-[94vh]`.
- Header: `shrink-0`, title `truncate`, close button `tap-target-sm`.
- Stepper: `scroll-row` (horizontal scroll on mobile), step circles `h-9 w-9 sm:h-10 sm:w-10`, step labels `whitespace-nowrap`, connectors `w-6 sm:w-16`.
- Step content area: `overflow-y-auto scroll-luxury flex-1 min-w-0`, padding `p-4 sm:p-6`.
- Footer: `sticky-mobile-cta`, `flex flex-col sm:flex-row` on mobile (stacked nav buttons), `safe-area-bottom`.
- Back/Next buttons: `h-12 tap-target btn-full-mobile`.
- Step indicator dots: `justify-center` on mobile.
- Step1Profile: phone/country inputs `h-12`, investor type grid `grid-cols-2 sm:grid-cols-3` (stacks to 2 on mobile).
- Step2Security: QR placeholder unchanged, verify code input unchanged (already centered), buttons `h-12 tap-target`, recovery email `h-12`.
- Step3Deposit: preset grid `grid-cols-2 sm:grid-cols-4` (2x2 on mobile), preset buttons `h-12`, custom amount input `text-xl sm:text-2xl` + `inputMode="decimal"`.

## Lint Result
- `bun run lint` — PASS (0 errors, 0 warnings)
- Dev server healthy: all GET requests 200, compiled in 406–697ms.

## Constraints Honored
- No new colors (dark luxury gold theme preserved).
- All existing functionality intact (login, register, notifications, onboarding flow, welcome dismissal).
- No imports removed except dead code (unused `useCallback`, `useAnimation`, `Hexagon`, `Landmark`, `Server` in landing.tsx).
- TypeScript strict: no `any`, no unused vars.
- No test files created.
- Mobile breakpoints respected: <768 mobile, 768–1024 tablet, >1024 desktop.
- Universal rules applied: `min-w-0` on flex/grid children with text, `tap-target` on buttons, `break-words-mobile` on long text, modals `max-w-[95vw]`, `safe-area-bottom` on bottom-anchored UI.
