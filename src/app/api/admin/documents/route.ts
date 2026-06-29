import { safeHandler, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/admin/documents
 *
 * Admin endpoint. Returns all documents across all users, with pagination
 * and optional filter by userId or type.
 *
 * Query:
 *   ?page=1&limit=20
 *   ?userId=xxx        — filter by investor
 *   ?type=MONTHLY_STATEMENT
 */
export const GET = safeHandler(async (req: Request) => {
  await requireAdmin();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const userId = url.searchParams.get("userId");
  const type = url.searchParams.get("type");

  const where: any = {};
  if (userId) where.userId = userId;
  if (type) where.type = type;

  const [documents, total] = await Promise.all([
    db.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.document.count({ where }),
  ]);

  return json({
    documents,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});
