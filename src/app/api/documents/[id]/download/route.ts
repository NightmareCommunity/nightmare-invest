import { NextRequest } from "next/server";
import { safeHandler, error } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * GET /api/documents/[id]/download
 *
 * Streams a document file to the requester. Verifies ownership (or admin).
 * Marks the document as isRead=true on first download.
 */
export const GET = safeHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);

  const { id } = await ctx.params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return error("Document not found", 404);

  // Authorization: owner OR admin
  if (doc.userId !== user.id && user.role !== "ADMIN") {
    return error("Forbidden", 403);
  }

  // Resolve path. Statements live under /download/statements/, custom uploads under /download/documents/.
  // filePath is stored as "/download/statements/xxx.pdf" etc.
  const safePath = doc.filePath.replace(/^\/download\//, "");
  const fullPath = join(process.cwd(), "download", safePath);

  let buffer: Buffer;
  try {
    buffer = await readFile(fullPath);
  } catch {
    return error("File not found on disk", 404);
  }

  // Mark as read on first download (fire-and-forget, don't block response)
  if (!doc.isRead) {
    db.document.update({ where: { id: doc.id }, data: { isRead: true } }).catch(() => {});
  }

  const safeFileName = (doc.fileName || "document").replace(/"/g, "");
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${safeFileName}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
});
