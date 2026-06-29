import { db } from "./db";
import { createHash } from "crypto";

/**
 * Compute the SHA-256 hash of an audit log entry.
 *
 * The hash chains the previous entry's hash together with a canonical
 * representation of this entry's content (timestamp, actor, action,
 * resourceType, resourceId, metadata). This makes the audit trail
 * tamper-evident — any modification to a historical entry would
 * invalidate every subsequent hash in the chain.
 */
function computeAuditHash(params: {
  prevHash: string | null;
  timestamp: number;
  actorId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: string | null;
}): string {
  // Stable canonical JSON (sorted keys, no extra whitespace)
  const canonical = JSON.stringify({
    action: params.action,
    actorId: params.actorId ?? "",
    metadata: params.metadata ?? "",
    prevHash: params.prevHash ?? "",
    resourceId: params.resourceId ?? "",
    resourceType: params.resourceType ?? "",
    timestamp: params.timestamp,
  }, Object.keys({
    action: 0,
    actorId: 0,
    metadata: 0,
    prevHash: 0,
    resourceId: 0,
    resourceType: 0,
    timestamp: 0,
  }).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Append a new audit log entry to the immutable, hash-chained trail.
 *
 * Always fetches the latest entry's hash atomically (in a transaction)
 * so concurrent appends produce a stable chain.
 */
export async function audit(params: {
  actorId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.$transaction(async (tx) => {
      // Get the previous entry (highest chainIndex)
      const prev = await tx.auditLog.findFirst({
        orderBy: { chainIndex: "desc" },
        select: { hash: true, chainIndex: true },
      });

      const timestamp = Date.now();
      const metadataStr = params.metadata ? JSON.stringify(params.metadata) : null;
      const hash = computeAuditHash({
        prevHash: prev?.hash ?? null,
        timestamp,
        actorId: params.actorId ?? null,
        action: params.action,
        resourceType: params.resourceType ?? null,
        resourceId: params.resourceId ?? null,
        metadata: metadataStr,
      });

      await tx.auditLog.create({
        data: {
          actorId: params.actorId ?? null,
          action: params.action,
          resourceType: params.resourceType ?? null,
          resourceId: params.resourceId ?? null,
          metadata: metadataStr,
          prevHash: prev?.hash ?? null,
          hash,
          chainIndex: (prev?.chainIndex ?? 0) + 1,
        },
      });
    });
  } catch (e) {
    // Never let audit logging break a request
    console.error("audit log failed", e);
  }
}

/**
 * Verify the integrity of the audit log chain.
 * Returns the first broken entry (if any) or null if the chain is intact.
 */
export async function verifyAuditChain(limit = 1000): Promise<{
  intact: boolean;
  verified: number;
  brokenAt?: { chainIndex: number; id: string; action: string };
}> {
  try {
    // First, backfill any entries that are missing hash/chainIndex (legacy data)
    await backfillAuditChain();

    const entries = await db.auditLog.findMany({
      orderBy: { chainIndex: "asc" },
      take: limit,
      select: {
        id: true,
        chainIndex: true,
        prevHash: true,
        hash: true,
        action: true,
        actorId: true,
        resourceType: true,
        resourceId: true,
        metadata: true,
        timestamp: true,
      },
    });

    let prevHash: string | null = null;
    let verified = 0;
    for (const entry of entries) {
      // Verify the prevHash pointer matches the prior entry's hash
      if (entry.prevHash !== prevHash) {
        return {
          intact: false,
          verified,
          brokenAt: { chainIndex: entry.chainIndex, id: entry.id, action: entry.action },
        };
      }
      // Recompute this entry's hash and verify it matches
      const expectedHash = computeAuditHash({
        prevHash: entry.prevHash,
        timestamp: entry.timestamp instanceof Date ? entry.timestamp.getTime() : Number(entry.timestamp),
        actorId: entry.actorId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.metadata,
      });
      if (entry.hash !== expectedHash) {
        return {
          intact: false,
          verified,
          brokenAt: { chainIndex: entry.chainIndex, id: entry.id, action: entry.action },
        };
      }
      prevHash = entry.hash;
      verified++;
    }
    return { intact: true, verified };
  } catch (e) {
    console.error("audit chain verification failed", e);
    return { intact: false, verified: 0 };
  }
}

/**
 * One-time backfill: assigns chainIndex + hash to legacy audit log entries
 * that were created before hash chaining was enabled. Idempotent — only
 * touches entries with null hash.
 */
async function backfillAuditChain(): Promise<void> {
  try {
    const unchained = await db.auditLog.findMany({
      where: { hash: null },
      orderBy: { timestamp: "asc" },
      take: 5000,
      select: { id: true, timestamp: true, actorId: true, action: true, resourceType: true, resourceId: true, metadata: true },
    });
    if (unchained.length === 0) return;

    // Get the current chain tip (highest chainIndex)
    const tip = await db.auditLog.findFirst({
      where: { hash: { not: null } },
      orderBy: { chainIndex: "desc" },
      select: { hash: true, chainIndex: true },
    });

    let prevHash: string | null = tip?.hash ?? null;
    let chainIndex = tip?.chainIndex ?? 0;

    for (const entry of unchained) {
      chainIndex++;
      const ts = entry.timestamp instanceof Date ? entry.timestamp.getTime() : Number(entry.timestamp);
      const hash = computeAuditHash({
        prevHash,
        timestamp: ts,
        actorId: entry.actorId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        metadata: entry.metadata,
      });
      await db.auditLog.update({
        where: { id: entry.id },
        data: { prevHash, hash, chainIndex },
      });
      prevHash = hash;
    }
    console.log(`audit chain backfilled ${unchained.length} entries`);
  } catch (e) {
    console.error("audit chain backfill failed", e);
  }
}
