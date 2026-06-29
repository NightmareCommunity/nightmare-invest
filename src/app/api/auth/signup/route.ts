import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, setAuthCookies } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await parseBody<{ name: string; email: string; password: string }>(req);

    if (!name || !email || !password) {
      return error("Name, email and password are required", 422);
    }
    if (password.length < 8) {
      return error("Password must be at least 8 characters", 422);
    }

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return error("An account with this email already exists", 409);
    }

    // First user becomes admin
    const userCount = await db.user.count();
    const role = userCount === 0 ? "ADMIN" : "USER";

    const user = await db.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash: await hashPassword(password),
        role,
        lastLogin: new Date(),
      },
    });

    await setAuthCookies(user);
    await audit({ actorId: user.id, action: "USER_SIGNUP", resourceType: "User", resourceId: user.id });

    return json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Signup failed", 500);
  }
}
