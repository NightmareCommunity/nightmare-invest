import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody, safeHandler } from "@/lib/api";
import { notifyUser } from "@/lib/realtime";

async function reject(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await ctx.params;

  const { notes } = await parseBody<{ notes?: string }>(req).catch(() => ({ notes: undefined }));
  if (!notes) return error("Rejection reason is required", 422);

  const doc = await db.kycDocument.findUnique({ where: { id }, include: { user: true } });
  if (!doc) return error("Document not found", 404);
  if (doc.status === "REJECTED") return error("Document already rejected", 422);

  const updated = await db.kycDocument.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
      notes,
    },
  });

  // If the user has any rejected doc and no approved doc of the same type, mark KYC status REJECTED
  const hasApprovedOfSameType = await db.kycDocument.findFirst({
    where: { userId: doc.userId, type: doc.type, status: "APPROVED" },
  });
  if (!hasApprovedOfSameType && doc.user.kycStatus === "PENDING") {
    await db.user.update({
      where: { id: doc.userId },
      data: {
        kycStatus: "REJECTED",
        kycReviewedBy: admin.id,
        kycReviewedAt: new Date(),
        kycNotes: notes,
      },
    });
  }

  await audit({
    actorId: admin.id,
    action: "KYC_DOCUMENT_REJECTED",
    resourceType: "KycDocument",
    resourceId: id,
    metadata: { userId: doc.userId, type: doc.type, notes },
  });

  // Real-time notification to the investor (only when overall KYC status moves to REJECTED)
  if (!hasApprovedOfSameType && doc.user.kycStatus === "PENDING") {
    await notifyUser(doc.userId, "kyc_rejected", {
      reason: notes,
      documentType: doc.type,
    });
  }

  return json({ document: updated });
}

export const POST = safeHandler(reject);
