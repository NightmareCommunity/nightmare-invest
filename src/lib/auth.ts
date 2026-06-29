import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import * as otpauth from "otpauth";
import { db } from "./db";
import type { User } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "nightmare-invest-dev-secret-change-in-production";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "nightmare-invest-dev-refresh-secret-change";
const ACCESS_EXPIRES = "30m";
const REFRESH_EXPIRES_DAYS = 7;

// Simple XOR-based secret obfuscation (NOT real encryption — sufficient for dev SQLite).
// In production, swap with AES-GCM via a KMS-managed key.
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

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name: string;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(user: Pick<User, "id" | "email" | "role" | "name">): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name } satisfies JwtPayload,
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

export function signRefreshToken(user: Pick<User, "id" | "email" | "role" | "name">): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name } satisfies JwtPayload,
    JWT_REFRESH_SECRET,
    { expiresIn: `${REFRESH_EXPIRES_DAYS}d` }
  );
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

const ACCESS_COOKIE = "ni_access";
const REFRESH_COOKIE = "ni_refresh";

export async function setAuthCookies(
  user: Pick<User, "id" | "email" | "role" | "name">
): Promise<void> {
  const access = signAccessToken(user);
  const refresh = signRefreshToken(user);
  const store = await cookies();
  store.set(ACCESS_COOKIE, access, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });
  store.set(REFRESH_COOKIE, refresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * REFRESH_EXPIRES_DAYS,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyAccessToken(token);
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) return null;
  return user;
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
