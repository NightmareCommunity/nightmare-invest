import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getPortfolioSummary, getFundMetrics } from "@/lib/analytics";
import { json, error } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);

  const fund = await db.fund.findFirst({ where: { isActive: true }, include: { allocations: true } });
  if (!fund) return error("No active fund", 404);

  const summary = await getPortfolioSummary(user.id, fund.id);
  const metrics = await getFundMetrics(fund.id);
  const holding = await db.holding.findUnique({ where: { userId_fundId: { userId: user.id, fundId: fund.id } } });

  return json({
    fund: { id: fund.id, name: fund.name, slug: fund.slug, minInvest: fund.minInvest, feeStructure: fund.feeStructure, description: fund.description, inceptionNav: fund.inceptionNav },
    holding: holding
      ? { units: holding.units, avgPrice: holding.avgPrice, updatedAt: holding.updatedAt }
      : null,
    summary,
    metrics,
    allocations: fund.allocations,
  });
}
