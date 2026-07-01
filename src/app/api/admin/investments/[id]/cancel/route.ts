import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { accountKey } from "@/lib/analytics";
import { json, error, parseBody, safeHandler } from "@/lib/api";
import { notifyUser } from "@/lib/realtime";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

interface CancelInvestmentBody {
  notes?: string;
}

/**
 * POST /api/admin/investments/[id]/cancel
 * Cancels an investment (PENDING or ACTIVE). Sets status to CANCELLED.
 * If the investment was ACTIVE (capital was allocated), releases the
 * investedAmount back via an INVESTMENT_RELEASE ledger entry.
 */
export const POST = safeHandler(async (req: NextRequest, ctx: RouteCtx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;

  const body = await parseBody<CancelInvestmentBody>(req).catch(() => ({}) as CancelInvestmentBody);

  const existing = await db.investment.findUnique({ where: { id } });
  if (!existing) return error("Investment not found", 404);

  if (!["PENDING", "ACTIVE"].includes(existing.status)) {
    return error(`Investment cannot be cancelled (current status: ${existing.status})`, 422);
  }

  const wasActive = existing.status === "ACTIVE";
  const accountId = accountKey(existing.userId, existing.fundId);

  const investment = await db.$transaction(async (tx) => {
    // If capital was allocated (ACTIVE), release the invested amount back.
    if (wasActive) {
      const lastLedger = await tx.ledgerEntry.findFirst({
        where: { accountId },
        orderBy: { createdAt: "desc" },
      });
      const balanceBefore = lastLedger?.balanceAfter ?? 0;
      const balanceAfter = balanceBefore + existing.investedAmount;

      await tx.ledgerEntry.create({
        data: {
          userId: existing.userId,
          accountId,
          amount: existing.investedAmount, // positive — capital returned (no P/L on cancel)
          type: "INVESTMENT_RELEASE",
          balanceAfter,
          reference: existing.id,
        },
      });
    }

    const updated = await tx.investment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        notes: body.notes ?? existing.notes,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        fund: { select: { id: true, name: true, slug: true } },
      },
    });

    return updated;
  });

  await audit({
    actorId: admin.id,
    action: "INVESTMENT_CANCELLED",
    resourceType: "Investment",
    resourceId: id,
    metadata: {
      userId: existing.userId,
      fundId: existing.fundId,
      previousStatus: existing.status,
      investedAmount: existing.investedAmount,
      capitalReleased: wasActive ? existing.investedAmount : 0,
    },
  });

  // Best-effort realtime push to the investor
  await notifyUser(existing.userId, "investment_cancelled", {
    investmentId: investment.id,
    name: investment.investmentName,
    investedAmount: existing.investedAmount,
  });

  return json({ investment });
});
