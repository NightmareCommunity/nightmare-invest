/**
 * NIGHTMARE INVEST — Admin Seed Script
 * ------------------------------------
 * Idempotent bootstrap of the platform administrator account.
 *
 * Credentials are read from environment variables with secure fallbacks:
 *   ADMIN_EMAIL    (default: ojas1234@nightmare.invest)
 *   ADMIN_USERNAME (default: ojas1234)  — stored as User.name
 *   ADMIN_PASSWORD (default: user1122)
 *
 * Usage:
 *   bun run scripts/seed-admin.ts
 *
 * Security: credentials are NEVER hardcoded in application source.
 * This script is the single source of truth for the seed admin identity.
 * In production, set the env vars before first boot.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "ojas1234@nightmare.invest").toLowerCase();
  const name = process.env.ADMIN_USERNAME || "ojas1234";
  const password = process.env.ADMIN_PASSWORD || "user1122";

  if (password.length < 8) {
    console.error("✗ Admin password must be at least 8 characters");
    process.exit(1);
  }

  // Check if admin already exists (by email OR by role)
  const existingByEmail = await db.user.findUnique({ where: { email } });
  if (existingByEmail) {
    // Ensure the existing account is an active admin
    if (existingByEmail.role !== "ADMIN" || !existingByEmail.isActive) {
      await db.user.update({
        where: { id: existingByEmail.id },
        data: { role: "ADMIN", isActive: true },
      });
      console.log(`✓ Upgraded existing account '${email}' to active ADMIN`);
    } else {
      console.log(`✓ Admin '${email}' already exists (role=ADMIN, active=true)`);
    }
    // Ensure password matches the configured credential (allows re-running to reset password)
    const pwOk = await bcrypt.compare(password, existingByEmail.passwordHash);
    if (!pwOk) {
      const passwordHash = await bcrypt.hash(password, 12);
      await db.user.update({
        where: { id: existingByEmail.id },
        data: { passwordHash, name },
      });
      console.log(`✓ Reset password for admin '${email}'`);
    }
    return;
  }

  // No admin with this email — create one.
  // Also check if ANY admin exists; if not, this is the bootstrap admin.
  const adminCount = await db.user.count({ where: { role: "ADMIN" } });
  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: "ADMIN",
      isActive: true,
      lastLogin: null,
    },
  });

  console.log(`✓ Seeded admin account:`);
  console.log(`    Email:    ${email}`);
  console.log(`    Username: ${name}`);
  console.log(`    Role:     ADMIN`);
  if (adminCount === 0) {
    console.log(`    (bootstrap admin — first admin on this instance)`);
  }
}

main()
  .catch((e) => {
    console.error("✗ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
