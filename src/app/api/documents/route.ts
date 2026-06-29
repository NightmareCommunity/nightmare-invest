import { safeHandler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/documents
 *
 * Returns all documents for the current authenticated user.
 * Optional query: ?type=MONTHLY_STATEMENT to filter by type.
 * Sorted by createdAt DESC.
 */
export const GET = safeHandler(async (req: Request) => {
  const user = await requireUser();

  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  const where: any = { userId: user.id };
  if (type) where.type = type;

  const documents = await db.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return json({ documents });
});
