import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  verifyPassword,
  setAuthCookies,
  verifyTotpToken,
  decryptTotpSecret,
  issueAuthChallenge,
} from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody, safeHandler } from "@/lib/api";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/auth/login
 * --------------------
 * Standard login (Path B) or 2FA challenge completion (Path A).
 *
 * 2FA challenge tickets are persisted in the AuthChallenge table — they
 * survive server restarts and work across multi-instance deployments.
 */
export const POST = safeHandler(async (req: NextRequest) => {
  // Rate limit: 5 attempts per 30s per IP
  const limited = enforceRateLimit(req, "login");
  if (limited) return limited;

  const body = await parseBody<{
    email?: string;
    password?: string;
    totpCode?: string;
    challenge?: string;
  }>(req);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent");

  // Path A: completing a 2FA challenge (persisted in DB)
  if (body.challenge) {
    const challenge = await db.authChallenge.findUnique({
      where: { ticket: body.challenge },
      include: { user: true },
    });
    if (!challenge || challenge.status !== "PENDING" || challenge.expiresAt.getTime() < Date.now()) {
      return error("Challenge expired. Please log in again.", 401);
    }
    const user = challenge.user;
    if (!body.totpCode) return error("Verification code required", 422);

    if (!user.isActive || !user.totpEnabled || !user.totpSecret) {
      return error("2FA not enabled for this account", 422);
    }

    // Mark the challenge as consumed (atomic — prevents replay)
    await db.authChallenge.update({
      where: { id: challenge.id },
      data: { status: "COMPLETED", consumedAt: new Date() },
    });

    const secret = decryptTotpSecret(user.totpSecret);
    if (!verifyTotpToken(body.totpCode, secret)) {
      // Re-issue a fresh challenge so the user can retry
      const newTicket = await issueAuthChallenge(user.id);
      return json({ requiresTwoFactor: true, challenge: newTicket, error: "Invalid verification code" });
    }

    await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    await setAuthCookies(user, { ip, userAgent });
    await audit({
      actorId: user.id,
      action: "USER_LOGIN_2FA",
      resourceType: "User",
      resourceId: user.id,
    });

    return json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  }

  // Path B: standard login
  const { email: rawIdentifier, password } = body;
  if (!rawIdentifier || !password) return error("Email and password are required", 422);

  const identifier = rawIdentifier.trim();
  const email = identifier.includes("@")
    ? identifier.toLowerCase()
    : `${identifier.toLowerCase()}@nightmare.invest`;

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return error("Invalid credentials", 401);
  if (!user.isActive) return error("Account suspended. Contact your fund manager.", 403);

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return error("Invalid credentials", 401);

  if (user.totpEnabled && user.totpSecret) {
    // Issue a persisted challenge ticket (5-minute expiry)
    const ticket = await issueAuthChallenge(user.id);
    return json({ requiresTwoFactor: true, challenge: ticket });
  }

  await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
  await setAuthCookies(user, { ip, userAgent });
  await audit({ actorId: user.id, action: "USER_LOGIN", resourceType: "User", resourceId: user.id });

  return json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});
