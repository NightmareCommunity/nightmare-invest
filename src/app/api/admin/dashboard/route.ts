import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getFundMetrics } from "@/lib/analytics";
import { json } from "@/lib/api";

export async function GET() {
  await requireAdmin();
  const fund = await db.fund.findFirst({ include: { allocations: true } });

  const [investors, pendingDeposits, pendingWithdrawals, approvedTxns, totalUsers, pendingKyc, kycStats] = await Promise.all([
    db.user.count({ where: { role: "USER", isActive: true } }),
    db.transaction.count({ where: { type: "DEPOSIT", status: "PENDING" } }),
    db.transaction.count({ where: { type: "WITHDRAWAL", status: "PENDING" } }),
    db.transaction.findMany({ where: { status: "APPROVED" }, select: { amount: true, type: true } }),
    db.user.count(),
    db.kycDocument.count({ where: { status: "PENDING" } }),
    db.user.groupBy({
      by: ["kycStatus"],
      where: { role: "USER" },
      _count: { _all: true },
    }),
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

  const kycBreakdown = kycStats.reduce<Record<string, number>>((acc, s) => {
    acc[s.kycStatus] = s._count._all;
    return acc;
  }, {});

  return json({
    fund,
    metrics,
    totalAum,
    totalUsers,
    activeInvestors: investors,
    pendingDeposits,
    pendingWithdrawals,
    pendingKyc,
    kycBreakdown,
    depositVolume,
    withdrawalVolume,
    navTrend,
  });
}
