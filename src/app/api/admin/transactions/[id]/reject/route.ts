import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody } from "@/lib/api";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  try {
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
    return json({ transaction: updated });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Rejection failed", 500);
  }
}
