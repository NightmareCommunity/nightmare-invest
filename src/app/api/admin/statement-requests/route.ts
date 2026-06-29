import { safeHandler, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/admin/statement-requests
 *
 * Admin lists ALL statement requests with user info. Supports:
 *   ?status=PENDING        — filter by status
 *   ?page=1&limit=20       — pagination
 */
export const GET = safeHandler(async (req: Request) => {
  await requireAdmin();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const status = url.searchParams.get("status"); // PENDING | COMPLETED | REJECTED

  const where: { status?: string } = {};
  if (status) where.status = status;

  const [requestsRaw, total, pendingCount] = await Promise.all([
    db.statementRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
        processor: { select: { id: true, name: true, email: true } },
      },
    }),
    db.statementRequest.count({ where }),
    db.statementRequest.count({ where: { status: "PENDING" } }),
  ]);

  // Hydrate linked documents for COMPLETED requests (soft-link via documentId)
  const completedDocIds = requestsRaw
    .filter((r) => r.status === "COMPLETED" && r.documentId)
    .map((r) => r.documentId as string);
  const documents =
    completedDocIds.length > 0
      ? await db.document.findMany({
          where: { id: { in: completedDocIds } },
          select: { id: true, title: true, type: true, period: true, fileName: true },
        })
      : [];
  const docById = new Map(documents.map((d) => [d.id, d]));

  const requests = requestsRaw.map((r) => ({
    ...r,
    document: r.documentId ? docById.get(r.documentId) ?? null : null,
  }));

  return json({
    requests,
    pendingCount,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});
