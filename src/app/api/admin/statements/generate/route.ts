import { safeHandler, json, error, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { generateStatementForInvestor } from "@/lib/statement";
import { notifyUser } from "@/lib/realtime";

/**
 * POST /api/admin/statements/generate
 *
 * Admin-only. Generates a PDF monthly statement for a specific investor
 * and a given period, saves it to disk, creates a Document record in the
 * database, and writes an audit log entry.
 *
 * Body: { userId, periodStart, periodEnd, type? }
 */
export const POST = safeHandler(async (req: Request) => {
  const admin = await requireAdmin();
  const body = await parseBody<{
    userId: string;
    periodStart: string;
    periodEnd: string;
    type?: string;
  }>(req);

  if (!body.userId) return error("userId is required");
  if (!body.periodStart || !body.periodEnd) return error("periodStart and periodEnd are required");

  const periodStart = new Date(body.periodStart);
  const periodEnd = new Date(body.periodEnd);
  if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
    return error("Invalid date format");
  }
  if (periodStart >= periodEnd) {
    return error("periodStart must be before periodEnd");
  }

  try {
    const result = await generateStatementForInvestor({
      investorId: body.userId,
      periodStart,
      periodEnd,
      type: body.type ?? "MONTHLY_STATEMENT",
      generatedBy: admin.id,
    });

    await audit({
      actorId: admin.id,
      action: "STATEMENT_GENERATED",
      resourceType: "Document",
      resourceId: result.documentId,
      metadata: {
        userId: body.userId,
        period: result.periodStr,
        fileName: result.fileName,
        sizeBytes: result.sizeBytes,
      },
    });

    // Real-time notification to the investor
    await notifyUser(body.userId, "new_document", {
      documentId: result.documentId,
      title: result.title,
      type: body.type ?? "MONTHLY_STATEMENT",
      period: result.periodStr,
    });

    return json({
      documentId: result.documentId,
      fileName: result.fileName,
      downloadUrl: `/api/documents/${result.documentId}/download`,
      sizeBytes: result.sizeBytes,
    }, 201);
  } catch (e) {
    return error(e instanceof Error ? e.message : "Failed to generate statement", 500);
  }
});

