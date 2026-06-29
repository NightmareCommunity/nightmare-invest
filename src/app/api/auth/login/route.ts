import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, setAuthCookies } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await parseBody<{ email: string; password: string }>(req);
    if (!email || !password) return error("Email and password are required", 422);

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return error("Invalid credentials", 401);
    if (!user.isActive) return error("Account suspended. Contact your fund manager.", 403);

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return error("Invalid credentials", 401);

    await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    await setAuthCookies(user);
    await audit({ actorId: user.id, action: "USER_LOGIN", resourceType: "User", resourceId: user.id });

    return json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Login failed", 500);
  }
}
