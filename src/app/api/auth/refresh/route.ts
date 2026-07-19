import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  rotateRefreshToken,
  clearAuthCookies,
  AUTH_COOKIE_NAMES,
  AUTH_REFRESH_EXPIRES_DAYS,
  truncateIp,
  deviceLabelFromUA,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { json, safeHandler } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/auth/refresh
 * ----------------------
 * Exchange a valid refresh token (from httpOnly cookie) for a fresh
 * access + refresh token pair. The old refresh token is revoked and a
 * new one is issued (rotation). Reuse of a revoked token triggers a
 * chain-wide revocation (potential theft detection).
 *
 * The client never needs to call this explicitly — getCurrentUser()
 * transparently rotates on every request that finds an expired access
 * token. This endpoint exists for clients that want to refresh on
 * demand (e.g. after a 401) and for testing.
 *
 * No body required. Reads ni_refresh cookie, sets new ni_access +
 * ni_refresh cookies, returns the public user view.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  const limited = enforceRateLimit(req, "refresh");
  if (limited) return limited;

  const store = await cookies();
  const raw = store.get(AUTH_COOKIE_NAMES.REFRESH_COOKIE)?.value;
  if (!raw) {
    return json({ error: "No refresh token" }, 401);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent");

  const rotated = await rotateRefreshToken(raw, { ip, userAgent });
  if (!rotated) {
    await clearAuthCookies();
    return json({ error: "Refresh token invalid or expired" }, 401);
  }

  // Set the rotated cookies
  store.set(AUTH_COOKIE_NAMES.ACCESS_COOKIE, rotated.newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });
  store.set(AUTH_COOKIE_NAMES.REFRESH_COOKIE, rotated.newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * AUTH_REFRESH_EXPIRES_DAYS,
  });

  // Touch the user's lastLogin so the dashboard "last seen" updates
  await db.user.update({
    where: { id: rotated.user.id },
    data: { lastLogin: new Date() },
  });

  return json({
    user: {
      id: rotated.user.id,
      name: rotated.user.name,
      email: rotated.user.email,
      role: rotated.user.role,
    },
    refreshed: true,
  });
});

/**
 * GET /api/auth/refresh — health check for the refresh subsystem.
 * Returns whether the current refresh token (if any) is still valid
 * without rotating it. Useful for the client to show "session expires in"
 * countdowns.
 */
export async function GET(req: NextRequest) {
  const store = await cookies();
  const raw = store.get(AUTH_COOKIE_NAMES.REFRESH_COOKIE)?.value;
  if (!raw) return json({ valid: false });

  // Look up without rotating
  const jwt = (await import("jsonwebtoken")).default;
  try {
    const payload = jwt.verify(
      raw,
      process.env.JWT_REFRESH_SECRET || "nightmare-invest-dev-refresh-secret-change"
    ) as { jti?: string; sub?: string; exp?: number };
    if (!payload.jti || !payload.sub) return json({ valid: false });

    const stored = await db.refreshToken.findUnique({
      where: { jti: payload.jti },
    });
    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      return json({ valid: false });
    }
    return json({
      valid: true,
      expiresAt: stored.expiresAt,
      device: deviceLabelFromUA(stored.userAgent),
      ip: stored.ip,
    });
  } catch {
    return json({ valid: false });
  }
}
