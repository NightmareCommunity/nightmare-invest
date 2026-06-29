import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, safeHandler } from "@/lib/api";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

// Allowed MIME types for KYC uploads
const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE = 8 * 1024 * 1024; // 8 MB

const VALID_TYPES = ["GOVT_ID", "PROOF_OF_ADDRESS", "ACCREDITATION", "SELFIE", "SOURCE_OF_FUNDS"];

export const POST = safeHandler(async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);

  const form = await req.formData();
  const file = form.get("file");
  const type = form.get("type");

  if (!file || !(file instanceof File)) return error("No file uploaded", 422);
  if (!type || typeof type !== "string") return error("Document type is required", 422);
  if (!VALID_TYPES.includes(type)) return error(`Invalid document type. Allowed: ${VALID_TYPES.join(", ")}`, 422);
  if (!ALLOWED_MIME.includes(file.type)) return error(`Unsupported file type: ${file.type}. Allowed: PNG, JPEG, WebP, PDF`, 422);
  if (file.size > MAX_SIZE) return error("File too large. Max 8MB.", 422);

  // Persist file to /upload/kyc/<userId>/<uuid>.<ext>
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const safeUserId = user.id.replace(/[^a-zA-Z0-9_-]/g, "");
  const dir = join(process.cwd(), "upload", "kyc", safeUserId);
  await mkdir(dir, { recursive: true });
  const fileId = randomUUID();
  const fileName = `${fileId}.${ext}`;
  const fullPath = join(dir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);

  const relPath = `/upload/kyc/${safeUserId}/${fileName}`;

  // Create the KYC document record
  const doc = await db.kycDocument.create({
    data: {
      userId: user.id,
      type,
      fileName: file.name,
      filePath: relPath,
      mimeType: file.type,
      sizeBytes: file.size,
      status: "PENDING",
    },
  });

  // Mark user's KYC status as PENDING if it was NONE
  if (user.kycStatus === "NONE") {
    await db.user.update({ where: { id: user.id }, data: { kycStatus: "PENDING" } });
  }

  await audit({
    actorId: user.id,
    action: "KYC_DOCUMENT_UPLOADED",
    resourceType: "KycDocument",
    resourceId: doc.id,
    metadata: { type, fileName: file.name, sizeBytes: file.size },
  });

  return json({ document: doc });
});
