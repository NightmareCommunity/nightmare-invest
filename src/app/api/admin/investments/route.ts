import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { accountKey } from "@/lib/analytics";
import { json, error, parseBody, safeHandler } from "@/lib/api";

/**
 * GET /api/admin/investments
 * Returns all investments with user + fund + latest history record.
 * Optional query params:
 *   - status: filter by status (PENDING | ACTIVE | COMPLETED | CLOSED | CANCELLED)
 *   - q:      search investmentName or user email (case-insensitive)
 */
export const GET = safeHandler(async (req: NextRequest) => {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status")?.trim();
  const q = searchParams.get("q")?.trim();

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { investmentName: { contains: q } },
      { user: { email: { contains: q } } },
    ];
  }

  const investments = await db.investment.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      fund: { select: { id: true, name: true, slug: true } },
      history: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return json({ investments });
});

interface CreateInvestmentBody {
  userId: string;
  fundId: string;
  investmentName: string;
  investedAmount: number;
  currentValue?: number;
  startDate: string;
  endDate?: string;
  durationDays?: number;
  notes?: string;
}

/**
 * POST /api/admin/investments
 * Admin creates a new investment position on behalf of an investor.
 * Auto-calculates profitLoss + roiPercent, allocates capital via ledger
 * (INVESTMENT_ALLOC), defaults status to ACTIVE.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const admin = await requireAdmin();

  const body = await parseBody<CreateInvestmentBody>(req);
  const { userId, fundId, investmentName, investedAmount, startDate, endDate, notes } = body;

  if (!userId) return error("userId required", 422);
  if (!fundId) return error("fundId required", 422);
  if (!investmentName || typeof investmentName !== "string") return error("investmentName required", 422);
  if (typeof investedAmount !== "number" || investedAmount <= 0) {
    return error("investedAmount must be a positive number", 422);
  }
  if (!startDate) return error("startDate required", 422);

  // Validate user + fund exist
  const [user, fund] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true } }),
    db.fund.findUnique({ where: { id: fundId }, select: { id: true } }),
  ]);
  if (!user) return error("User not found", 404);
  if (!fund) return error("Fund not found", 404);

  const currentValue = typeof body.currentValue === "number" && body.currentValue >= 0
    ? body.currentValue
    : investedAmount;

  const profitLoss = currentValue - investedAmount;
  const roiPercent = investedAmount > 0 ? (profitLoss / investedAmount) * 100 : 0;

  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return error("Invalid startDate", 422);

  let end: Date | null = null;
  if (endDate) {
    end = new Date(endDate);
    if (Number.isNaN(end.getTime())) return error("Invalid endDate", 422);
  }

  // durationDays: explicit > computed from start/end > 0
  let durationDays = 0;
  if (typeof body.durationDays === "number" && body.durationDays >= 0) {
    durationDays = body.durationDays;
  } else if (end) {
    durationDays = Math.max(
      0,
      Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
    );
  }

  const accountId = accountKey(userId, fundId);

  const investment = await db.$transaction(async (tx) => {
    // Compute current ledger balance for this account
    const lastLedger = await tx.ledgerEntry.findFirst({
      where: { accountId },
      orderBy: { createdAt: "desc" },
    });
    const balanceBefore = lastLedger?.balanceAfter ?? 0;
    const balanceAfter = balanceBefore - investedAmount; // capital locked

    const created = await tx.investment.create({
      data: {
        userId,
        fundId,
        investmentName,
        investedAmount,
        currentValue,
        profitLoss,
        roiPercent,
        startDate: start,
        endDate: end,
        durationDays,
        status: "ACTIVE",
        notes: notes ?? null,
        createdBy: admin.id,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        userId,
        accountId,
        amount: -investedAmount,
        type: "INVESTMENT_ALLOC",
        balanceAfter,
        reference: created.id,
      },
    });

    return created;
  });

  await audit({
    actorId: admin.id,
    action: "INVESTMENT_CREATED",
    resourceType: "Investment",
    resourceId: investment.id,
    metadata: {
      userId,
      fundId,
      investedAmount,
      currentValue,
      name: investmentName,
      status: investment.status,
    },
  });

  return json({ investment });
});
