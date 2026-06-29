import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, error, parseBody, safeHandler } from "@/lib/api";

// PUT /api/watchlist/[id] — Update watchlist item (alert price, direction, notes)
export const PUT = safeHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;

  const item = await db.watchlistItem.findUnique({ where: { id } });
  if (!item || item.userId !== user.id) {
    return error("Watchlist item not found", 404);
  }

  const body = await parseBody<{
    alertPrice?: number | null;
    alertDirection?: "ABOVE" | "BELOW";
    notes?: string | null;
  }>(req);

  const updated = await db.watchlistItem.update({
    where: { id },
    data: {
      ...(body.alertPrice !== undefined ? { alertPrice: body.alertPrice } : {}),
      ...(body.alertDirection !== undefined ? { alertDirection: body.alertDirection } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  });

  return json({ item: updated });
});
