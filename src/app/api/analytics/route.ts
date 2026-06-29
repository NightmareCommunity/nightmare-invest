import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getAdvancedAnalytics } from "@/lib/analytics";
import { json, error } from "@/lib/api";

// GET /api/analytics — advanced risk analytics for the active fund.
// Available to any authenticated user (investors + admins).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);

  const fund = await db.fund.findFirst({ where: { isActive: true } });
  if (!fund) return error("No active fund", 404);

  const analytics = await getAdvancedAnalytics(fund.id);
  if (!analytics) return error("Insufficient data for analytics", 422);

  return json({
    fund: { id: fund.id, name: fund.name, slug: fund.slug },
    analytics,
  });
}
