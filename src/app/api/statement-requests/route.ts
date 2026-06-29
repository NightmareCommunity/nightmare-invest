import { safeHandler, json, error, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

/**
 * POST /api/statement-requests
 *
 * Investor creates a new statement request (PENDING). The fund administrator
 * reviews it in the admin portal and either fulfills it (generates a PDF) or
 * rejects it.
 *
 * Body: { periodStart, periodEnd, type, notes? }
 */
export const POST = safeHandler(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody<{
    periodStart: string;
    periodEnd: string;
    type: string;
    notes?: string;
  }>(req);

  if (!body.periodStart || !body.periodEnd) {
    return error("periodStart and periodEnd are required");
  }

  const periodStart = new Date(body.periodStart);
  const periodEnd = new Date(body.periodEnd);
  if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
    return error("Invalid date format");
  }
  if (periodStart >= periodEnd) {
    return error("periodStart must be before periodEnd");
  }
  // periodStart cannot be in the future
  if (periodStart.getTime() > Date.now() + 60_000) {
    return error("periodStart cannot be in the future");
  }

  const VALID_TYPES = ["MONTHLY_STATEMENT", "QUARTERLY_REPORT", "TAX_STATEMENT", "CUSTOM"];
  const type = VALID_TYPES.includes(body.type) ? body.type : "MONTHLY_STATEMENT";

  const notes = body.notes?.trim() || null;

  const request = await db.statementRequest.create({
    data: {
      userId: user.id,
      periodStart,
      periodEnd,
      type,
      notes,
      status: "PENDING",
    },
  });

  await audit({
    actorId: user.id,
    action: "STATEMENT_REQUEST_CREATED",
    resourceType: "StatementRequest",
    resourceId: request.id,
    metadata: {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      type,
      notes: notes ?? null,
    },
  });

  return json({ request }, 201);
});

/**
 * GET /api/statement-requests
 *
 * Investor lists their own statement requests, most recent first.
 * COMPLETED requests include a small subset of the linked document's metadata.
 */
export const GET = safeHandler(async () => {
  const user = await requireUser();
  const requests = await db.statementRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // Hydrate linked documents for COMPLETED requests (soft-link via documentId)
  const completedDocIds = requests
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

  const hydrated = requests.map((r) => ({
    ...r,
    document: r.documentId ? docById.get(r.documentId) ?? null : null,
  }));

  return json({ requests: hydrated });
});
