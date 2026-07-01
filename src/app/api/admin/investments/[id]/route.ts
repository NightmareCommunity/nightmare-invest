import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody, safeHandler } from "@/lib/api";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/investments/[id]
 * Returns a single investment with user + fund + full history (desc).
 */
export const GET = safeHandler(async (_req: NextRequest, ctx: RouteCtx) => {
  await requireAdmin();
  const { id } = await ctx.params;

  const investment = await db.investment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      fund: { select: { id: true, name: true, slug: true } },
      history: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!investment) return error("Investment not found", 404);
  return json({ investment });
});

interface UpdateInvestmentBody {
  investmentName?: string;
  investedAmount?: number;
  currentValue?: number;
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  status?: string;
  notes?: string;
}

/**
 * PUT /api/admin/investments/[id]
 * Updates editable investment fields. If `currentValue` changes, auto-
 * recalculates profitLoss + roiPercent AND appends an InvestmentHistory
 * record (previousValue/newValue/previousRoi/newRoi).
 */
export const PUT = safeHandler(async (req: NextRequest, ctx: RouteCtx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;

  const existing = await db.investment.findUnique({ where: { id } });
  if (!existing) return error("Investment not found", 404);

  const body = await parseBody<UpdateInvestmentBody>(req);

  // Build update payload (only fields that were provided)
  const data: Record<string, unknown> = {};
  const changes: Record<string, unknown> = {};

  if (typeof body.investmentName === "string" && body.investmentName !== existing.investmentName) {
    data.investmentName = body.investmentName;
    changes.investmentName = { from: existing.investmentName, to: body.investmentName };
  }
  if (typeof body.investedAmount === "number" && body.investedAmount >= 0 && body.investedAmount !== existing.investedAmount) {
    data.investedAmount = body.investedAmount;
    changes.investedAmount = { from: existing.investedAmount, to: body.investedAmount };
  }
  if (typeof body.status === "string" && body.status !== existing.status) {
    data.status = body.status;
    changes.status = { from: existing.status, to: body.status };
  }
  if (body.notes !== undefined && body.notes !== existing.notes) {
    data.notes = body.notes ?? null;
    changes.notes = { from: existing.notes, to: body.notes ?? null };
  }
  if (typeof body.startDate === "string") {
    const start = new Date(body.startDate);
    if (Number.isNaN(start.getTime())) return error("Invalid startDate", 422);
    data.startDate = start;
    changes.startDate = { from: existing.startDate, to: start };
  }
  if (body.endDate !== undefined) {
    if (body.endDate === null) {
      data.endDate = null;
      changes.endDate = { from: existing.endDate, to: null };
    } else if (typeof body.endDate === "string") {
      const end = new Date(body.endDate);
      if (Number.isNaN(end.getTime())) return error("Invalid endDate", 422);
      data.endDate = end;
      changes.endDate = { from: existing.endDate, to: end };
    }
  }
  if (typeof body.durationDays === "number" && body.durationDays >= 0) {
    data.durationDays = body.durationDays;
    changes.durationDays = { from: existing.durationDays, to: body.durationDays };
  }

  // currentValue handling — drives ROI recalculation + history
  let nextCurrentValue = existing.currentValue;
  if (typeof body.currentValue === "number" && body.currentValue >= 0 && body.currentValue !== existing.currentValue) {
    nextCurrentValue = body.currentValue;
    data.currentValue = nextCurrentValue;
    changes.currentValue = { from: existing.currentValue, to: nextCurrentValue };
  }

  // If currentValue OR investedAmount changed, recompute profitLoss + roiPercent
  if (data.currentValue !== undefined || data.investedAmount !== undefined) {
    const newInvested = typeof data.investedAmount === "number" ? data.investedAmount : existing.investedAmount;
    const profitLoss = nextCurrentValue - newInvested;
    const roiPercent = newInvested > 0 ? (profitLoss / newInvested) * 100 : 0;
    data.profitLoss = profitLoss;
    data.roiPercent = roiPercent;
    changes.profitLoss = { from: existing.profitLoss, to: profitLoss };
    changes.roiPercent = { from: existing.roiPercent, to: roiPercent };
  }

  // No changes? Return existing.
  if (Object.keys(data).length === 0) {
    return json({ investment: existing });
  }

  const previousValue = existing.currentValue;
  const previousRoi = existing.roiPercent;
  const newValue = nextCurrentValue;
  const newRoi = typeof data.roiPercent === "number" ? data.roiPercent : existing.roiPercent;
  const valueChanged = data.currentValue !== undefined;

  const investment = await db.$transaction(async (tx) => {
    const updated = await tx.investment.update({
      where: { id },
      data,
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
          newValue,
          previousRoi,
          newRoi,
          updatedBy: admin.id,
        },
      });
    }

    return updated;
  });

  await audit({
    actorId: admin.id,
    action: "INVESTMENT_UPDATED",
    resourceType: "Investment",
    resourceId: id,
    metadata: { changes },
  });

  return json({ investment });
});
