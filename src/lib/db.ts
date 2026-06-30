import { PrismaClient } from "@prisma/client";

// Bust the cached Prisma client when the schema version changes so newly added
// models are picked up without requiring a manual dev-server restart.
const PRISMA_SCHEMA_VERSION = "v12-investments"; // bump this after schema changes (v12 — Investment + InvestmentHistory + Transaction.method)

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

// Safety check: probe a known field on auditLog (chainIndex was added in v4)
// to detect stale Prisma clients. Recreate if missing.
function clientHasChainIndex(client: any): boolean {
  try {
    // The Prisma client raises on unknown fields only at query time, not at
    // construction. We rely on a runtime probe instead: inspect the internal
    // DatamodelInfo / runtime data path.
    return !!(client?.auditLog?.fields?.chainIndex) || !!client?._engine?.searchPath;
  } catch {
    return false;
  }
}
if (globalForPrisma.prisma && !clientHasChainIndex(globalForPrisma.prisma)) {
  // Always clear if we cannot confirm the new fields are present.
  try { globalForPrisma.prisma.$disconnect(); } catch { /* ignore */ }
  globalForPrisma.prisma = undefined;
}

function createClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  // Ensure the engine is connected before first query
  client.$connect().catch((e) => console.error("Prisma $connect failed", e));
  return client;
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
