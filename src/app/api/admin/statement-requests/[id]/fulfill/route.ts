import { safeHandler, json, error } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { generateStatementForInvestor } from "@/lib/statement";
import { notifyUser } from "@/lib/realtime";

/**
 * POST /api/admin/statement-requests/[id]/fulfill
 *
 * Admin fulfills a PENDING statement request by generating the PDF on the
 * spot, linking it to the request, marking it COMPLETED, writing an audit
 * log entry, and pushing a realtime notification to the investor.
 *
 * No body required — uses the request's stored periodStart/periodEnd/type.
 */
export const POST = safeHandler(async (req: Request) => {
  const admin = await requireAdmin();
  const url = new URL(req.url);
  const id = url.pathname.split("/").filter(Boolean).at(-2) ?? "";
  if (!id) return error("Statement request id is required", 400);

  const request = await db.statementRequest.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!request) return error("Statement request not found", 404);
  if (request.status !== "PENDING") {
    return error(`Request is already ${request.status.toLowerCase()}`, 400);
  }

  try {
    const generated = await generateStatementForInvestor({
      investorId: request.userId,
      periodStart: request.periodStart,
      periodEnd: request.periodEnd,
      type: request.type,
      generatedBy: admin.id,
    });

    // Link the request to the generated document and mark COMPLETED
    await db.statementRequest.update({
      where: { id: request.id },
      data: {
        status: "COMPLETED",
        documentId: generated.documentId,
        processedBy: admin.id,
        completedAt: new Date(),
      },
    });

    await audit({
      actorId: admin.id,
      action: "STATEMENT_REQUEST_FULFILLED",
      resourceType: "StatementRequest",
      resourceId: request.id,
      metadata: {
        requestId: request.id,
        investorId: request.userId,
        investorName: request.user.name,
        documentId: generated.documentId,
        fileName: generated.fileName,
        period: generated.periodStr,
        type: request.type,
        sizeBytes: generated.sizeBytes,
      },
    });

    // Real-time notification to the investor — both document-ready and a message
    await notifyUser(request.userId, "new_document", {
      documentId: generated.documentId,
      title: generated.title,
      type: request.type,
      period: generated.periodStr,
    });

    await notifyUser(request.userId, "new_message", {
      messageId: request.id,
      subject: "Statement Request Completed",
      priority: "NORMAL",
      isBroadcast: false,
      senderName: admin.name,
      body: `Your ${request.type.toLowerCase().replace(/_/g, " ")} for ${generated.periodStr} is ready in your Document Vault.`,
    });

    return json({
      ok: true,
      status: "COMPLETED",
      documentId: generated.documentId,
      fileName: generated.fileName,
      downloadUrl: `/api/documents/${generated.documentId}/download`,
      sizeBytes: generated.sizeBytes,
      title: generated.title,
      period: generated.periodStr,
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Failed to fulfill request", 500);
  }
});
