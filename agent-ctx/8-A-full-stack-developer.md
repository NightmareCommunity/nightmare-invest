# Task 8-A — PDF Statement Generation + Investor Documents Vault

**Agent:** full-stack-developer
**Date:** 2026-07-05
**Task ID:** 8-A

## Context

The NIGHTMARE INVEST crypto hedge fund portal (Next.js 16 + Prisma SQLite + JWT auth + Tailwind dark-luxury-gold theme) needed a complete PDF statement generation system and investor documents vault. The task brief specified 8 parts: install pdfkit, add Document Prisma model, build PDF generation lib, create 6 API endpoints, build investor + admin documents pages, wire into store/router/nav, seed 5 historical documents, and verify everything works.

## What I Found On Arrival

The entire feature surface had already been scaffolded by an earlier round (probably an unfinished run of this same task):
- `src/lib/pdf.ts` (576 lines) — full institutional PDF generator
- `src/components/investor/documents.tsx` (350 lines) — investor Document Vault page
- `src/components/admin/documents.tsx` (640 lines) — admin Document Management page
- All 6 API routes (admin generate, investor list, download, admin list, admin delete, admin upload)
- Prisma Document model + User.documents relation
- Schema version bumped to `v10-documents` in `src/lib/db.ts`
- Routes `documents` and `admin-documents` added to `src/lib/store.ts`
- Switch cases wired in `src/app/page.tsx`
- Nav items (FolderArchive icon) wired in `src/components/brand/portal-shell.tsx`
- Seed section 13 in `src/app/api/seed/route.ts` for 5 demo documents
- `pdfkit@0.19.1` and `@types/pdfkit@0.17.6` already installed

## Critical Bug I Fixed

Despite the scaffolding being complete, **none of the PDFs were actually generating at runtime**. The seed was silently swallowing errors via try/catch blocks, and only the text-based trade confirmation succeeded. The 4 PDF statements (April, May, June, H1 tax) all failed.

**Root cause:** `pdfkit` uses `__dirname + '/data/Helvetica.afm'` (see `node_modules/pdfkit/js/pdfkit.js:2460`) to locate its bundled font metric files at runtime. Next.js 16 Turbopack rewrites `__dirname` to a synthetic `/ROOT` placeholder when bundling server code, so at runtime pdfkit tried to open `/ROOT/node_modules/pdfkit/js/data/Helvetica.afm` — which doesn't exist.

**Error from dev.log:**
```
ENOENT: no such file or directory, open '/ROOT/node_modules/pdfkit/js/data/Helvetica.afm'
    at new PDFDocument (src/lib/pdf.ts:83:19)
```

**Fix:** Added `serverExternalPackages: ["pdfkit"]` to `next.config.ts`. This tells Next.js to leave pdfkit as a native Node module (not bundled), preserving the real `__dirname` so font metrics + ICC profile resolve correctly from `node_modules/pdfkit/js/data/`.

After the config change I had to restart the dev server (the prior process was dead — port 3000 wasn't listening) for the change to take effect.

## What I Verified

After the fix, I cleared the partial seed and re-ran `POST /api/seed`. All 5 documents generated successfully:

| Document | Type | Size | On Disk |
|----------|------|------|---------|
| April 2026 Monthly Statement | MONTHLY_STATEMENT | 8039 B | `download/statements/statement-cmqzgpxq-2026-04-seed.pdf` |
| May 2026 Monthly Statement | MONTHLY_STATEMENT | 8039 B | `download/statements/statement-cmqzgpxq-2026-05-seed.pdf` |
| June 2026 Monthly Statement | MONTHLY_STATEMENT | 8200 B | `download/statements/statement-cmqzgpxq-2026-06-seed.pdf` |
| 2026 H1 Tax Statement (Preliminary) | TAX_STATEMENT | 8037 B | `download/statements/tax-2026-H1-cmqzgpxq-seed.pdf` |
| Trade Confirmation ($250K deposit) | TRADE_CONFIRMATION | 633 B | `download/documents/trade-confirm-2026-06-cmqzgpxq-seed.txt` |

`file` command verified each PDF is a valid `PDF document, version 1.3, 8 page(s)`.

## API Verification (curl)

| Endpoint | Method | Auth | Status | Result |
|----------|--------|------|--------|--------|
| `/api/auth/login` | POST | none | 200 | admin login OK |
| `/api/auth/login` | POST | none | 200 | investor login OK |
| `/api/seed` | POST | admin | 200 | All 5 docs seeded, no errors in dev.log |
| `/api/admin/documents` | GET | admin | 200 | Returns docs with `user` relation |
| `/api/documents` | GET | investor | 200 | Returns 5 documents for current user |
| `/api/documents/[id]/download` | GET | investor | 200 | Streams 8200-byte PDF, `Content-Type: application/pdf`, marks `isRead=true` |
| `/api/admin/statements/generate` | POST | admin | 201 | Generated new March 2026 statement PDF + Document record + audit log |

`isRead=true` was confirmed via a direct Prisma query after the download.

## Files I Modified

| File | Change |
|------|--------|
| `next.config.ts` | Added `serverExternalPackages: ["pdfkit"]` with explanatory comment |
| `worklog.md` | Appended Task 8-A entry (this run) |

## Files Already Built To Spec (verified, no changes needed)

- `src/lib/pdf.ts` — PDF generator
- `src/app/api/admin/statements/generate/route.ts` — generate endpoint
- `src/app/api/documents/route.ts` — investor list
- `src/app/api/documents/[id]/download/route.ts` — download endpoint
- `src/app/api/admin/documents/route.ts` — admin list
- `src/app/api/admin/documents/[id]/route.ts` — admin delete + GET
- `src/app/api/admin/documents/upload/route.ts` — multipart upload
- `src/components/investor/documents.tsx` — Investor Document Vault
- `src/components/admin/documents.tsx` — Admin Document Management
- `prisma/schema.prisma` — Document model
- `src/lib/db.ts` — schema v10-documents
- `src/lib/store.ts` — routes wired
- `src/app/page.tsx` — switch cases wired
- `src/components/brand/portal-shell.tsx` — nav items wired
- `src/app/api/seed/route.ts` — section 13 seeds 5 documents

## Lint Status

`bun run lint` exits 0 (clean — no errors, no warnings).

## Notes For Next Agent

- The `serverExternalPackages: ["pdfkit"]` config is **load-bearing**. Removing it will silently break PDF generation (errors are caught in the seed and surface only as missing PDFs).
- If the dev server is restarted, the first PDF request will compile pdfkit fresh (~800ms compile time on first hit), then ~100ms per subsequent generation.
- The investor Documents nav item is placed AFTER Reports and BEFORE Settings (per task spec). The admin Documents nav item is placed AFTER Fund Updates and BEFORE Communications.
- The `StatementData` interface in `src/lib/pdf.ts` is the contract between the generate endpoint and the PDF renderer — extending the PDF layout requires touching both files.
- Statement PDFs include: gold-accented wordmark header, two-column investor/fund info band, position summary with green/red P&L coloring, transaction activity table, 2×2 performance metrics grid, fee disclosure card, and a confidentiality disclaimer footer on every page with page numbers.
