import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody } from "@/lib/api";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  try {
    const { fundId, nav, aum, date } = await parseBody<{ fundId: string; nav: number; aum?: number; date?: string }>(req);
    if (!fundId || !nav || nav <= 0) return error("fundId and positive nav required", 422);

    const d = date ? new Date(date) : new Date();
    // normalise to start of day
    d.setHours(0, 0, 0, 0);

    const point = await db.nAVPoint.upsert({
      where: { fundId_date: { fundId, date: d } },
      update: { nav, aum: aum ?? null },
      create: { fundId, date: d, nav, aum: aum ?? null },
    });

    await audit({
      actorId: admin.id,
      action: "NAV_UPDATED",
      resourceType: "NAVPoint",
      resourceId: point.id,
      metadata: { fundId, nav, aum, date: d.toISOString() },
    });

    return json({ point });
  } catch (e) {
    return error(e instanceof Error ? e.message : "NAV update failed", 500);
  }
}

export async function GET() {
  await requireAdmin();
  const points = await db.nAVPoint.findMany({ orderBy: { date: "desc" }, take: 90, include: { fund: { select: { name: true } } } });
  return json({ points });
}
