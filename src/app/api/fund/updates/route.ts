import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { json } from "@/lib/api";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
  if (category) where.category = category;

  const updates = await db.fundUpdate.findMany({
    where,
    include: { author: { select: { name: true, email: true } } },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return json({ updates });
}
