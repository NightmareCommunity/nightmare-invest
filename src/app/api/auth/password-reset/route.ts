import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody } from "@/lib/api";

// In a real system this would email a token. For this portal we allow direct reset if email exists.
export async function POST(req: NextRequest) {
  try {
    const { email, newPassword } = await parseBody<{ email: string; newPassword?: string }>(req);
    if (!email) return error("Email is required", 422);

    const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      // Don't leak existence
      return json({ ok: true, message: "If the account exists, a reset link has been sent." });
    }

    if (!newPassword) {
      // Request reset flow
      await audit({ actorId: user.id, action: "PASSWORD_RESET_REQUESTED", resourceType: "User", resourceId: user.id });
      return json({ ok: true, message: "If the account exists, a reset link has been sent." });
    }

    if (newPassword.length < 8) return error("Password must be at least 8 characters", 422);
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
    await audit({ actorId: user.id, action: "PASSWORD_RESET", resourceType: "User", resourceId: user.id });
    return json({ ok: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Reset failed", 500);
  }
}
