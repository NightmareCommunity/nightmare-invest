import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { json, error } from "@/lib/api";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fundId = searchParams.get("fundId");
  const range = searchParams.get("range") ?? "ALL"; // 1D 1W 1M 1Y ALL

  if (!fundId) return error("fundId required", 422);

  const points = await db.nAVPoint.findMany({
    where: { fundId },
    orderBy: { date: "asc" },
  });

  const now = Date.now();
  const dayMs = 86400000;
  const cutoffs: Record<string, number> = {
    "1D": now - 1 * dayMs,
    "1W": now - 7 * dayMs,
    "1M": now - 30 * dayMs,
    "1Y": now - 365 * dayMs,
    ALL: 0,
  };
  const cutoff = cutoffs[range] ?? 0;
  const filtered = points.filter((p) => p.date.getTime() >= cutoff);

  return NextResponse.json(
    filtered.map((p) => ({ date: p.date.toISOString(), nav: p.nav, aum: p.aum }))
  );
}
