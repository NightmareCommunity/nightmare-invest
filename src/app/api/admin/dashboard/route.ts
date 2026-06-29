import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getFundMetrics } from "@/lib/analytics";
import { json } from "@/lib/api";

export async function GET() {
  await requireAdmin();
  const fund = await db.fund.findFirst({ include: { allocations: true } });

  const [investors, pendingDeposits, pendingWithdrawals, approvedTxns, totalUsers] = await Promise.all([
    db.user.count({ where: { role: "USER", isActive: true } }),
    db.transaction.count({ where: { type: "DEPOSIT", status: "PENDING" } }),
    db.transaction.count({ where: { type: "WITHDRAWAL", status: "PENDING" } }),
    db.transaction.findMany({ where: { status: "APPROVED" }, select: { amount: true, type: true } }),
    db.user.count(),
  ]);

  const totalAum = fund
    ? (await db.nAVPoint.findFirst({ where: { fundId: fund.id }, orderBy: { date: "desc" } }))?.aum ?? 0
    : 0;

  const metrics = fund ? await getFundMetrics(fund.id) : null;

  const depositVolume = approvedTxns.filter((t) => t.type === "DEPOSIT").reduce((a, b) => a + b.amount, 0);
  const withdrawalVolume = approvedTxns.filter((t) => t.type === "WITHDRAWAL").reduce((a, b) => a + b.amount, 0);

  // AUM trend (most recent 60 NAV points, returned chronologically)
  const navTrend = fund
    ? (await db.nAVPoint.findMany({ where: { fundId: fund.id }, orderBy: { date: "desc" }, take: 60 }))
        .reverse()
        .map((p) => ({
          date: p.date.toISOString(),
          nav: p.nav,
          aum: p.aum ?? 0,
        }))
    : [];

  return json({
    fund,
    metrics,
    totalAum,
    totalUsers,
    activeInvestors: investors,
    pendingDeposits,
    pendingWithdrawals,
    depositVolume,
    withdrawalVolume,
    navTrend,
  });
}
