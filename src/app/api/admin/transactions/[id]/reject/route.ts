import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody, safeHandler } from "@/lib/api";
import { notifyUser } from "@/lib/realtime";

async function handle(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await ctx.params;

  const { notes } = await parseBody<{ notes?: string }>(req).catch(() => ({ notes: undefined }));

  const txn = await db.transaction.findUnique({ where: { id } });
  if (!txn) return error("Transaction not found", 404);
  if (txn.status !== "PENDING") return error(`Transaction already ${txn.status.toLowerCase()}`, 422);

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

  // Real-time notification to the investor
  await notifyUser(txn.userId, "transaction_rejected", {
    transactionId: txn.id,
    type: txn.type,
    amount: txn.amount,
    reason: notes ?? null,
  });

  return json({ transaction: updated });
}

export const POST = safeHandler(handle);
