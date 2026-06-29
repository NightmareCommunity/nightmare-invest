import { db } from "@/lib/db";
import { getCurrentUser, generateTotpSecret, encryptTotpSecret } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error } from "@/lib/api";
import QRCode from "qrcode";

// POST /api/auth/2fa/setup — generate a new TOTP secret, return QR data URL (not yet enabled).
// The secret is stored encrypted on the user row but totpEnabled stays false until /verify.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);

  // If already enabled, refuse (use /disable first).
  if (user.totpEnabled) return error("2FA is already enabled. Disable it first to reconfigure.", 422);

  const { secret, uri } = generateTotpSecret(user.email);
  const encrypted = encryptTotpSecret(secret);

  // Persist the (pending) secret so the verify step can confirm it.
  await db.user.update({ where: { id: user.id }, data: { totpSecret: encrypted } });

  const qr = await QRCode.toDataURL(uri, {
    margin: 1,
    width: 220,
    color: { dark: "#0a0a0b", light: "#D4AF37" },
    errorCorrectionLevel: "M",
  });

  return json({ qr, secret, uri });
}

// DELETE /api/auth/2fa/setup — cancel pending setup (clears the unverified secret)
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);
  if (user.totpEnabled) return error("2FA is active. Use /api/auth/2fa/disable to remove.", 422);

  await db.user.update({ where: { id: user.id }, data: { totpSecret: null } });
  await audit({
    actorId: user.id,
    action: "2FA_SETUP_CANCELLED",
    resourceType: "User",
    resourceId: user.id,
  });
  return json({ success: true });
}
