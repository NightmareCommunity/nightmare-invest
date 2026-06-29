import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { json } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ user: null, hasFund: false });
  const fundCount = await db.fund.count();
  return json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      totpEnabled: user.totpEnabled,
      kycStatus: user.kycStatus,
      kycTier: user.kycTier,
    },
    hasFund: fundCount > 0,
  });
}
