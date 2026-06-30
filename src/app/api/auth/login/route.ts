import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  verifyPassword,
  setAuthCookies,
  verifyTotpToken,
  decryptTotpSecret,
} from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody, safeHandler } from "@/lib/api";

// In-memory challenge tickets: ticket -> { userId, expiresAt }
// (single-process dev; in prod move to Redis)
const challengeTickets = new Map<string, { userId: string; expiresAt: number }>();

function purgeExpired() {
  const now = Date.now();
  for (const [k, v] of challengeTickets) if (v.expiresAt < now) challengeTickets.delete(k);
}

export const POST = safeHandler(async (req: NextRequest) => {
  const body = await parseBody<{
    email?: string;
    password?: string;
    totpCode?: string;
    challenge?: string;
  }>(req);

  // Path A: completing a 2FA challenge
  if (body.challenge) {
    purgeExpired();
    const ticket = challengeTickets.get(body.challenge);
    if (!ticket || ticket.expiresAt < Date.now()) {
      challengeTickets.delete(body.challenge);
      return error("Challenge expired. Please log in again.", 401);
    }
    if (!body.totpCode) return error("Verification code required", 422);

    const user = await db.user.findUnique({ where: { id: ticket.userId } });
    if (!user || !user.isActive || !user.totpEnabled || !user.totpSecret) {
      challengeTickets.delete(body.challenge);
      return error("2FA not enabled for this account", 422);
    }

    const secret = decryptTotpSecret(user.totpSecret);
    const ok = verifyTotpToken(body.totpCode, secret);
    if (!ok) return error("Invalid verification code", 401);

    challengeTickets.delete(body.challenge);
    await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    await setAuthCookies(user);
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

  // Path B: standard login (with optional 2FA challenge issuance)
  // Accepts either an email OR a username. When the input contains no "@",
  // we treat it as a username and resolve it against the configured admin
  // domain (e.g. "ojas1234" → "ojas1234@nightmare.invest"). This lets admins
  // log in with their short username while keeping the email-based identity
  // model intact.
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
    // Issue a short-lived challenge ticket
    const ticket = `tc_${Buffer.from(crypto.randomUUID()).toString("base64url")}`;
    challengeTickets.set(ticket, { userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000 });
    return json({ requiresTwoFactor: true, challenge: ticket });
  }

  await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
  await setAuthCookies(user);
  await audit({ actorId: user.id, action: "USER_LOGIN", resourceType: "User", resourceId: user.id });

  return json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});
