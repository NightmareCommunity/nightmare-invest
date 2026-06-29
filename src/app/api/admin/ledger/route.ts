import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { json, safeHandler } from "@/lib/api";

export const GET = safeHandler(async (req: NextRequest) => {
  await requireAdmin();
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const where = userId ? { userId } : {};
  const entries = await db.ledgerEntry.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return json({ entries });
});
