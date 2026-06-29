import { db } from "@/lib/db";
import { getFundMetrics } from "@/lib/analytics";
import { json, error } from "@/lib/api";

export async function GET() {
  const fund = await db.fund.findFirst({ where: { isActive: true } });
  if (!fund) return error("No active fund", 404);
  const metrics = await getFundMetrics(fund.id);
  return json(metrics);
}
