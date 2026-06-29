import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { json } from "@/lib/api";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const actorId = searchParams.get("actorId");
  const where: Record<string, unknown> = {};
  if (action) where.action = { contains: action };
  if (actorId) where.actorId = actorId;

  const logs = await db.auditLog.findMany({
    where,
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { timestamp: "desc" },
    take: 500,
  });
  return json({ logs });
}
