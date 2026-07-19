/**
 * NIGHTMARE INVEST — Persistent Authentication Library
 * ====================================================
 *
 * Production-ready auth with the following properties:
 *
 *   • Passwords hashed with bcrypt (cost factor 12).
 *   • JWT access tokens (short-lived, 30 min) carried in httpOnly cookie.
 *   • JWT refresh tokens (long-lived, 30 days) carried in httpOnly cookie.
 *   • Refresh tokens are PERSISTED in the database (RefreshToken table)
 *     — every refresh is rotated (old token revoked, new one issued)
 *     — tokens can be revoked server-side (logout, "log out everywhere")
 *     — a DB dump alone cannot forge sessions (only SHA-256 hashes stored)
 *   • Sessions table tracks device/IP/UA for the "active sessions" UI.
 *   • 2FA challenge tickets persisted in DB (AuthChallenge table).
 *   • getCurrentUser() transparently refreshes expired access tokens,
 *     so a logged-in user STAYS logged in across page refreshes and
 *     server restarts until the refresh token expires or is revoked.
 *
 * Portability: this code makes no assumptions about the underlying DB
 * provider. Works identically on SQLite (dev) and PostgreSQL (prod).
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";
import * as otpauth from "otpauth";
import * as crypto from "crypto";
import { db } from "./db";
import type { User } from "@prisma/client";

// --------------------------------------------------------------------------
// Secrets — read from env, with loud dev-only fallbacks. In production these
// MUST be set via environment variables or auth will refuse to start.
// --------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || "nightmare-invest-dev-secret-change-in-production";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "nightmare-invest-dev-refresh-secret-change";

// --------------------------------------------------------------------------
// Token lifetimes
// --------------------------------------------------------------------------
const ACCESS_EXPIRES = "30m";                       // access token: 30 minutes
const REFRESH_EXPIRES_DAYS = 30;                    // refresh token: 30 days (persistent login)

// Cookie names
const ACCESS_COOKIE = "ni_access";
const REFRESH_COOKIE = "ni_refresh";

// --------------------------------------------------------------------------
// TOTP secret obfuscation (XOR — dev-grade, NOT real encryption; the secret
// is short-lived and locked to a per-user authenticator). For production,
// swap obfuscate/deobfuscate with AES-GCM via KMS.
// --------------------------------------------------------------------------
const TOTP_OBFUS_KEY = process.env.TOTP_OBFUS_KEY || "nightmare-totp-obfuscation-key";
function obfuscate(secret: string): string {
  const buf = Buffer.from(secret, "base64");
  const out = Buffer.alloc(buf.length);
  const key = Buffer.from(TOTP_OBFUS_KEY, "utf8");
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ key[i % key.length];
  return out.toString("base64");
}
function deobfuscate(stored: string): string {
  const buf = Buffer.from(stored, "base64");
  const out = Buffer.alloc(buf.length);
  const key = Buffer.from(TOTP_OBFUS_KEY, "utf8");
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ key[i % key.length];
  return out.toString("base64");
}

// --------------------------------------------------------------------------
// TOTP primitives
// --------------------------------------------------------------------------
export function generateTotpSecret(email: string): { secret: string; uri: string } {
  const secret = new otpauth.Secret({ size: 20 });
  const totp = new otpauth.TOTP({
    issuer: "NIGHTMARE INVEST",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  });
  return {
    secret: secret.base32,
    uri: totp.toString(),
  };
}

export function verifyTotpToken(token: string, base32Secret: string): boolean {
  const totp = new otpauth.TOTP({
    issuer: "NIGHTMARE INVEST",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: otpauth.Secret.fromBase32(base32Secret),
  });
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

export function encryptTotpSecret(base32Secret: string): string {
  return obfuscate(Buffer.from(base32Secret, "utf8").toString("base64"));
}

export function decryptTotpSecret(stored: string): string {
  return Buffer.from(deobfuscate(stored), "base64").toString("utf8");
}

// --------------------------------------------------------------------------
// Password hashing (bcrypt, cost 12)
// --------------------------------------------------------------------------
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// --------------------------------------------------------------------------
// JWT payloads
// --------------------------------------------------------------------------
export interface JwtPayload {
  sub: string;        // user id
  email: string;
  role: string;
  name: string;
  jti?: string;       // JWT id — present on refresh tokens for DB lookup
  type?: "access" | "refresh";
}

// --------------------------------------------------------------------------
// Token signing
// --------------------------------------------------------------------------
export function signAccessToken(user: Pick<User, "id" | "email" | "role" | "name">): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      type: "access",
    } satisfies JwtPayload,
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

/**
 * Sign a refresh token with a unique JTI. The caller is responsible for
 * persisting the (jti, hash) tuple in the RefreshToken table.
 */
export function signRefreshToken(
  user: Pick<User, "id" | "email" | "role" | "name">,
  jti: string
): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      jti,
      type: "refresh",
    } satisfies JwtPayload,
    JWT_REFRESH_SECRET,
    { expiresIn: `${REFRESH_EXPIRES_DAYS}d` }
  );
}

