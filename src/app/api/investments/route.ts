import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, error, safeHandler } from "@/lib/api";

/**
 * GET /api/investments
 * Returns all investments owned by the current user, with fund + history.
 */
export const GET = safeHandler(async () => {
  const user = await requireUser();

  const investments = await db.investment.findMany({
    where: { userId: user.id },
    include: {
      fund: { select: { id: true, name: true, slug: true } },
      history: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
  });

  return json({ investments });
});
