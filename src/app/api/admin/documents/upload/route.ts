import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, safeHandler } from "@/lib/api";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { saveUploadedFileToDisk } from "@/lib/pdf";
import { notifyUser } from "@/lib/realtime";

const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

const VALID_TYPES = [
  "MONTHLY_STATEMENT",
  "QUARTERLY_REPORT",
  "TAX_STATEMENT",
  "TRADE_CONFIRMATION",
  "ACCOUNT_STATEMENT",
  "CUSTOM",
];

/**
 * POST /api/admin/documents/upload
 *
 * Admin-only. Uploads a custom document for a specific investor.
 * multipart/form-data with: file, userId, title, type, description (optional), period (optional)
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const admin = await requireAdmin();

  const form = await req.formData();
  const file = form.get("file");
  const userId = form.get("userId");
  const title = form.get("title");
  const type = form.get("type");
  const description = form.get("description");
  const period = form.get("period");

  if (!file || !(file instanceof File)) return error("No file uploaded", 422);
  if (!userId || typeof userId !== "string") return error("userId is required", 422);
  if (!title || typeof title !== "string") return error("title is required", 422);
  if (!type || typeof type !== "string" || !VALID_TYPES.includes(type)) {
    return error(`Invalid document type. Allowed: ${VALID_TYPES.join(", ")}`, 422);
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return error(`Unsupported file type: ${file.type}. Allowed: PDF, PNG, JPEG, WebP, TXT, DOCX, XLSX`, 422);
  }
  if (file.size > MAX_SIZE) return error("File too large. Max 25MB.", 422);

  // Verify investor exists and is not an admin
  const investor = await db.user.findUnique({ where: { id: userId } });
  if (!investor) return error("Investor not found", 404);
  if (investor.role === "ADMIN") return error("Cannot upload documents for admin accounts", 422);

  // Save file to disk
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const fileId = randomUUID();
  const storedName = `${fileId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = await saveUploadedFileToDisk(buffer, storedName);

  // Create Document record
  const doc = await db.document.create({
    data: {
      userId: investor.id,
      title: title.trim(),
      type,
      period: typeof period === "string" && period.trim() ? period.trim() : null,
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      fileName: file.name,
      filePath,
      mimeType: file.type,
      sizeBytes: file.size,
      generatedBy: admin.id,
      isRead: false,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  // Audit log
  await audit({
    actorId: admin.id,
    action: "DOCUMENT_UPLOADED",
    resourceType: "Document",
    resourceId: doc.id,
    metadata: {
      title: doc.title,
      type: doc.type,
      ownerId: investor.id,
      ownerName: investor.name,
      fileName: file.name,
      sizeBytes: file.size,
    },
  });

  // Real-time notification to the investor
  await notifyUser(investor.id, "new_document", {
    documentId: doc.id,
    title: doc.title,
    type: doc.type,
  });

  return json({ document: doc }, 201);
});
