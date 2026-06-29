import { db } from "@/lib/db";
import { clearAuthCookies, getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error } from "@/lib/api";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (user) {
      await audit({ actorId: user.id, action: "USER_LOGOUT", resourceType: "User", resourceId: user.id });
    }
    await clearAuthCookies();
    return json({ ok: true });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Logout failed", 500);
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ user: null });
  // Determine if a fund exists so the client knows to redirect admin to seed if empty
  const fundCount = await db.fund.count();
  return json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, lastLogin: user.lastLogin, createdAt: user.createdAt },
    hasFund: fundCount > 0,
  });
}
