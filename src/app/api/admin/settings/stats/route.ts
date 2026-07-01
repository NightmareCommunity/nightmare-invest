import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { json, safeHandler } from "@/lib/api";
import { stat } from "fs/promises";

/**
 * GET /api/admin/settings/stats
 * Returns platform statistics for the Admin Settings dashboard.
 */
export const GET = safeHandler(async () => {
  await requireAdmin();

  const [admins, investors, transactions, navPoints] = await Promise.all([
    db.user.count({ where: { role: "ADMIN" } }),
    db.user.count({ where: { role: "USER" } }),
    db.transaction.count(),
    db.nAVPoint.count(),
  ]);

  // Database file size
  let dbSizeBytes = 0;
  try {
    const st = await stat("/home/z/my-project/db/custom.db");
    dbSizeBytes = st.size;
  } catch {
    /* ignore */
  }

  return json({ admins, investors, transactions, navPoints, dbSizeBytes });
});
