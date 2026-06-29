import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { json, error } from "@/lib/api";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // PENDING | APPROVED | REJECTED
  const type = searchParams.get("type"); // DEPOSIT | WITHDRAWAL

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const transactions = await db.transaction.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      fund: { select: { id: true, name: true, slug: true } },
      processor: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return json({ transactions });
}

export async function POST(req: NextRequest) {
  // Create transaction on behalf of a user (admin override)
  const admin = await requireAdmin();
  try {
    const { userId, fundId, type, amount, notes } = await parseBodyHelper(req);
    if (!userId || !fundId || !type || !amount) return error("Missing fields", 422);
    const txn = await db.transaction.create({
      data: { userId, fundId, type, amount, notes, status: "PENDING", processedBy: admin.id },
    });
    return json({ transaction: txn });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Failed", 500);
  }
}

async function parseBodyHelper(req: NextRequest) {
  try {
    return (await req.json()) as { userId: string; fundId: string; type: string; amount: number; notes?: string };
  } catch {
    return {} as { userId: string; fundId: string; type: string; amount: number; notes?: string };
  }
}
