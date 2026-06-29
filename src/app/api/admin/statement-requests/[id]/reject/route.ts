import { safeHandler, json, error, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notifyUser } from "@/lib/realtime";

/**
 * POST /api/admin/statement-requests/[id]/reject
 *
 * Admin rejects a PENDING statement request with an optional reason.
 * Updates status to REJECTED, writes an audit log, and notifies the
 * investor in real-time.
 *
 * Body: { reason? }
 */
export const POST = safeHandler(async (req: Request) => {
  const admin = await requireAdmin();
  const url = new URL(req.url);
  const id = url.pathname.split("/").filter(Boolean).at(-2) ?? "";
  if (!id) return error("Statement request id is required", 400);

  let reason = "";
  try {
    const body = await parseBody<{ reason?: string }>(req);
    reason = body.reason?.trim() || "";
  } catch {
    // Empty body is allowed (rejection without a reason)
  }

  const request = await db.statementRequest.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!request) return error("Statement request not found", 404);
  if (request.status !== "PENDING") {
    return error(`Request is already ${request.status.toLowerCase()}`, 400);
  }

  await db.statementRequest.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      processedBy: admin.id,
      completedAt: new Date(),
      notes: reason ? `${request.notes ? request.notes + " | " : ""}[REJECTION REASON]: ${reason}` : request.notes,
    },
  });

  await audit({
    actorId: admin.id,
    action: "STATEMENT_REQUEST_REJECTED",
    resourceType: "StatementRequest",
    resourceId: request.id,
    metadata: {
      requestId: request.id,
      investorId: request.userId,
      investorName: request.user.name,
      reason: reason || null,
      period: `${request.periodStart.toISOString()} → ${request.periodEnd.toISOString()}`,
      type: request.type,
    },
  });

  // Real-time notification to the investor
  await notifyUser(request.userId, "new_message", {
    messageId: request.id,
    subject: "Statement Request Rejected",
    priority: "IMPORTANT",
    isBroadcast: false,
    senderName: admin.name,
    body: reason
      ? `Your ${request.type.toLowerCase().replace(/_/g, " ")} request was rejected. Reason: ${reason}`
      : `Your ${request.type.toLowerCase().replace(/_/g, " ")} request was rejected. Please contact investor relations for details.`,
  });

  return json({
    ok: true,
    status: "REJECTED",
    reason: reason || null,
  });
});
