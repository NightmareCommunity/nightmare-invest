# Task ID: 7 — Backend (Investment Management API + Deposit Minimums)

## Agent
full-stack-developer (Backend)

## Task
Build investment management API routes + deposit minimum validation for the
NIGHTMARE INVEST crypto hedge fund portal (Next.js 16 App Router + Prisma + SQLite).

## Work Log
- Read worklog, existing lib helpers (`auth.ts`, `api.ts`, `audit.ts`,
  `analytics.ts`, `realtime.ts`, `market.ts`, `db.ts`), the schema, and the
  example admin transaction approval route to match patterns exactly.
- Updated `/src/app/api/transactions/route.ts` POST handler:
  - Wrapped in `safeHandler`.
  - Added `method` (UPI | BTC | LTC | USDT, default UPI) and `cryptoAmount`
    fields to the request body.
  - Reads `minInrDeposit` (default 1000) and `minCryptoDepositUsd` (default 10)
    from SystemSetting table.
  - UPI deposits: enforces `amount >= minInrDeposit` (error
    "Minimum INR deposit is ₹1000").
  - Crypto deposits (BTC/LTC): fetches live price via `getCryptoPriceUsd`,
    computes `usdValue = cryptoAmount * price`, enforces `usdValue >= 10`.
  - USDT deposits: `usdValue = cryptoAmount` (1:1 peg), enforces `$10` min.
  - Withdrawals: keeps the existing balance check; NO minimum enforcement.
  - Stores `method`, `cryptoAmount` (null for UPI), `usdValue` (null for UPI)
    on the created Transaction record.
  - `audit()` call now includes method/cryptoAmount/usdValue metadata.
- Created `/src/app/api/admin/investments/route.ts`:
  - GET — list all investments with user + fund + latest history. Supports
    `?status=` and `?q=` (search by investmentName or user email).
  - POST — create investment: validates user + fund exist; defaults currentValue
    to investedAmount; auto-calculates profitLoss + roiPercent; defaults status
    to ACTIVE; auto-computes durationDays from start/end if not given. Uses
    `db.$transaction` to create the Investment AND a LedgerEntry with
    `type: INVESTMENT_ALLOC`, `amount: -investedAmount`. `audit()` call:
    `INVESTMENT_CREATED`.
- Created `/src/app/api/admin/investments/[id]/route.ts`:
  - GET — single investment with user + fund + full history (desc).
  - PUT — partial update. If `currentValue` or `investedAmount` changes,
    recalculates profitLoss + roiPercent. If `currentValue` changed, appends an
    `InvestmentHistory` record inside a `db.$transaction`. `audit()` call:
    `INVESTMENT_UPDATED` with the `changes` object.
- Created `/src/app/api/admin/investments/[id]/close/route.ts`:
  - POST — closes ACTIVE or PENDING investments. Optional `finalValue`
    recalculates P/L + ROI and writes InvestmentHistory. Status → CLOSED,
    endDate → now if not set. In `db.$transaction`, releases capital + P/L
    via LedgerEntry `type: INVESTMENT_RELEASE`, `amount: +finalValue`.
    `audit()` → `INVESTMENT_CLOSED`. `notifyUser(userId, "investment_closed",
    { investmentId, name, finalValue })`.
- Created `/src/app/api/admin/investments/[id]/cancel/route.ts`:
  - POST — cancels PENDING or ACTIVE. Status → CANCELLED. If it was ACTIVE,
    releases `investedAmount` (capital only, no P/L) via LedgerEntry
    `INVESTMENT_RELEASE`. `audit()` → `INVESTMENT_CANCELLED`. `notifyUser` with
    `"investment_cancelled"`.
- Created `/src/app/api/investments/route.ts` (user):
  - GET — list investments for the current user (requireUser) with fund +
    recent history.
- Created `/src/app/api/investments/[id]/route.ts` (user):
  - GET — single investment owned by the current user (404 otherwise) with
    fund + full history.
- Created `/src/app/api/deposit-limits/route.ts` (public, no auth):
  - Returns `{ minInrDeposit, minCryptoDepositUsd, supportedCrypto, supportedMethods }`.
- Extended `RealtimeEvent` union in `/src/lib/realtime.ts` with
  `investment_closed`, `investment_cancelled`, `investment_updated` (additive,
  non-breaking change) so the new `notifyUser` calls type-check.

## Verification
- `bun run lint` — passes cleanly (no errors or warnings).
- `dev.log` — only contains unrelated frontend module-not-found warnings for
  `@/components/admin/investments` and `@/components/investor/investments`,
  which are being built by frontend agents (out of scope for this task).

## Stage Summary
- Files modified:
  - `src/app/api/transactions/route.ts`
  - `src/lib/realtime.ts` (RealtimeEvent union extended)
- Files created:
  - `src/app/api/admin/investments/route.ts`
  - `src/app/api/admin/investments/[id]/route.ts`
  - `src/app/api/admin/investments/[id]/close/route.ts`
  - `src/app/api/admin/investments/[id]/cancel/route.ts`
  - `src/app/api/investments/route.ts`
  - `src/app/api/investments/[id]/route.ts`
  - `src/app/api/deposit-limits/route.ts`
- API endpoints (10 total):
  - `GET/POST /api/admin/investments`
  - `GET/PUT /api/admin/investments/[id]`
  - `POST /api/admin/investments/[id]/close`
  - `POST /api/admin/investments/[id]/cancel`
  - `GET /api/investments`
  - `GET /api/investments/[id]`
  - `GET /api/deposit-limits` (public)
  - `POST /api/transactions` (updated; GET unchanged)
- Validation rules implemented:
  - UPI deposit min ₹1000 (configurable via `minInrDeposit` setting).
  - Crypto deposit min $10 USD (configurable via `minCryptoDepositUsd` setting).
  - Crypto `usdValue` computed via `getCryptoPriceUsd` for BTC/LTC; 1:1 peg for USDT.
  - Withdrawals: no minimum enforced (partial-balance allowed); balance check intact.
  - Investment lifecycle: ACTIVE/PENDING → CLOSED (close), PENDING/ACTIVE → CANCELLED (cancel).
  - Capital allocation via LedgerEntry `INVESTMENT_ALLOC` (-amount on create);
    release via `INVESTMENT_RELEASE` (+amount on close; +investedAmount on cancel of ACTIVE).
  - InvestmentHistory records appended on every currentValue change (PUT + close).
