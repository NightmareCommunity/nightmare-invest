import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { json, error } from "@/lib/api";

// GET /api/kyc — list current user's KYC documents + status
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);

  const documents = await db.kycDocument.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return json({
    status: user.kycStatus,
    tier: user.kycTier,
    notes: user.kycNotes,
    reviewedAt: user.kycReviewedAt,
    documents: documents.map((d) => ({
      id: d.id,
      type: d.type,
      fileName: d.fileName,
      status: d.status,
      notes: d.notes,
      createdAt: d.createdAt,
      reviewedAt: d.reviewedAt,
      sizeBytes: d.sizeBytes,
      mimeType: d.mimeType,
    })),
  });
}

// DELETE /api/kyc?docId=... — delete a pending (unreviewed) document
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const docId = searchParams.get("docId");
  if (!docId) return error("docId is required", 422);

  const doc = await db.kycDocument.findUnique({ where: { id: docId } });
  if (!doc || doc.userId !== user.id) return error("Document not found", 404);
  if (doc.status !== "PENDING") return error("Reviewed documents cannot be deleted", 422);

  await db.kycDocument.delete({ where: { id: docId } });

  // If user has no more pending docs, set status back to NONE if they have no approved docs
  const remaining = await db.kycDocument.count({
    where: { userId: user.id, status: { in: ["PENDING", "APPROVED"] } },
  });
  if (remaining === 0 && user.kycStatus === "PENDING") {
    await db.user.update({ where: { id: user.id }, data: { kycStatus: "NONE" } });
  }

  return json({ success: true });
}
