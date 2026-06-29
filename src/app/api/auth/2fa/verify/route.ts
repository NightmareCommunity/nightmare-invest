import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, verifyTotpToken, decryptTotpSecret } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody, safeHandler } from "@/lib/api";

// POST /api/auth/2fa/verify — confirm a 6-digit TOTP code & enable 2FA for the user.
export const POST = safeHandler(async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);
  if (user.totpEnabled) return error("2FA is already enabled", 422);
  if (!user.totpSecret) return error("No pending 2FA setup found. Call /api/auth/2fa/setup first.", 422);

  const { code } = await parseBody<{ code: string }>(req);
  if (!code || code.length !== 6) return error("A 6-digit code is required", 422);

  const secret = decryptTotpSecret(user.totpSecret);
  const ok = verifyTotpToken(code, secret);
  if (!ok) return error("Invalid verification code", 401);

  await db.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
  await audit({
    actorId: user.id,
    action: "2FA_ENABLED",
    resourceType: "User",
    resourceId: user.id,
  });
  return json({ enabled: true });
});
