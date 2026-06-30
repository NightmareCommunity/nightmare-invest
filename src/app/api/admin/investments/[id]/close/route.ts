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

interface CloseInvestmentBody {
  notes?: string;
  finalValue?: number;
}

/**
 * POST /api/admin/investments/[id]/close
 * Closes an investment (ACTIVE or PENDING). Optionally sets a final value,
 * which recalculates profitLoss/roi + writes an InvestmentHistory record.
 * Releases capital + P/L back to the investor's ledger account via an
 * INVESTMENT_RELEASE entry. Sets status to CLOSED and endDate to now.
 */
export const POST = safeHandler(async (req: NextRequest, ctx: RouteCtx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;

  const body = await parseBody<CloseInvestmentBody>(req).catch(() => ({}) as CloseInvestmentBody);

  const existing = await db.investment.findUnique({ where: { id } });
  if (!existing) return error("Investment not found", 404);

  if (!["ACTIVE", "PENDING"].includes(existing.status)) {
    return error(`Investment cannot be closed (current status: ${existing.status})`, 422);
  }

  // Determine final value + recompute P/L + ROI
  const previousValue = existing.currentValue;
  const previousRoi = existing.roiPercent;
  const finalValue =
    typeof body.finalValue === "number" && body.finalValue >= 0
      ? body.finalValue
      : existing.currentValue;

  const profitLoss = finalValue - existing.investedAmount;
  const roiPercent = existing.investedAmount > 0 ? (profitLoss / existing.investedAmount) * 100 : 0;

  const accountId = accountKey(existing.userId, existing.fundId);
  const valueChanged = finalValue !== previousValue;

  const investment = await db.$transaction(async (tx) => {
    // Release capital + P/L back to the investor's ledger
    const lastLedger = await tx.ledgerEntry.findFirst({
      where: { accountId },
      orderBy: { createdAt: "desc" },
    });
    const balanceBefore = lastLedger?.balanceAfter ?? 0;
    const balanceAfter = balanceBefore + finalValue; // capital + P/L returned

    await tx.ledgerEntry.create({
      data: {
        userId: existing.userId,
        accountId,
        amount: finalValue, // positive — capital returned
        type: "INVESTMENT_RELEASE",
        balanceAfter,
        reference: existing.id,
      },
    });

    const updated = await tx.investment.update({
      where: { id },
      data: {
        currentValue: finalValue,
        profitLoss,
        roiPercent,
        status: "CLOSED",
        endDate: existing.endDate ?? new Date(),
        notes: body.notes ?? existing.notes,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        fund: { select: { id: true, name: true, slug: true } },
      },
    });

    if (valueChanged) {
      await tx.investmentHistory.create({
        data: {
          investmentId: id,
          previousValue,
          newValue: finalValue,
          previousRoi,
          newRoi: roiPercent,
          updatedBy: admin.id,
        },
      });
    }

    return updated;
  });

  await audit({
    actorId: admin.id,
    action: "INVESTMENT_CLOSED",
    resourceType: "Investment",
    resourceId: id,
    metadata: {
      finalValue,
      profitLoss,
      roiPercent,
      userId: existing.userId,
      fundId: existing.fundId,
    },
  });

  // Best-effort realtime push to the investor
  await notifyUser(existing.userId, "investment_closed", {
    investmentId: investment.id,
    name: investment.investmentName,
    finalValue,
  });

  return json({ investment });
});
