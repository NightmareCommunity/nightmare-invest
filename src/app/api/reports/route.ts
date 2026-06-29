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
  const transactions = await db.transaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const ledger = await db.ledgerEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return json({
    generatedAt: new Date().toISOString(),
    investor: { id: user.id, name: user.name, email: user.email, since: user.createdAt },
    fund: { name: fund.name, slug: fund.slug, feeStructure: fund.feeStructure, minInvest: fund.minInvest },
    summary,
    metrics,
    allocations: fund.allocations,
    transactions,
    ledger,
  });
}
