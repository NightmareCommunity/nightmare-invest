import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { verifyAuditChain } from "@/lib/audit";
import { json, safeHandler } from "@/lib/api";

export const GET = safeHandler(async (req: NextRequest) => {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const actorId = searchParams.get("actorId");
  const where: Record<string, unknown> = {};
  if (action) where.action = { contains: action };
  if (actorId) where.actorId = actorId;

  const [logs, chainVerification] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { timestamp: "desc" },
      take: 500,
    }),
    verifyAuditChain(1000),
  ]);

  return json({ logs, chainVerification });
});
