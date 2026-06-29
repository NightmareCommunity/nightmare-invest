import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody, safeHandler } from "@/lib/api";
import { notifyUser } from "@/lib/realtime";

// POST /api/admin/kyc/[id]/approve — approve a single document & optionally bump user's KYC tier
async function approve(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await ctx.params;

  const { tier, notes } = await parseBody<{
    tier?: "STANDARD" | "ACCREDITED";
    notes?: string;
  }>(req).catch(() => ({ tier: undefined, notes: undefined }));

  const doc = await db.kycDocument.findUnique({ where: { id }, include: { user: true } });
  if (!doc) return error("Document not found", 404);
  if (doc.status === "APPROVED") return error("Document already approved", 422);

  const updated = await db.kycDocument.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
      notes: notes ?? doc.notes,
    },
  });

  // Check if the user has at least one approved doc of each required type
  const required = ["GOVT_ID", "PROOF_OF_ADDRESS"];
  const approvedTypes = await db.kycDocument.findMany({
    where: { userId: doc.userId, status: "APPROVED" },
    select: { type: true },
    distinct: ["type"],
  });
  const approvedSet = new Set(approvedTypes.map((d) => d.type));
  const fullyVerified = required.every((t) => approvedSet.has(t));

  const userUpdate: Record<string, unknown> = {};
  if (fullyVerified) userUpdate.kycStatus = "APPROVED";
  if (tier) userUpdate.kycTier = tier;
  if (Object.keys(userUpdate).length > 0) {
    userUpdate.kycReviewedBy = admin.id;
    userUpdate.kycReviewedAt = new Date();
    if (notes) userUpdate.kycNotes = notes;
    await db.user.update({ where: { id: doc.userId }, data: userUpdate });
  }

  await audit({
    actorId: admin.id,
    action: "KYC_DOCUMENT_APPROVED",
    resourceType: "KycDocument",
    resourceId: id,
    metadata: { userId: doc.userId, type: doc.type, tier: tier ?? null, fullyVerified },
  });

  // Real-time notification to the investor (only on full verification)
  if (fullyVerified) {
    await notifyUser(doc.userId, "kyc_approved", {
      tier: tier ?? null,
    });
  }

  return json({ document: updated, fullyVerified });
}

export const POST = safeHandler(approve);
