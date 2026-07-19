import { db } from "@/lib/db";
import { clearAuthCookies, getCurrentUser, revokeCurrentSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error } from "@/lib/api";

/**
 * POST /api/auth/logout
 * ---------------------
 * Revokes the current refresh token + session in the DB, then clears
 * cookies. The user is fully logged out across this device.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (user) {
      await revokeCurrentSession();
      await audit({
        actorId: user.id,
        action: "USER_LOGOUT",
        resourceType: "User",
        resourceId: user.id,
      });
    }
    await clearAuthCookies();
    return json({ ok: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Logout failed", 500);
  }
}

/**
 * GET /api/auth/logout — legacy alias for /api/auth/me kept for backwards
 * compat with older client code. Prefer /api/auth/me.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ user: null });
  const fundCount = await db.fund.count();
  return json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    },
    hasFund: fundCount > 0,
  });
}
