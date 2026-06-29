import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, safeHandler } from "@/lib/api";

// GET /api/admin/kyc — list KYC documents for review (optionally filter by status)
export const GET = safeHandler(async (req: NextRequest) => {
  const admin = await requireAdmin();
  void admin;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // PENDING | APPROVED | REJECTED
  const where = status ? { status } : {};

  const documents = await db.kycDocument.findMany({
    where,
    include: {
      user: {
        select: { id: true, name: true, email: true, kycStatus: true, kycTier: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Group by user for a quick overview
  const pendingByUser = await db.kycDocument.groupBy({
    by: ["userId"],
    where: { status: "PENDING" },
    _count: { _all: true },
  });

  return json({
    documents: documents.map((d) => ({
      id: d.id,
      type: d.type,
      fileName: d.fileName,
      filePath: d.filePath,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      status: d.status,
      notes: d.notes,
      createdAt: d.createdAt,
      reviewedAt: d.reviewedAt,
      user: d.user,
    })),
    pendingCount: pendingByUser.reduce((acc, g) => acc + g._count._all, 0),
  });
});
