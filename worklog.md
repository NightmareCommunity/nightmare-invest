# NIGHTMARE INVEST — Project Worklog

## Project Status: ✅ MVP + ROUND 2 ENHANCEMENTS COMPLETE
**Phase:** Full institutional portal + premium polish + notification system + onboarding. Browser-verified.
**Premium Rating:** Landing 6→8/10, Investor Portal 6→8/10, Admin Portal 6→8/10 (VLM-assessed)
**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui + Prisma (SQLite) + JWT (access+refresh httpOnly cookies) + Framer Motion + Recharts + TanStack Query + Zustand.
**Theme:** Dark luxury institutional (matte black #0a0a0b + gold #D4AF37 + glassmorphism + gold glow).
**Live data:** CoinGecko BTC/ETH/SOL prices (30s cache) + Fear & Greed Index + BTC dominance.

## Completed Modules

### Backend (Next.js API routes)
- **Auth**: signup (first user → ADMIN), login, logout, me, password-reset. bcrypt cost 12, JWT access (30m) + refresh (7d) in httpOnly cookies. RBAC (USER/ADMIN).
- **Fund**: GET /api/fund, /api/fund/nav-history (1D/1W/1M/1Y/ALL), /api/fund/analytics.
- **Portfolio**: /api/portfolio (summary + metrics + allocations + holding), /api/holdings.
- **Transactions**: user create (DEPOSIT/WITHDRAWAL with min-invest & balance validation) + list own.
- **Market**: /api/market/prices (live CoinGecko), /api/market/sentiment (Fear&Greed + BTC dominance).
- **Reports**: /api/reports (full statement payload for PDF/CSV export).
- **Admin**: /api/admin/dashboard (AUM, investors, pending counts, NAV trend, capital flows), /admin/users (search+manage), /admin/users/[id] (edit role/active), /admin/transactions (filter by status), /admin/transactions/[id]/approve, /admin/transactions/[id]/reject, /admin/nav (publish NAV), /admin/allocations (replace allocations, 100% validation), /admin/ledger, /admin/audit-logs.
- **Seed**: /api/seed — idempotent bootstrap of Nightmare Alpha fund + 18mo NAV history (daily points w/ drift+vol) + demo investor + ledger + pending txns + audit.

### Critical Financial Flow (verified)
- Approving a transaction atomically (db.$transaction): updates holding (units + avgPrice), creates ledger entry (signed amount + balanceAfter), updates transaction status. Audit logged.
- Verified: approved $75K withdrawal → ledger entry -75000 → balance 425000. Pending dropped 2→1.

### Frontend (single `/` route, client-side router via Zustand)
- **Public**: Landing (hero, fund overview, allocation donut, strategy/benefits, performance sparkline, process, CTA, footer), Login, Signup, Forgot password, Legal pages (TOS, Privacy, Cookies, Risk) with sidebar TOC.
- **Investor portal**: Dashboard (4 animated metric tiles, NAV area chart w/ 1M/3M/6M/1Y/ALL ranges, holdings donut, 8 fund-metric tiles, live market intelligence, Fear&Greed gauge, recent activity table), Portfolio (exposure bar chart, position detail, allocation bars), Transactions (deposit/withdrawal modals w/ quick-amount chips, history table), Reports (PDF print statement, CSV ledger, CSV transactions), Settings (profile, password reset, session, security center).
- **Admin portal**: Dashboard (AUM/NAV trend chart, capital flows, 8 fund metrics), Investors (search, directory, edit role/active modal), Fund (metadata + allocation editor w/ color picker + live donut + 100% validation), NAV Management (publish form + history chart + table), Transactions (PENDING/APPROVED/REJECTED tabs, review modal w/ approve/reject + notes), Ledger (filterable, CSV export), Audit Logs (action icons, metadata, filter).
- **Shell**: sticky topbar (logo, admin badge, notifications, avatar, logout), responsive sidebar (desktop + mobile drawer), route-change animations, sticky footer.

### Premium UI Details
- Glassmorphism cards (glass, glass-gold, glass-strong), gold gradient text/buttons, gold glow shadows, grid background w/ radial fade, custom gold scrollbar, shimmer loaders, count-up animated metrics, Framer Motion fade-in transitions, status/type pills, reduced-motion support.

## Verification (agent-browser + VLM)
- ✅ Landing page: "Polished, professional, and on-brand for a premium crypto hedge fund."
- ✅ Login flow → investor dashboard: "All sections fully populated, premium institutional feel."
- ✅ Admin dashboard: "$66.6M AUM, NAV 192.85, chart rendered, no blank/broken areas."
- ✅ Transaction approval: ledger updated correctly (-75000 → balance 425000).
- ✅ Audit logs captured (TRANSACTION_APPROVED, USER_LOGIN/LOGOUT, SYSTEM_SEED).
- ✅ Mobile responsive: "adapts to narrow viewport without horizontal scroll."
- ✅ Legal page: "premium, readable, footer at bottom."
- ✅ ESLint clean, no runtime errors.

## Demo Credentials
- **Admin**: admin@nightmare.invest / admin12345 (first signup auto-admin)
- **Demo investor**: investor@nightmare.invest / investor123 (seeded)
- Fund: Nightmare Alpha Crypto Fund, NAV ~192.85, AUM ~$66.6M, min $50K, 2%/20% fees.

## Unresolved / Next-phase Recommendations
1. **KYC/AML**: not in MVP scope — add document upload + verification workflow.
2. **2FA**: add TOTP for admin & high-value withdrawal approval.
3. **Email notifications**: deposit/withdrawal status changes (currently toast-only).
4. **WebSocket**: real-time NAV/price push (currently 15-45s polling).
5. **Multi-fund**: schema supports it; UI is single-fund.
6. **Rate limiting / CSRF**: add middleware for production hardening.
7. **PostgreSQL migration**: schema is Prisma-portable; switch datasource for prod.
8. **Audit log export & immutable storage**: append-only with hash chaining for compliance.

## Notes for Continuation
- Single `/` route constraint handled via Zustand client-side router (route state) + AppRouter switch.
- All API routes under /api/*, all use httpOnly cookies (no client token handling).
- TanStack Query for server state (auto-refetch 15-45s), Zustand for auth/route state.
- The cron webDevReview job (every 15 min) will continue QA + feature expansion.

---
Task ID: 2
Agent: landing-enhancer
Task: Enhance landing page with animated hero, better contrast, improved CTAs, trust indicators

Work Log:
- Created `HeroCanvas` component with canvas-based animated gold particle constellation effect (55 particles, 140px connection distance, requestAnimationFrame, reduced-motion support)
- Placed HeroCanvas as first child in hero section with `absolute inset-0 z-0` positioning
- Updated nav buttons from `text-muted-foreground` to `text-foreground/70 hover:text-foreground` for better contrast
- Updated Investor Login nav button from `text-muted-foreground` to `text-foreground/70 hover:text-foreground`
- Added `shimmer-badge` CSS class with ::after pseudo-element shimmer overlay animation to the hero badge
- Changed hero badge border from `border-gold/20` to `border-gold/30`
- Added `font-extrabold` to the "Institutional" gold gradient span for bolder emphasis
- Added `glow-underline` class with animated pulsing gold gradient underline below the headline
- Changed hero subtext from `text-muted-foreground` to `text-foreground/60` for improved contrast
- Updated secondary CTA button from `text-foreground` to `text-gold` with `border-gold/30 hover:bg-gold/10`
- Added trust indicators row below CTA: "256-bit Encryption" (Lock), "SOC 2 Audited" (ShieldCheck), "Qualified Custody" (Building2)
- Added `stat-card-gold` CSS class with gold top-border (2px solid rgba(212,175,55,0.4)) and hover glow effect
- Applied `stat-card-gold` class to all hero stat GlassCards
- Added new CSS keyframes and utility classes to globals.css: shimmer-badge, glow-underline, glow-pulse, stat-card-gold
- Added `Building2` icon import from lucide-react, `useRef` and `useEffect` from React
- ESLint clean, no compilation errors

Stage Summary:
- Landing page hero section now has premium animated particle constellation background
- All contrast issues addressed: nav buttons, subtext, badge visibility improved
- Hero badge has shimmer animation and stronger gold border
- "Institutional" text is now font-extrabold with animated gold glow underline below headline
- CTA buttons have balanced visual weight with consistent gold-themed styling
- Trust indicators (256-bit Encryption, SOC 2 Audited, Qualified Custody) provide credibility signals
- Stat cards have gold top-borders with hover glow effect
- All changes compile cleanly with zero lint errors

---
Task ID: 3
Agent: notification-center
Task: Add notification center with API, dropdown, and bell badge

Work Log:
- Created `/api/notifications/route.ts` with GET and PUT handlers
  - GET: Derives notifications from Transaction table (APPROVED/REJECTED where userId=current user) and latest NAVPoint
  - Each notification has: id, type (TRANSACTION_APPROVED, TRANSACTION_REJECTED, NAV_UPDATED, SYSTEM), title, description, timestamp, read (boolean), referenceId
  - Read state stored in-memory Map<userId, Set<notificationId>>
  - PUT: Marks all notifications as read for the current user by populating the read set
  - Returns `{ notifications, unreadCount }` sorted by timestamp desc
- Created `/components/brand/notification-center.tsx` client component
  - Uses Popover from shadcn/ui for dropdown panel triggered by bell icon
  - Bell icon shows gold badge with unread count (caps at 9+)
  - Dropdown panel with glass-strong dark background matching portal theme
  - Header shows "Notifications" title + unread count badge + "Mark all as read" button
  - Each notification shows type-specific icon (CheckCircle/XCircle/TrendingUp/Info), title, description, relative timestamp (via timeAgo), unread gold dot indicator
  - Empty state: bell icon + "No new notifications"
  - ScrollArea with max-h-96 for long lists
  - TanStack Query with 30s auto-refetch interval
  - Footer note: "Auto-refreshes every 30s"
- Updated `/components/brand/portal-shell.tsx`
  - Replaced static bell button with `<NotificationCenter />` component
  - Removed unused `Bell` import from lucide-react
  - Added `NotificationCenter` import from brand components
- Ran `bun run lint` — clean, zero errors
- Verified API endpoint returns 200 in dev server logs

Stage Summary:
- Full notification center feature operational: API endpoint + interactive dropdown + bell badge
- Notifications derived from real data: approved/rejected transactions and NAV updates
- Mark-all-as-read functionality with in-memory read state
- Auto-refreshing every 30 seconds via TanStack Query polling
- Dark luxury glassmorphism styling consistent with portal theme
- ESLint clean, no runtime errors

---
Task ID: 4
Agent: premium-styling
Task: Add premium visual polish to portal shell, glass cards, metric tiles, sidebar, topbar

Work Log:
- Added 7 new CSS keyframes/utility classes to globals.css:
  - `bg-gradient-animated`: slow 20s shifting gradient background for content area (gold-tinted, very subtle)
  - `gold-hairline-pulse`: 3s opacity pulse animation for gold card top hairlines
  - `metric-bottom-border`: ::after pseudo-element creating gold-to-transparent bottom gradient border
  - `text-shadow-metric`: subtle text-shadow (gold glow + dark depth shadow) for metric values
  - `topbar-glow-line`: ::after pseudo-element with gold gradient glow line at bottom of topbar
  - `sidebar-gold-accent`: ::before pseudo-element with 2px gold gradient line at top of sidebar
  - `nav-active-indicator`: 3px left gold border indicator for active nav items with rounded corners
  - `nav-item-hover`: subtle hover animation with text-indent and inset gold glow shadow
- Enhanced GlassCard in primitives.tsx:
  - Added inner shadow `shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]` to all glass cards
  - Added `group` class for hover overlay interaction
  - Added hover brightening overlay div (`bg-white/0 → group-hover:bg-white/[0.02]`)
  - Wrapped children in `relative z-10` div to sit above overlay
  - Gold card top hairline now pulses with `gold-hairline-pulse` animation
- Enhanced MetricTile in primitives.tsx:
  - Added `metric-bottom-border` class for bottom gradient border
  - Added `text-shadow-metric` class to value text for depth
  - Added `transition-transform duration-200 hover:scale-[1.02]` micro-animation on hover
- Enhanced portal-shell.tsx topbar:
  - Added `topbar-glow-line` class for subtle gold glow line at bottom
  - Added gold ring (`ring-2 ring-gold/50 ring-offset-1 ring-offset-background`) to avatar when user role is ADMIN
- Enhanced portal-shell.tsx sidebar:
  - Added `sidebar-gold-accent` class for 2px gold gradient line at top
  - Active nav item now uses `nav-active-indicator` (left gold border) instead of full gold gradient background
  - Active nav text/icon now uses gold color scheme instead of black-on-gold
  - Added `nav-item-hover` class for subtle hover animation (slight indent + inset glow)
  - Added separator line between nav groups (after first 3 investor items, after first 2 admin items)
- Enhanced portal-shell.tsx main content area:
  - Added `bg-gradient-animated` class for slow animated gradient background
  - Added "NIGHTMARE INVEST" watermark at bottom-right (opacity 0.02, pointer-events-none, select-none)
  - Wrapped content in `relative z-10` to stay above watermark and gradient
- Ran `bun run lint` — clean, zero errors
- Verified dev server compilation — no errors

Stage Summary:
- Portal shell now has animated gradient content background, gold accent sidebar top line, and subtle watermark
- GlassCard has inner shadow, hover brightening overlay, and pulsing gold hairline on gold variants
- MetricTile has bottom gold gradient border, depth text-shadow, and scale micro-animation on hover
- Sidebar has gold left-border active indicator, hover indent+glow animation, and nav group separators
- Topbar has gold glow bottom line and admin avatar gold ring
- All changes compile cleanly with zero lint errors

---
Task ID: 5
Agent: welcome-modal-and-txn-fixes
Task: Add investor welcome modal and improve transactions page

Work Log:
- Created `/src/components/brand/welcome-modal.tsx` — a premium welcome/onboarding modal for first-time investor login
  - Uses `useSyncExternalStore` with a custom localStorage-backed store (no setState in useEffect) to track dismissed state
  - localStorage key `ni-welcome-dismissed` — modal shows only if key is absent or "0"
  - Dialog from shadcn/ui with `showCloseButton={false}`
  - Shield icon in gold-bordered circle at top
  - "Welcome to Nightmare Invest" heading with gold gradient text
  - Intro text: "Your private portal to the Nightmare Alpha Crypto Fund is ready. Here's what you can do:"
  - 2x2 grid of 4 feature cards: Monitor Portfolio (TrendingUp), Request Deposits (ArrowDownToLine), Request Withdrawals (ArrowUpFromLine), Download Reports (FileText)
  - "Enter Portal" gold gradient button to dismiss
  - Framer Motion staggered entrance animations (icon → title → description → cards → button)
  - Server snapshot returns `true` (dismissed) to prevent SSR flash
- Integrated WelcomeModal into `/src/app/page.tsx` — renders inside `<PortalShell>` only for investor routes, NOT admin routes
- Improved `/src/components/investor/transactions.tsx`:
  1. Empty state: replaced small Info icon + text with large ArrowDownToLine icon in gold-bordered circle, "Begin Your Investment Journey" heading, descriptive text, and prominent "New Deposit" button
  2. Pending Requests card: added gold border (`border-gold/30`), pulsing gold dot indicator (animate-ping) when pending > 0, and "Awaiting admin review" subtitle
  3. Guidance hint: added `text-xs text-muted-foreground` hint with Info icon below Deposit/Withdraw buttons: "Deposits are reviewed within 24 hours. Minimum commitment $50,000."
  4. Transaction table: added alternating row backgrounds (even rows `bg-white/[0.01]`), `font-metric` consistently on amount column, `hover:bg-gold/5` on all rows
- Removed unused `CircleDot` import from transactions.tsx
- Ran `bun run lint` — clean, zero errors
- Dev server compiles and runs successfully

Stage Summary:
- Investor welcome modal fully functional with premium animated experience, localStorage persistence, and no SSR flash
- Transactions page has improved UX: richer empty state, prominent pending indicator with pulsing gold dot, guidance hint text, and polished table with alternating rows and hover highlights
- All changes pass ESLint with zero errors, dev server compiles cleanly

---
Task ID: Round-2-Review
Agent: cron-webDevReview
Task: Round 2 QA + Premium Polish + Feature Expansion

Work Log:
- Comprehensive QA using agent-browser + VLM across all major flows (landing, auth, investor dashboard, admin dashboard, transactions, audit logs)
- VLM-rated premium feel: Landing 6/10, Investor 6/10, Admin 6/10 → identified issues: weak nav contrast, static hero, no particles, flat cards, no notifications, no onboarding
- Fixed landing page: animated gold particle constellation canvas (HeroCanvas), improved nav contrast (text-foreground/70), shimmer badge, bold "Institutional" with glow underline, balanced CTA buttons, trust indicators (256-bit, SOC 2, Qualified Custody), gold stat card borders
- Added notification center: /api/notifications API (derives from transactions + NAV), bell icon with unread badge, Popover dropdown with type-specific icons (CheckCircle/XCircle/TrendingUp), mark-all-as-read, 30s auto-refresh
- Premium portal polish: animated gradient content background, gold accent sidebar line, left-border active nav indicator, hover indent+glow animation, nav separators, topbar gold glow line, admin avatar gold ring, "NIGHTMARE INVEST" watermark (0.02 opacity)
- Enhanced GlassCard: inner shadow, hover brightening overlay, pulsing gold hairline on gold cards
- Enhanced MetricTile: bottom gold gradient border, depth text-shadow, scale-[1.02] hover micro-animation
- Added investor welcome modal: Dialog with shield icon, gold heading, 2x2 feature cards (Portfolio/Deposits/Withdrawals/Reports), "Enter Portal" CTA, localStorage persistence, Framer Motion staggered entrance
- Improved investor transactions: richer empty state with CTA, prominent pending card with pulsing gold dot, guidance hint, alternating row backgrounds, font-metric amounts, hover highlights
- Re-verified with VLM: Landing 8/10, Investor 8/10, Admin 8/10 — all improvements confirmed
- Verified notification API: investor gets 4 notifications (withdrawal approved, NAV updated, deposit approved, deposit rejected)

Stage Summary:
- Premium feel significantly improved across all surfaces (6→8/10)
- Notification center fully operational with real data
- Welcome onboarding modal enhances first-time investor experience
- All lint clean, no runtime errors, dev server healthy

## Round 2 Unresolved / Next-phase Recommendations
1. **KYC document upload**: Add file upload endpoint + admin review workflow
2. **2FA/TOTP**: Add authenticator-based 2FA for admin and high-value operations
3. **WebSocket real-time**: Push NAV/price updates instead of polling
4. **Advanced analytics**: Drawdown chart, correlation matrix, sector exposure heatmap
5. **Rate limiting middleware**: Add per-IP and per-user rate limits
6. **Light mode**: Add luxury light theme option (cream + gold)
7. **Multi-fund support**: Schema ready, UI needs fund selector
8. **Email notifications**: Integrate SendGrid/Resend for transaction status emails
