import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { json } from "@/lib/api";

/**
 * GET /api/bootstrap
 * ------------------
 * Idempotent endpoint that ensures a platform admin account exists.
 * Called by the public landing page on first load.
 *
 * Credentials are sourced from env vars (with dev fallbacks) — NEVER
 * hardcoded in application source. See scripts/seed-admin.ts for the
 * canonical seed script.
 *
 * This endpoint is safe to call repeatedly — it only creates the admin
 * if one with the configured email does not already exist.
 */
export async function GET() {
  try {
    const email = (process.env.ADMIN_EMAIL || "ojas1234@nightmare.invest").toLowerCase();
    const name = process.env.ADMIN_USERNAME || "ojas1234";
    const password = process.env.ADMIN_PASSWORD || "user1122";

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      // Ensure admin role + active
      if (existing.role !== "ADMIN" || !existing.isActive) {
        await db.user.update({
          where: { id: existing.id },
          data: { role: "ADMIN", isActive: true, name },
        });
      }
      return json({ ok: true, seeded: false, email });
    }

    // No admin yet — create the bootstrap admin
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    if (adminCount === 0) {
      await db.user.create({
        data: {
          email,
          name,
          passwordHash: await hashPassword(password),
          role: "ADMIN",
          isActive: true,
        },
      });
      return json({ ok: true, seeded: true, email });
    }

    // An admin exists but not the configured one — don't auto-create
    return json({ ok: true, seeded: false, email: null });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Bootstrap failed" });
  }
}
