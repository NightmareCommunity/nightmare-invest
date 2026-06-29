import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, safeHandler } from "@/lib/api";

// GET /api/fund/nav — Return NAV history for authenticated users (calculator, charts)
export const GET = safeHandler(async (req: NextRequest) => {
  await requireUser();

  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "365", 10);
  const clampedLimit = Math.min(Math.max(limit, 1), 730);

  const points = await db.nAVPoint.findMany({
    orderBy: { date: "asc" },
    take: clampedLimit,
    select: {
      date: true,
      nav: true,
      aum: true,
    },
  });

  return json({ points });
});
