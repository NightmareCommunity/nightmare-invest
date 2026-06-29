import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { error, safeHandler } from "@/lib/api";
import { readFile } from "fs/promises";
import { join } from "path";
import { lookup } from "mime-types";

// GET /api/kyc/file/[id] — stream a KYC document file.
// Accessible by the owner or any admin. Sets Content-Type based on stored mimeType.
export const GET = safeHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);

  const { id } = await ctx.params;
  const doc = await db.kycDocument.findUnique({ where: { id } });
  if (!doc) return error("Document not found", 404);

  // Authorization: owner OR admin
  if (doc.userId !== user.id && user.role !== "ADMIN") {
    return error("Forbidden", 403);
  }

  // Resolve path relative to project root /upload
  const safePath = doc.filePath.replace(/^\/upload\//, "");
  const fullPath = join(process.cwd(), "upload", safePath);

  try {
    const buffer = await readFile(fullPath);
    const mime = doc.mimeType || lookup(doc.fileName) || "application/octet-stream";
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `inline; filename="${doc.fileName.replace(/"/g, "")}"`,
      },
    });
  } catch {
    return error("File not found on disk", 404);
  }
});
