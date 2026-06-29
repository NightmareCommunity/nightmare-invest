import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { accountKey } from "@/lib/analytics";
import { json, error, parseBody, safeHandler } from "@/lib/api";
import { notifyUser } from "@/lib/realtime";

async function processApproval(req: NextRequest, ctx: { params: Promise<{ id: string }> }, action: "APPROVED" | "REJECTED") {
  const admin = await requireAdmin();
  const { id } = await ctx.params;

  const txn = await db.transaction.findUnique({
    where: { id },
    include: { fund: true, user: true },
  });
  if (!txn) return error("Transaction not found", 404);
  if (txn.status !== "PENDING") return error(`Transaction already ${txn.status.toLowerCase()}`, 422);

  let { notes } = (await parseBody<{ notes?: string }>(req).catch(() => ({ notes: undefined })));

  if (action === "REJECTED") {
    const updated = await db.transaction.update({
      where: { id },
      data: { status: "REJECTED", processedBy: admin.id, processedAt: new Date(), notes: notes ?? txn.notes },
    });
    await audit({
      actorId: admin.id,
      action: "TRANSACTION_REJECTED",
      resourceType: "Transaction",
      resourceId: id,
      metadata: { amount: txn.amount, type: txn.type, userId: txn.userId },
    });
    return json({ transaction: updated });
  }

  // APPROVED — update holding + ledger atomically
  const accountId = accountKey(txn.userId, txn.fundId);

  const result = await db.$transaction(async (tx) => {
    // Lock-ish read of current balance & holding
    const holding = await tx.holding.findUnique({ where: { userId_fundId: { userId: txn.userId, fundId: txn.fundId } } });
    const lastLedger = await tx.ledgerEntry.findFirst({
      where: { accountId },
      orderBy: { createdAt: "desc" },
    });
    const balanceBefore = lastLedger?.balanceAfter ?? 0;

    let newUnits = holding?.units ?? 0;
    let newAvgPrice = holding?.avgPrice ?? 0;
    const currentNav = txn.fund.inceptionNav; // fallback
    const lastNav = await tx.nAVPoint.findFirst({ where: { fundId: txn.fundId }, orderBy: { date: "desc" } });
    const nav = lastNav?.nav ?? currentNav;

    if (txn.type === "DEPOSIT") {
      const unitsBought = txn.amount / nav;
      const totalCost = (holding?.units ?? 0) * (holding?.avgPrice ?? 0) + txn.amount;
      newUnits = (holding?.units ?? 0) + unitsBought;
      newAvgPrice = newUnits > 0 ? totalCost / newUnits : nav;
    } else {
      // WITHDRAWAL
      const unitsSold = txn.amount / nav;
      newUnits = Math.max(0, (holding?.units ?? 0) - unitsSold);
      newAvgPrice = holding?.avgPrice ?? nav;
    }

    if (holding) {
      await tx.holding.update({
        where: { id: holding.id },
        data: { units: newUnits, avgPrice: newAvgPrice },
      });
    } else {
      await tx.holding.create({
        data: { userId: txn.userId, fundId: txn.fundId, units: newUnits, avgPrice: newAvgPrice },
      });
    }

    const signedAmount = txn.type === "DEPOSIT" ? txn.amount : -txn.amount;
    const balanceAfter = balanceBefore + signedAmount;

    const ledger = await tx.ledgerEntry.create({
      data: {
        userId: txn.userId,
        accountId,
        amount: signedAmount,
        type: txn.type,
        balanceAfter,
        reference: txn.id,
      },
    });

    const updated = await tx.transaction.update({
      where: { id },
      data: { status: "APPROVED", processedBy: admin.id, processedAt: new Date(), notes: notes ?? txn.notes },
    });

    return { updated, ledger };
  });

  await audit({
    actorId: admin.id,
    action: "TRANSACTION_APPROVED",
    resourceType: "Transaction",
    resourceId: id,
    metadata: { amount: txn.amount, type: txn.type, userId: txn.userId, ledgerId: result.ledger.id },
  });

  // Real-time notification to the investor
  await notifyUser(txn.userId, "transaction_approved", {
    transactionId: txn.id,
    type: txn.type,
    amount: txn.amount,
    fundName: txn.fund.name,
  });

  return json({ transaction: result.updated, ledger: result.ledger });
}

export const POST = safeHandler(
  (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => processApproval(req, ctx, "APPROVED")
);
