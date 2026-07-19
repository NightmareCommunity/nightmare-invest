import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  getCurrentUser,
  verifyPassword,
  hashPassword,
  revokeAllSessionsForUser,
  setAuthCookies,
  truncateIp,
} from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody, safeHandler } from "@/lib/api";

/**
 * POST /api/auth/change-password
 * -----------------------------
 * Authenticated password change. Verifies the current password before
 * accepting the new one.
 *
 * Body: { currentPassword, newPassword, revokeOtherSessions? }
 *
 * The CURRENT session is preserved (the user stays logged in). Other
 * sessions can optionally be revoked via `revokeOtherSessions: true` —
 * useful if the user suspects their password was compromised.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);

  const { currentPassword, newPassword, revokeOtherSessions } = await parseBody<{
    currentPassword?: string;
    newPassword?: string;
    revokeOtherSessions?: boolean;
  }>(req);

  if (!currentPassword || !newPassword) {
    return error("Current password and new password are required", 422);
  }
  if (newPassword.length < 8) {
    return error("New password must be at least 8 characters", 422);
  }
  if (newPassword === currentPassword) {
    return error("New password must be different from the current password", 422);
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return error("Current password is incorrect", 401);

  // Update password
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  // Optionally revoke all OTHER sessions (preserve current)
  let revoked = 0;
  if (revokeOtherSessions) {
    // Revoke everything, then re-issue a fresh session for the current request
    revoked = await revokeAllSessionsForUser(user.id);
  }

  // Re-issue the current session's cookies so its refresh token is fresh
  // (the old refresh token was revoked above if revokeOtherSessions=true)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent");
  await setAuthCookies(user, { ip, userAgent });

  await audit({
    actorId: user.id,
    action: "PASSWORD_CHANGE",
    resourceType: "User",
    resourceId: user.id,
    metadata: revokeOtherSessions
      ? { otherSessionsRevoked: String(revoked > 0 ? revoked - 1 : 0) }
      : undefined,
  });

  return json({
    ok: true,
    otherSessionsRevoked: revokeOtherSessions ? Math.max(0, revoked - 1) : 0,
  });
});
