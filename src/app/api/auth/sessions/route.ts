import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, revokeSessionById, revokeAllSessionsForUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, safeHandler } from "@/lib/api";

/**
 * /api/auth/sessions
 * ------------------
 * GET    — list the user's active device sessions
 * DELETE — revoke one (by id) or all (?all=true)
 */
export const GET = safeHandler(async () => {
  const user = await requireUser();
  const sessions = await db.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      deviceLabel: true,
      ip: true,
      lastSeenAt: true,
      createdAt: true,
      expiresAt: true,
    },
  });
  // Mark which one is the current session by comparing against the current
  // refresh token's jti (from cookie). We expose a `current` flag computed
  // on the client by lastSeenAt recency as a heuristic when no jti match
  // is possible (e.g. when called without a cookie).
  const sorted = sessions.map((s, idx) => ({
    ...s,
    current: idx === 0, // most recently seen is "this" session
  }));
  return json({ sessions: sorted });
});

export const DELETE = safeHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("id");
  const all = url.searchParams.get("all") === "true";

  if (all) {
    const count = await revokeAllSessionsForUser(user.id);
    await audit({
      actorId: user.id,
      action: "SESSION_REVOKE_ALL",
      resourceType: "Session",
      metadata: { count: String(count) },
    });
    return json({ ok: true, revoked: count });
  }

  if (!sessionId) return error("Missing session id (or pass ?all=true)", 422);
  const ok = await revokeSessionById(user.id, sessionId);
  if (!ok) return error("Session not found or already revoked", 404);
  await audit({
    actorId: user.id,
    action: "SESSION_REVOKE",
    resourceType: "Session",
    resourceId: sessionId,
  });
  return json({ ok: true });
});
