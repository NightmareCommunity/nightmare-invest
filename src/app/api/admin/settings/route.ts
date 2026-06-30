import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody, safeHandler } from "@/lib/api";

/**
 * GET /api/admin/settings
 * Returns all system settings grouped by category, with defaults applied.
 */
export const GET = safeHandler(async () => {
  await requireAdmin();
  const rows = await db.systemSetting.findMany();
  const map: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      map[r.key] = JSON.parse(r.value);
    } catch {
      map[r.key] = r.value;
    }
  }
  // Merge with defaults
  const settings = { ...DEFAULT_SETTINGS, ...map };
  return json({ settings });
});

/**
 * PUT /api/admin/settings
 * Upserts one or more settings. Body: { settings: { key: value, ... } }
 */
export const PUT = safeHandler(async (req: NextRequest) => {
  const admin = await requireAdmin();
  const body = await parseBody<{ settings?: Record<string, unknown> }>(req);
  if (!body.settings || typeof body.settings !== "object") {
    return error("settings object required", 422);
  }

  const updated: string[] = [];
  for (const [key, value] of Object.entries(body.settings)) {
    const category = SETTING_CATEGORIES[key] ?? "general";
    await db.systemSetting.upsert({
      where: { key },
      update: {
        value: JSON.stringify(value),
        category,
        updatedBy: admin.id,
      },
      create: {
        key,
        value: JSON.stringify(value),
        category,
        updatedBy: admin.id,
      },
    });
    updated.push(key);
  }

  await audit({
    actorId: admin.id,
    action: "ADMIN_SETTINGS_UPDATED",
    resourceType: "SystemSetting",
    metadata: { keys: updated },
  });

  return json({ ok: true, updated });
});

/* -------------------- Defaults & category map -------------------- */

const SETTING_CATEGORIES: Record<string, string> = {
  // general
  platformName: "general",
  supportEmail: "general",
  environment: "general",
  maintenanceMode: "general",
  // security
  passwordMinLength: "security",
  sessionTimeoutMin: "security",
  enforce2FA: "security",
  ipAllowlist: "security",
  maxLoginAttempts: "security",
  // fees
  managementFeePct: "fees",
  performanceFeePct: "fees",
  highWaterMark: "fees",
  minInvestment: "fees",
  // deposits — minimum deposit thresholds
  minInrDeposit: "deposits",
  minCryptoDepositUsd: "deposits",
  // notifications
  emailNotifications: "notifications",
  adminAlertEmail: "notifications",
  depositAlertEnabled: "notifications",
  withdrawalAlertEnabled: "notifications",
};

const DEFAULT_SETTINGS: Record<string, unknown> = {
  // general
  platformName: "NIGHTMARE INVEST",
  supportEmail: "ir@nightmare.invest",
  environment: "production",
  maintenanceMode: false,
  // security
  passwordMinLength: 8,
  sessionTimeoutMin: 30,
  enforce2FA: false,
  ipAllowlist: "",
  maxLoginAttempts: 5,
  // fees
  managementFeePct: 2,
  performanceFeePct: 20,
  highWaterMark: true,
  minInvestment: 50000,
  // deposits — minimum deposit thresholds (INR ₹1000, Crypto $10 USD)
  minInrDeposit: 1000,
  minCryptoDepositUsd: 10,
  // notifications
  emailNotifications: true,
  adminAlertEmail: "ops@nightmare.invest",
  depositAlertEnabled: true,
  withdrawalAlertEnabled: true,
};