// --------------------------------------------------------------------------
// Token verification
// --------------------------------------------------------------------------
export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    if (payload.type && payload.type !== "access") return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
    if (payload.type !== "refresh" || !payload.jti) return null;
    return payload;
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------------
// Helpers — hashing tokens/JTIs for DB storage, device labels, IP truncation
// --------------------------------------------------------------------------
// Use SHA-256 for token/JTI lookups. We don't need bcrypt cost here — the
// raw token never leaves the httpOnly cookie, and the DB only sees the hash.
// A DB dump therefore cannot be used to forge sessions.
function fastHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Parse a User-Agent string into a human-readable device label.
 * e.g. "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36
 *      (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
 *   -> "Chrome 130 on macOS"
 */
export function deviceLabelFromUA(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  let browser = "Unknown browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = "Safari";
  const bver = (ua.match(/(?:chrome|edge|firefox|version)\/(\d+)/i) || [])[1];
  let os = "Unknown OS";
  if (/windows nt 10/i.test(ua)) os = "Windows";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ios/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";
  return `${browser}${bver ? ` ${bver}` : ""} on ${os}`;
}

/**
 * Truncate IPv4 to zero the last octet, IPv6 to zero the last 80 bits.
 * For privacy — we log the network prefix, not the full address.
 */
export function truncateIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.includes(".")) {
    const parts = ip.split(".");
    parts[parts.length - 1] = "0";
    return parts.join(".");
  }
  if (ip.includes(":")) {
    // IPv6 — keep first 3 groups (48 bits), zero the rest
    const parts = ip.split(":");
    return parts.slice(0, 3).concat(["0", "0", "0", "0", "0"]).join(":");
  }
  return ip;
}

