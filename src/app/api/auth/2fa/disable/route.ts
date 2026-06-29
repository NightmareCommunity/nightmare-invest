import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, verifyTotpToken, decryptTotpSecret } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody, safeHandler } from "@/lib/api";

// POST /api/auth/2fa/disable — require a valid TOTP code (or password) to disable.
export const POST = safeHandler(async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);
  if (!user.totpEnabled) return error("2FA is not enabled", 422);

  const { code } = await parseBody<{ code?: string }>(req);
  if (!code) return error("Verification code required to disable 2FA", 422);

  if (!user.totpSecret) return error("No 2FA secret on file", 422);
  const secret = decryptTotpSecret(user.totpSecret);
  const ok = verifyTotpToken(code, secret);
  if (!ok) return error("Invalid verification code", 401);

  await db.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null },
  });
  await audit({
    actorId: user.id,
    action: "2FA_DISABLED",
    resourceType: "User",
    resourceId: user.id,
  });
  return json({ enabled: false });
});
