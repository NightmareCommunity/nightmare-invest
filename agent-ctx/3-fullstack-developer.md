# Task 3 — Investor Watchlist & Profit/Loss Calculator

## Agent: fullstack-developer
## Date: 2026-06-29
## Status: ✅ Complete

## Summary
Added two major features to the NIGHTMARE INVEST investor portal:
1. **Watchlist** — Track favorite crypto assets with price alerts (ABOVE/BELOW)
2. **Profit/Loss Calculator** — Hypothetical P&L projection based on fund historical returns

## Files Created
- `src/app/api/watchlist/route.ts` — CRUD endpoints (GET, POST, DELETE)
- `src/app/api/watchlist/[id]/route.ts` — Update endpoint (PUT)
- `src/app/api/watchlist/alerts/route.ts` — Alert trigger check
- `src/app/api/fund/nav/route.ts` — Public NAV history for calculator
- `src/components/investor/watchlist.tsx` — Watchlist page (~750 lines)
- `src/components/investor/calculator.tsx` — P&L Calculator page (~490 lines)

## Files Modified
- `prisma/schema.prisma` — WatchlistItem model + User.watchlist relation
- `src/lib/db.ts` — Schema version v7-watchlist
- `src/lib/store.ts` — Added watchlist + calculator routes
- `src/app/page.tsx` — Route imports + cases
- `src/components/brand/portal-shell.tsx` — Nav items (Star, Calculator icons)
- `src/app/api/seed/route.ts` — 3 default watchlist items

## Testing
- All API endpoints return 200 with correct data
- ESLint passes cleanly with zero errors
- Dev server compiles without issues
- Seed creates 3 watchlist items for demo investor (BTC/ETH/SOL with alerts)
- Watchlist API correctly enriches items with current prices and alert trigger status

## Key Decisions
- Key-based form reset for EditAlertDialog (avoids setState-in-effect lint violation)
- useRef-based AnimatedCounter (avoids stale closures)
- Server-side price enrichment in watchlist API (single request, no N+1)
- Fallback approximate returns in calculator when NAV history insufficient
