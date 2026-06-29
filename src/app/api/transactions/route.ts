import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);
  const transactions = await db.transaction.findMany({
    where: { userId: user.id },
    include: { fund: true, processor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return json({ transactions });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);
  try {
    const { type, amount, fundId, notes } = await parseBody<{
      type: string;
      amount: number;
      fundId: string;
      notes?: string;
    }>(req);

    if (!["DEPOSIT", "WITHDRAWAL"].includes(type)) return error("Invalid type", 422);
    if (!amount || amount <= 0) return error("Amount must be positive", 422);
    if (!fundId) return error("fundId required", 422);

    const fund = await db.fund.findUnique({ where: { id: fundId } });
    if (!fund) return error("Fund not found", 404);

    if (type === "DEPOSIT" && amount < fund.minInvest) {
      return error(`Minimum investment is $${fund.minInvest.toLocaleString()}`, 422);
    }

    if (type === "WITHDRAWAL") {
      // Ensure user has enough balance
      const holding = await db.holding.findUnique({ where: { userId_fundId: { userId: user.id, fundId } } });
      const lastNav = await db.nAVPoint.findFirst({ where: { fundId }, orderBy: { date: "desc" } });
      const currentNav = lastNav?.nav ?? fund.inceptionNav;
      const currentValue = holding ? holding.units * currentNav : 0;
      if (currentValue < amount) {
        return error(`Withdrawal exceeds current portfolio value ($${currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`, 422);
      }
    }

    const txn = await db.transaction.create({
      data: { userId: user.id, fundId, type, amount, notes: notes ?? null, status: "PENDING" },
    });
    await audit({
      actorId: user.id,
      action: "TRANSACTION_REQUESTED",
      resourceType: "Transaction",
      resourceId: txn.id,
      metadata: { type, amount, fundId },
    });
    return json({ transaction: txn });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Failed to create transaction", 500);
  }
}
