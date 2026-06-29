import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db } from "./db";
import type { User } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "nightmare-invest-dev-secret-change-in-production";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "nightmare-invest-dev-refresh-secret-change";
const ACCESS_EXPIRES = "30m";
const REFRESH_EXPIRES_DAYS = 7;

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
