import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, revokeAllSessionsForUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody, safeHandler } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/auth/password-reset
 * ----------------------------
 * Two-step flow:
 *   1. { email } — request reset (audit-logged; in a real system would email a token)
 *   2. { email, newPassword } — confirm reset
 *
 * On confirm: password is updated AND every existing session for the user
 * is revoked (defense-in-depth: any attacker who held the old password
 * cannot continue riding on existing refresh tokens).
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const limited = enforceRateLimit(req, "passwordReset");
  if (limited) return limited;

  const { email, newPassword } = await parseBody<{ email: string; newPassword?: string }>(req);
  if (!email) return error("Email is required", 422);

  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    // Don't leak existence
    return json({ ok: true, message: "If the account exists, a reset link has been sent." });
  }

  if (!newPassword) {
    await audit({
      actorId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      resourceType: "User",
      resourceId: user.id,
    });
    return json({ ok: true, message: "If the account exists, a reset link has been sent." });
  }

  if (newPassword.length < 8) return error("Password must be at least 8 characters", 422);

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  // Revoke all active sessions for this user — they must log in again with the new password
  const revoked = await revokeAllSessionsForUser(user.id);

  await audit({
    actorId: user.id,
    action: "PASSWORD_RESET",
    resourceType: "User",
    resourceId: user.id,
    metadata: { sessionsRevoked: String(revoked) },
  });

  return json({ ok: true, sessionsRevoked: revoked });
});
