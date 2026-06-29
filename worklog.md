# NIGHTMARE INVEST — Project Worklog

## Project Status: ✅ MVP COMPLETE & VERIFIED
**Phase:** Full institutional portal delivered, browser-verified end-to-end.
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
