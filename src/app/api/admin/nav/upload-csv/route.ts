import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, safeHandler } from "@/lib/api";

/**
 * POST /api/admin/nav/upload-csv
 * Bulk import NAV points from a CSV file.
 *
 * Expected CSV format (header row required):
 *   date,nav,aum
 *   2026-01-01,152.3456,64000000
 *   2026-01-02,153.2100,64500000
 *
 * - `aum` column is optional (leave blank or omit values).
 * - Existing entries for the same fund+date are upserted (overwritten).
 * - Returns a summary of inserted/updated/skipped rows.
 *
 * Body: multipart form-data with fields:
 *   - fundId: string
 *   - file: CSV file (text/csv or text/plain)
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const admin = await requireAdmin();

  const formData = await req.formData();
  const fundId = formData.get("fundId") as string | null;
  const file = formData.get("file") as File | null;

  if (!fundId) return error("fundId is required", 422);
  if (!file) return error("CSV file is required", 422);

  // Verify fund exists
  const fund = await db.fund.findUnique({ where: { id: fundId } });
  if (!fund) return error("Fund not found", 404);

  // Read and parse CSV
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length < 2) {
    return error("CSV must contain a header row and at least one data row", 422);
  }

  // Parse header — find column indices
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateIdx = header.indexOf("date");
  const navIdx = header.indexOf("nav");
  const aumIdx = header.indexOf("aum");

  if (dateIdx === -1 || navIdx === -1) {
    return error("CSV must contain 'date' and 'nav' columns", 422);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const dateStr = cols[dateIdx];
    const navStr = cols[navIdx];
    const aumStr = aumIdx >= 0 ? cols[aumIdx] : "";

    if (!dateStr || !navStr) {
      skipped++;
      errors.push({ row: i + 1, message: "Missing date or nav value" });
      continue;
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      skipped++;
      errors.push({ row: i + 1, message: `Invalid date: '${dateStr}'` });
      continue;
    }

    const nav = parseFloat(navStr);
    if (isNaN(nav) || nav <= 0) {
      skipped++;
      errors.push({ row: i + 1, message: `Invalid NAV: '${navStr}'` });
      continue;
    }

    const aum = aumStr ? parseFloat(aumStr) : null;
    if (aumStr && (isNaN(aum as number) || (aum as number) < 0)) {
      skipped++;
      errors.push({ row: i + 1, message: `Invalid AUM: '${aumStr}'` });
      continue;
    }

    // Normalise to start of day
    date.setHours(0, 0, 0, 0);

    // Check if exists (for upsert counting)
    const existing = await db.nAVPoint.findUnique({
      where: { fundId_date: { fundId, date } },
    });

    await db.nAVPoint.upsert({
      where: { fundId_date: { fundId, date } },
      update: { nav, aum: aum ?? null },
      create: { fundId, date, nav, aum: aum ?? null },
    });

    if (existing) updated++;
    else inserted++;
  }

  await audit({
    actorId: admin.id,
    action: "NAV_CSV_IMPORTED",
    resourceType: "NAVPoint",
    resourceId: fundId,
    metadata: { fundId, inserted, updated, skipped, errorCount: errors.length },
  });

  return json({
    ok: true,
    summary: {
      total: lines.length - 1,
      inserted,
      updated,
      skipped,
      errors: errors.slice(0, 10), // first 10 errors for display
    },
  });
});
