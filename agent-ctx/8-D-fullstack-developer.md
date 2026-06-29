# Task 8-D — Investor Statement Requests + Final Polish

**Agent:** fullstack-developer
**Task ID:** 8-D
**Project:** NIGHTMARE INVEST crypto hedge fund portal
**Status:** ✅ COMPLETE

## Summary

Implemented the two related features for Round 8-D:

### Feature 1: Investor Statement Request Flow
- **Prisma:** Added `StatementRequest` model (id, userId, periodStart, periodEnd, type, notes, status, documentId, processedBy, processor, createdAt, completedAt) + 2 back-relations on `User`. Bumped schema to `v11-statement-requests`. Ran `db:push` + `db:generate`.
- **5 new API endpoints** (all use `safeHandler` + `requireUser`/`requireAdmin`):
  - `POST /api/statement-requests` — investor creates PENDING request (validates periodEnd > periodStart, periodStart not future, type ∈ {MONTHLY_STATEMENT, QUARTERLY_REPORT, TAX_STATEMENT, CUSTOM})
  - `GET /api/statement-requests` — investor lists own requests DESC, with hydrated document for COMPLETED
  - `GET /api/admin/statement-requests` — admin lists ALL requests with user/processor/document hydration + `pendingCount` + pagination + status filter
  - `POST /api/admin/statement-requests/[id]/fulfill` — admin generates PDF on the spot, links it, marks COMPLETED, audit log, dual realtime notification (`new_document` + `new_message`)
  - `POST /api/admin/statement-requests/[id]/reject` — admin rejects with optional reason, audit log, realtime `new_message` notification (priority IMPORTANT)
- **Shared helper:** Extracted `generateStatementForInvestor()` into `src/lib/statement.ts` — eliminates ~150 LOC of duplicated PDF generation logic between `/api/admin/statements/generate` and the new fulfill route. Original route refactored to use the helper (same external behavior, now supports optional `type` field).
- **Investor UI:** Updated `src/components/investor/documents.tsx` — added "Request Statement" dialog (type selector + date pickers + notes), new "Statement Requests" section with status badges + View Document link, stats bar updated.
- **Admin UI:** Updated `src/components/admin/documents.tsx` — added top-level Tabs (All Documents | Statement Requests with pending badge), new Statement Requests tab with filterable table + fulfill/reject actions + reject dialog.
- **Seed:** Added section 14 to `/api/seed/route.ts` — 2 PENDING + 1 COMPLETED statement requests with realistic notes + timestamps.

### Feature 2: Final Polish Pass
- **CSS classes added:**
  - `.status-pill-pulse` — radial-gradient amber glow halo, 2.4s pulse animation, used for PENDING badges + NEW indicators
  - `.upload-dropzone` — dashed gold border hover lift + gradient overlay
- **Investor Documents polish:**
  - Filter tabs `px-3.5 py-1.5` → `px-4 py-2` with hover lift + gold glow on active
  - Download column `text-right` → `text-center` with `align-middle` + `justify-center`
  - "New" indicator: small gold dot → pulsing gold pill badge "NEW" with `animate-pulse`
- **Admin Documents polish:**
  - Generate Statement card padding `p-5` → `p-6`, `gap-3` → `gap-4` between fields
  - All labels standardized to `text-xs uppercase tracking-wider text-muted-foreground` via shared `LABEL_CLS` constant
  - All inputs use shared `INPUT_CLS`/`SELECT_TRIGGER_CLS` with `focus:ring-2 focus:ring-gold/30`
  - Upload dropzone `min-h-[200px]` with `.upload-dropzone` class, "Click or drag files here" text, accept all required file types
- **Landing page:** Audited — "CRYPTO FUND" already uses `font-black`, "NIGHTMARE ALPHA" uses `font-extrabold` + `text-gold-gradient`, press row (BLOOMBERG · COINDESK · FORBES · REUTERS · THE BLOCK) already visible + well-spaced. No changes needed (Round 8-B already addressed these).

### Critical Infrastructure Fix
- **`@prisma/client` added to `serverExternalPackages`** in `next.config.ts`. After `prisma generate`, the running dev server had a stale PrismaClient class cached in its module graph (`db.statementRequest` was undefined). Marking @prisma/client as external tells Turbopack not to bundle it, so the runtime loads it directly from node_modules — picking up freshly-regenerated clients without a manual server restart. The config change triggered Next.js's automatic server restart, and the new PrismaClient class loaded successfully. This is the long-term fix for the recurring "stale PrismaClient class after schema changes" issue documented across multiple prior rounds.

## Verification

- `bun run lint` → exit 0 (clean, 0 errors, 0 warnings)
- `bunx tsc --noEmit` → only pre-existing errors from earlier rounds (no new errors introduced)
- All 5 new API endpoints + 4 validation cases + 3 access-control cases verified end-to-end with curl
- Realtime notifications verified in price-stream log: `Notified 1 user(s): new_document` + `Notified 1 user(s): new_message` on fulfill, `Notified 1 user(s): new_message` on reject
- Pre-existing functionality (existing /api/admin/statements/generate, document vault, download endpoint, admin documents upload/delete) all still work — refactor preserves identical external behavior

## Files Created (5)
- `src/lib/statement.ts`
- `src/app/api/statement-requests/route.ts`
- `src/app/api/admin/statement-requests/route.ts`
- `src/app/api/admin/statement-requests/[id]/fulfill/route.ts`
- `src/app/api/admin/statement-requests/[id]/reject/route.ts`

## Files Modified (7)
- `prisma/schema.prisma` — added StatementRequest model + User back-relations
- `src/lib/db.ts` — bumped schema version to v11-statement-requests
- `next.config.ts` — added `@prisma/client` to serverExternalPackages
- `src/app/api/admin/statements/generate/route.ts` — refactored to use shared helper
- `src/components/investor/documents.tsx` — Request Statement dialog + Pending Requests section + VLM polish
- `src/components/admin/documents.tsx` — Statement Requests tab + VLM polish
- `src/app/api/seed/route.ts` — added statement request seeding (section 14)
- `src/app/globals.css` — added `.status-pill-pulse` + `.upload-dropzone` classes

## Test Credentials
- Investor: `investor@nightmare.invest` / `investor123`
- Admin: `admin@nightmare.invest` / `admin12345`

## View
Use the Preview Panel on the right to view the application. Click "Open in New Tab" for a separate browser window.
