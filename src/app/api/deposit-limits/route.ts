import { db } from "@/lib/db";
import { json, safeHandler } from "@/lib/api";

const SUPPORTED_CRYPTO = ["BTC", "LTC", "USDT"];
const SUPPORTED_METHODS = ["UPI", "BTC", "LTC", "USDT"];

const DEFAULT_MIN_INR = 1000;
const DEFAULT_MIN_CRYPTO_USD = 10;

function safeNumber(raw: string, fallback: number): number {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
}

/**
 * GET /api/deposit-limits
 * Public (no auth) — returns the current minimum deposit thresholds so the
 * frontend can display them on deposit/withdrawal screens.
 *
 * Response:
 *   {
 *     "minInrDeposit": 1000,
 *     "minCryptoDepositUsd": 10,
 *     "supportedCrypto": ["BTC","LTC","USDT"],
 *     "supportedMethods": ["UPI","BTC","LTC","USDT"]
 *   }
 */
export const GET = safeHandler(async () => {
  const [inrRow, cryptoRow] = await Promise.all([
    db.systemSetting.findUnique({ where: { key: "minInrDeposit" } }),
    db.systemSetting.findUnique({ where: { key: "minCryptoDepositUsd" } }),
  ]);

  const minInrDeposit = inrRow ? safeNumber(inrRow.value, DEFAULT_MIN_INR) : DEFAULT_MIN_INR;
  const minCryptoDepositUsd = cryptoRow ? safeNumber(cryptoRow.value, DEFAULT_MIN_CRYPTO_USD) : DEFAULT_MIN_CRYPTO_USD;

  return json({
    minInrDeposit,
    minCryptoDepositUsd,
    supportedCrypto: SUPPORTED_CRYPTO,
    supportedMethods: SUPPORTED_METHODS,
  });
});
