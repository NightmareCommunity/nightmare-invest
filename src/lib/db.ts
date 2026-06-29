import { PrismaClient } from "@prisma/client";

// Bust the cached Prisma client when the schema version changes so newly added
// models are picked up without requiring a manual dev-server restart.
const PRISMA_SCHEMA_VERSION = "v3-kyc-totp-3"; // bump this after schema changes

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  __prismaVersion?: string;
};

// Always clear the cached client when the schema version changes
if (globalForPrisma.__prismaVersion !== PRISMA_SCHEMA_VERSION) {
  if (globalForPrisma.prisma) {
    try { globalForPrisma.prisma.$disconnect(); } catch { /* ignore */ }
  }
  globalForPrisma.prisma = undefined;
  globalForPrisma.__prismaVersion = PRISMA_SCHEMA_VERSION;
}

// Safety check: verify the cached client actually has the kycDocument model
// (proves the regenerated Prisma client is in use). If not, recreate.
if (globalForPrisma.prisma && !(globalForPrisma.prisma as any).kycDocument) {
  try { globalForPrisma.prisma.$disconnect(); } catch { /* ignore */ }
  globalForPrisma.prisma = undefined;
}

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
