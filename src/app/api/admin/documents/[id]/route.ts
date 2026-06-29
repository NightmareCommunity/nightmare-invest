import { NextRequest } from "next/server";
import { safeHandler, json, error } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { readFile, unlink } from "fs/promises";
import { join } from "path";

/**
 * DELETE /api/admin/documents/[id]
 *
 * Admin-only. Deletes a document (file on disk + DB record) and writes
 * an audit log entry.
 */
export const DELETE = safeHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;

  const doc = await db.document.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!doc) return error("Document not found", 404);

  // Try to remove the file from disk (best-effort — don't fail if missing)
  try {
    const safePath = doc.filePath.replace(/^\/download\//, "");
    const fullPath = join(process.cwd(), "download", safePath);
    await unlink(fullPath);
  } catch {
    // file already gone — ignore
  }

  // Audit log BEFORE deleting (so we capture the metadata)
  await audit({
    actorId: admin.id,
    action: "DOCUMENT_DELETED",
    resourceType: "Document",
    resourceId: doc.id,
    metadata: {
      title: doc.title,
      type: doc.type,
      period: doc.period,
      ownerId: doc.userId,
      ownerName: doc.user?.name,
      fileName: doc.fileName,
    },
  });

  await db.document.delete({ where: { id: doc.id } });

  return json({ ok: true });
});

/**
 * GET /api/admin/documents/[id] — fetch a single document's metadata (admin).
 */
export const GET = safeHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await ctx.params;
  const doc = await db.document.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!doc) return error("Document not found", 404);
  return json({ document: doc });
});

// Helper export for reading file (kept for potential future preview use)
export async function readDocumentFile(filePath: string): Promise<Buffer> {
  const safePath = filePath.replace(/^\/download\//, "");
  const fullPath = join(process.cwd(), "download", safePath);
  return readFile(fullPath);
}
