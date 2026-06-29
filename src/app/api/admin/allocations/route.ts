import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody } from "@/lib/api";

// Replace all allocations for a fund
export async function PUT(req: NextRequest) {
  const admin = await requireAdmin();
  try {
    const { fundId, allocations } = await parseBody<{
      fundId: string;
      allocations: { asset: string; weight: number; color: string }[];
    }>(req);
    if (!fundId) return error("fundId required", 422);
    const total = allocations.reduce((a, b) => a + b.weight, 0);
    if (Math.abs(total - 100) > 0.5) return error(`Allocations must total 100% (got ${total}%)`, 422);

    await db.$transaction(async (tx) => {
      await tx.allocation.deleteMany({ where: { fundId } });
      for (const a of allocations) {
        await tx.allocation.create({ data: { fundId, asset: a.asset, weight: a.weight, color: a.color } });
      }
    });

    await audit({
      actorId: admin.id,
      action: "ALLOCATIONS_UPDATED",
      resourceType: "Fund",
      resourceId: fundId,
      metadata: { allocations },
    });

    const updated = await db.allocation.findMany({ where: { fundId } });
    return json({ allocations: updated });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Update failed", 500);
  }
}
