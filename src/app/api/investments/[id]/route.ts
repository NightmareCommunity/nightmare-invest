import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, error, safeHandler } from "@/lib/api";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/investments/[id]
 * Returns a single investment owned by the current user (404 if not found
 * OR not owned by the caller), with fund + full history.
 */
export const GET = safeHandler(async (_req: NextRequest, ctx: RouteCtx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const investment = await db.investment.findUnique({
    where: { id },
    include: {
      fund: { select: { id: true, name: true, slug: true } },
      history: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!investment || investment.userId !== user.id) {
    return error("Investment not found", 404);
  }

  return json({ investment });
});
