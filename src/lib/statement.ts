import { db } from "./db";
import {
  generateMonthlyStatement,
  savePdfToDisk,
  type StatementData,
} from "./pdf";

/**
 * Build a fully-hydrated StatementData object for the given investor + period,
 * then generate the PDF and persist it as a Document record.
 *
 * Shared by:
 *   - POST /api/admin/statements/generate (direct admin generation)
 *   - POST /api/admin/statement-requests/[id]/fulfill (fulfilling an investor request)
 *
 * Returns the newly-created Document row.
 */
export async function generateStatementForInvestor(params: {
  investorId: string;
  periodStart: Date;
  periodEnd: Date;
  type?: string; // MONTHLY_STATEMENT | QUARTERLY_REPORT | TAX_STATEMENT | CUSTOM
  generatedBy: string; // admin userId
}): Promise<{
  documentId: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  title: string;
  periodStr: string;
}> {
  const { investorId, periodStart, periodEnd, generatedBy } = params;
  const type = params.type ?? "MONTHLY_STATEMENT";

  const investor = await db.user.findUnique({ where: { id: investorId } });
  if (!investor) throw new Error("Investor not found");
  if (investor.role === "ADMIN") throw new Error("Cannot generate statements for admin accounts");

  const fund = await db.fund.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!fund) throw new Error("No active fund found");

  // NAV points inside the period + a pre-period anchor for the start NAV
  const navPoints = await db.nAVPoint.findMany({
    where: { fundId: fund.id, date: { gte: periodStart, lte: periodEnd } },
    orderBy: { date: "asc" },
  });
  const prePeriodNav = await db.nAVPoint.findFirst({
    where: { fundId: fund.id, date: { lt: periodStart } },
    orderBy: { date: "desc" },
  });

  const navStart = prePeriodNav?.nav ?? navPoints[0]?.nav ?? fund.inceptionNav;
  const navEnd = navPoints[navPoints.length - 1]?.nav ?? fund.inceptionNav;
  const aum = navPoints[navPoints.length - 1]?.aum ?? 0;

  const holding = await db.holding.findUnique({
    where: { userId_fundId: { userId: investor.id, fundId: fund.id } },
  });
  const unitsEnd = holding?.units ?? 0;
  const avgCost = holding?.avgPrice ?? navStart;

  // Approximate unitsStart by undoing the period's approved transactions at navEnd
  const periodTxns = await db.transaction.findMany({
    where: {
      userId: investor.id,
      fundId: fund.id,
      status: "APPROVED",
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    orderBy: { createdAt: "asc" },
  });
  let unitsStart = unitsEnd;
  for (const tx of periodTxns) {
    if (tx.type === "DEPOSIT") unitsStart -= tx.amount / navEnd;
    else if (tx.type === "WITHDRAWAL") unitsStart += tx.amount / navEnd;
  }
  if (!isFinite(unitsStart) || unitsStart < 0) unitsStart = unitsEnd;

  const currentValue = unitsEnd * navEnd;
  const unrealizedPnl = currentValue - unitsEnd * avgCost;

  // Performance metrics
  const periodReturnPct = navStart > 0 ? ((navEnd - navStart) / navStart) * 100 : 0;
  const inceptionReturnPct =
    fund.inceptionNav > 0 ? ((navEnd - fund.inceptionNav) / fund.inceptionNav) * 100 : 0;

  // Sharpe + drawdown from NAV series
  const navSeries = navPoints.map((p) => p.nav);
  let sharpe = 0;
  if (navSeries.length > 1) {
    const returns: number[] = [];
    for (let i = 1; i < navSeries.length; i++) {
      if (navSeries[i - 1] > 0) {
        returns.push((navSeries[i] - navSeries[i - 1]) / navSeries[i - 1]);
      }
    }
    if (returns.length > 0) {
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance =
        returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
      const std = Math.sqrt(variance);
      sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0;
    }
  }
  let maxDrawdown = 0;
  if (navSeries.length > 1) {
    let peak = navSeries[0];
    for (const v of navSeries) {
      if (v > peak) peak = v;
      const dd = peak > 0 ? ((v - peak) / peak) * 100 : 0;
      if (dd < maxDrawdown) maxDrawdown = dd;
    }
  }

  // All transactions (any status) for the activity table
  const allTxns = await db.transaction.findMany({
    where: {
      userId: investor.id,
      createdAt: { gte: periodStart, lte: periodEnd },
    },
    orderBy: { createdAt: "asc" },
  });

  // Parse fee structure
  const mgmtMatch = fund.feeStructure.match(/(\d+\.?\d*)%/);
  const perfMatch = fund.feeStructure.match(/(\d+\.?\d*)%\s*performance/);
  const mgmtPct = mgmtMatch ? mgmtMatch[1] : "2";
  const perfPct = perfMatch ? perfMatch[1] : "20";

  const statementData: StatementData = {
    investorName: investor.name,
    investorEmail: investor.email,
    investorId: investor.id,
    kycTier: investor.kycTier || "STANDARD",
    fundName: fund.name,
    fundDescription: fund.description,
    periodStart,
    periodEnd,
    navStart,
    navEnd,
    aum,
    unitsStart,
    unitsEnd,
    avgCost,
    currentValue,
    unrealizedPnl,
    periodReturnPct,
    inceptionReturnPct,
    sharpe,
    maxDrawdown,
    managementFee: `${mgmtPct}% annualized`,
    performanceFee: `${perfPct}% with high-water mark`,
    transactions: allTxns.map((t) => ({
      date: t.createdAt,
      type: t.type,
      amount: t.amount,
      status: t.status,
    })),
  };

  const pdfBuffer = await generateMonthlyStatement(statementData);

  // Period string + title (varies by type)
  const startMonth = periodStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const periodStr =
    type === "QUARTERLY_REPORT"
      ? `${periodStart.getFullYear()}-Q${Math.floor(periodStart.getMonth() / 3) + 1}`
      : `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`;

  const titleByType: Record<string, string> = {
    MONTHLY_STATEMENT: `${startMonth} Monthly Statement`,
    QUARTERLY_REPORT: `${periodStr.toUpperCase()} Quarterly Report`,
    TAX_STATEMENT: `Tax Statement — ${startMonth}`,
    CUSTOM: `Custom Statement (${periodStart.toLocaleDateString()} – ${periodEnd.toLocaleDateString()})`,
  };

  const fileName = `statement-${investor.id.slice(0, 8)}-${periodStr}-${type}-${Date.now()}.pdf`;
  const filePath = await savePdfToDisk(pdfBuffer, fileName);

  const doc = await db.document.create({
    data: {
      userId: investor.id,
      title: titleByType[type] ?? titleByType.MONTHLY_STATEMENT,
      type: type === "CUSTOM" ? "CUSTOM" : type,
      period: periodStr,
      description: `Official ${type.toLowerCase().replace(/_/g, " ")} for ${startMonth}.`,
      fileName,
      filePath,
      mimeType: "application/pdf",
      sizeBytes: pdfBuffer.length,
      generatedBy,
      isRead: false,
    },
  });

  return {
    documentId: doc.id,
    fileName: doc.fileName,
    filePath: doc.filePath,
    sizeBytes: pdfBuffer.length,
    title: doc.title,
    periodStr,
  };
}
