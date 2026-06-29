import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, verifyTotpToken, decryptTotpSecret } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody, safeHandler } from "@/lib/api";

// POST /api/auth/2fa/verify — verify a 6-digit TOTP code.
// Two modes:
//   1. If user has NOT yet enabled 2FA (totpEnabled=false but totpSecret exists from setup),
//      this confirms the setup and enables 2FA.
//   2. If user HAS enabled 2FA (totpEnabled=true), this simply validates the code
//      and returns { verified: true } — used for high-value operation verification.
export const POST = safeHandler(async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);

  const { code, purpose } = await parseBody<{ code: string; purpose?: string }>(req);
  if (!code || code.length !== 6) return error("A 6-digit code is required", 422);

  if (!user.totpSecret) return error("No 2FA setup found. Call /api/auth/2fa/setup first.", 422);

  const secret = decryptTotpSecret(user.totpSecret);
  const ok = verifyTotpToken(code, secret);
  if (!ok) return error("Invalid verification code", 401);

  // Mode 1: Enabling 2FA for the first time
  if (!user.totpEnabled) {
    await db.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
    await audit({
      actorId: user.id,
      action: "2FA_ENABLED",
      resourceType: "User",
      resourceId: user.id,
    });
    return json({ enabled: true, verified: true });
  }

  // Mode 2: Verifying an already-enabled 2FA code (e.g., high-value operation)
  await audit({
    actorId: user.id,
    action: "2FA_VERIFIED",
    resourceType: "User",
    resourceId: user.id,
    metadata: purpose ? { purpose } : undefined,
  });
  return json({ verified: true });
});