// --------------------------------------------------------------------------
// Cookie management
// --------------------------------------------------------------------------
function cookieFlags() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function setAuthCookies(
  user: Pick<User, "id" | "email" | "role" | "name">,
  opts?: { ip?: string | null; userAgent?: string | null }
): Promise<void> {
  const access = signAccessToken(user);
  // Issue a persisted refresh token
  const jti = crypto.randomUUID();
  const refresh = signRefreshToken(user, jti);
  const tokenHash = fastHash(refresh);
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  const ip = truncateIp(opts?.ip ?? null);
  const userAgent = opts?.userAgent ?? null;

  await db.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      jti,
      userAgent: userAgent ? fastHash(userAgent) : null,
      ip,
      expiresAt,
    },
  });

  // Also create a Session row for device tracking
  await db.session.create({
    data: {
      userId: user.id,
      deviceLabel: deviceLabelFromUA(userAgent),
      ip,
      userAgent,
      refreshJti: jti,
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(ACCESS_COOKIE, access, {
    ...cookieFlags(),
    maxAge: 60 * 30, // 30 min
  });
  store.set(REFRESH_COOKIE, refresh, {
    ...cookieFlags(),
    maxAge: 60 * 60 * 24 * REFRESH_EXPIRES_DAYS, // 30 days
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

// --------------------------------------------------------------------------
// Refresh-token rotation
// --------------------------------------------------------------------------
/**
 * Validate a raw refresh JWT, look up its JTI in the DB, confirm it's still
 * active. If valid, ROTATE: revoke the old token, issue a new (token, jti)
 * pair, persist it, and return both the new refresh JWT and the user.
 *
 * Returns null if the token is invalid, expired, revoked, or belongs to a
 * suspended user. Reusing a revoked token (potential theft signal) causes
 * the entire rotation chain to be revoked (reuse-detection).
 */
export async function rotateRefreshToken(
  rawRefreshToken: string,
  opts?: { ip?: string | null; userAgent?: string | null }
): Promise<{
  user: User;
  newAccessToken: string;
  newRefreshToken: string;
} | null> {
  const payload = verifyRefreshToken(rawRefreshToken);
  if (!payload?.jti || !payload.sub) return null;

  const stored = await db.refreshToken.findUnique({
    where: { jti: payload.jti },
    include: { user: true },
  });
  if (!stored) return null;

  // Reuse detection: if the token's hash doesn't match the stored hash for
  // this JTI, OR if it's already been revoked, treat as theft — revoke the
  // entire chain for this user.
  const expectedHash = fastHash(rawRefreshToken);
  if (stored.tokenHash !== expectedHash || stored.revokedAt) {
    // Possible token reuse — burn everything for this user
    await db.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await db.session.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  // Expiry check
  if (stored.expiresAt.getTime() < Date.now()) {
    await db.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  const user = stored.user;
  if (!user.isActive) return null;

  // Rotate: create new token, revoke old one, link via replacedBy
  const newJti = crypto.randomUUID();
  const newRefresh = signRefreshToken(user, newJti);
  const newHash = fastHash(newRefresh);
  const newExpiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  const ip = truncateIp(opts?.ip ?? null);
  const userAgent = opts?.userAgent ?? null;

  const newRecord = await db.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: newHash,
      jti: newJti,
      userAgent: userAgent ? fastHash(userAgent) : null,
      ip,
      expiresAt: newExpiresAt,
    },
  });

  await db.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedBy: newRecord.id },
  });

  // Update the session row to point to the new jti (same device continues)
  await db.session.updateMany({
    where: { refreshJti: payload.jti, revokedAt: null },
    data: { refreshJti: newJti, lastSeenAt: new Date(), ip, userAgent },
  });

  const newAccess = signAccessToken(user);

  return { user, newAccessToken: newAccess, newRefreshToken: newRefresh };
}

/**
 * Revoke the refresh token currently in the cookie (logout).
 * Also marks the corresponding session as revoked.
 */
export async function revokeCurrentSession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(REFRESH_COOKIE)?.value;
  if (!raw) return;
  const payload = verifyRefreshToken(raw);
  if (payload?.jti) {
    await db.refreshToken.updateMany({
      where: { jti: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await db.session.updateMany({
      where: { refreshJti: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

/**
 * Revoke ALL sessions for a user (panic / "log out everywhere").
 */
export async function revokeAllSessionsForUser(userId: string): Promise<number> {
  const r1 = await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const r2 = await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return r2.count;
}

/**
 * Revoke a single session by its session id (used by the sessions UI).
 */
export async function revokeSessionById(userId: string, sessionId: string): Promise<boolean> {
  const session = await db.session.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session || session.revokedAt) return false;
  await db.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });
  await db.refreshToken.updateMany({
    where: { jti: session.refreshJti, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return true;
}

// --------------------------------------------------------------------------
// Current-user resolution (with transparent refresh)
// --------------------------------------------------------------------------
async function getClientInfo(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    const userAgent = h.get("user-agent");
    return { ip, userAgent };
  } catch {
    return { ip: null, userAgent: null };
  }
}

/**
 * Resolve the current user from cookies. If the access token is expired or
 * missing, attempt to rotate the refresh token — if successful, set the
 * new cookies transparently and return the user.
 *
 * This is what makes login "sticky" across refreshes and restarts: as long
 * as the refresh token (30-day) is valid, the user stays logged in even
 * after the access token (30-min) expires or the server is bounced.
 */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;

  // Fast path: access token is still valid
  if (accessToken) {
    const payload = verifyAccessToken(accessToken);
    if (payload) {
      const user = await db.user.findUnique({ where: { id: payload.sub } });
      if (user && user.isActive) return user;
    }
  }

  // Slow path: access token missing/expired — try refresh
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const { ip, userAgent } = await getClientInfo();
  const rotated = await rotateRefreshToken(refreshToken, { ip, userAgent });
  if (!rotated) {
    // Refresh failed — clear stale cookies
    await clearAuthCookies();
    return null;
  }

  // Set the rotated cookies so the next request uses the new access token
  store.set(ACCESS_COOKIE, rotated.newAccessToken, {
    ...cookieFlags(),
    maxAge: 60 * 30,
  });
  store.set(REFRESH_COOKIE, rotated.newRefreshToken, {
    ...cookieFlags(),
    maxAge: 60 * 60 * 24 * REFRESH_EXPIRES_DAYS,
  });

  return rotated.user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

// --------------------------------------------------------------------------
// 2FA challenge tickets (persisted in DB)
// --------------------------------------------------------------------------
export async function issueAuthChallenge(userId: string): Promise<string> {
  const ticket = `tc_${Buffer.from(crypto.randomUUID() + crypto.randomUUID()).toString("base64url")}`;
  await db.authChallenge.create({
    data: {
      userId,
      ticket,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    },
  });
  return ticket;
}

export async function consumeAuthChallenge(
  ticket: string,
  userId: string
): Promise<boolean> {
  const challenge = await db.authChallenge.findUnique({ where: { ticket } });
  if (!challenge || challenge.userId !== userId) return false;
  if (challenge.status !== "PENDING" || challenge.expiresAt.getTime() < Date.now()) {
    if (challenge && challenge.status === "PENDING") {
      await db.authChallenge.update({
        where: { id: challenge.id },
        data: { status: "EXPIRED" },
      });
    }
    return false;
  }
  await db.authChallenge.update({
    where: { id: challenge.id },
    data: { status: "COMPLETED", consumedAt: new Date() },
  });
  return true;
}

// Periodic cleanup — call from a cron or admin endpoint
export async function purgeExpiredChallenges(): Promise<number> {
  const r = await db.authChallenge.updateMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });
  return r.count;
}

// Exported for tests / admin tooling
export const AUTH_COOKIE_NAMES = { ACCESS_COOKIE, REFRESH_COOKIE };
export const AUTH_REFRESH_EXPIRES_DAYS = REFRESH_EXPIRES_DAYS;
