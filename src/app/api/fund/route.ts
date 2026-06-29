import { db } from "@/lib/db";
import { getFundMetrics } from "@/lib/analytics";
import { json } from "@/lib/api";

export async function GET() {
  const fund = await db.fund.findFirst({ where: { isActive: true }, include: { allocations: true } });
  if (!fund) return json({ fund: null });
  const metrics = await getFundMetrics(fund.id);
  return json({ fund, metrics });
}
