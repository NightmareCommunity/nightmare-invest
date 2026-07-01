import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody, safeHandler } from "@/lib/api";
import { getCryptoPriceUsd } from "@/lib/market";

const VALID_METHODS = ["UPI", "BTC", "LTC", "USDT"] as const;
type DepositMethod = (typeof VALID_METHODS)[number];
const CRYPTO_METHODS: DepositMethod[] = ["BTC", "LTC", "USDT"];

interface DepositLimits {
  minInrDeposit: number;
  minCryptoDepositUsd: number;
}

async function getDepositLimits(): Promise<DepositLimits> {
  const [inrRow, cryptoRow] = await Promise.all([
    db.systemSetting.findUnique({ where: { key: "minInrDeposit" } }),
    db.systemSetting.findUnique({ where: { key: "minCryptoDepositUsd" } }),
  ]);
  const minInrDeposit = inrRow ? safeNumber(inrRow.value, 1000) : 1000;
  const minCryptoDepositUsd = cryptoRow ? safeNumber(cryptoRow.value, 10) : 10;
  return { minInrDeposit, minCryptoDepositUsd };
}

function safeNumber(raw: string, fallback: number): number {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);
  const transactions = await db.transaction.findMany({
    where: { userId: user.id },
    include: { fund: true, processor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return json({ transactions });
}

interface CreateTxnBody {
  type: string;
  amount: number;
  fundId: string;
  notes?: string;
  method?: string;
  cryptoAmount?: number;
  proofRef?: string;
}

export const POST = safeHandler(async (req: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);

  const { type, amount, fundId, notes, method: rawMethod, cryptoAmount, proofRef } = await parseBody<CreateTxnBody>(req);

  if (!["DEPOSIT", "WITHDRAWAL"].includes(type)) return error("Invalid type", 422);
  if (!amount || amount <= 0) return error("Amount must be positive", 422);
  if (!fundId) return error("fundId required", 422);

  const fund = await db.fund.findUnique({ where: { id: fundId } });
  if (!fund) return error("Fund not found", 404);

  // Method validation (defaults to UPI)
  const method: DepositMethod = VALID_METHODS.includes(rawMethod as DepositMethod)
    ? (rawMethod as DepositMethod)
    : "UPI";

  // Normalise proof reference (UTR for UPI, on-chain tx hash for crypto)
  const normalisedProof = typeof proofRef === "string" ? proofRef.trim() : "";
  // Deposits require a proof reference (UTR / tx hash) so admin can verify payment.
  if (type === "DEPOSIT" && normalisedProof.length < 6) {
    return error(
      method === "UPI"
        ? "Enter the UPI Reference Number (UTR / 12-digit reference) from your payment app"
        : `Enter the ${method} transaction hash as proof of payment`,
      422
    );
  }

  let usdValue: number | null = null;
  let storedCryptoAmount: number | null = null;

  // Minimum-deposit thresholds are enforced ONLY for DEPOSITS.
  // Withdrawals allow partial balances (no minimum).
  if (type === "DEPOSIT") {
    const limits = await getDepositLimits();

    if (method === "UPI") {
      // `amount` is INR for UPI deposits
      if (amount < limits.minInrDeposit) {
        return error(`Minimum INR deposit is ₹${limits.minInrDeposit.toLocaleString()}`, 422);
      }
    } else {
      // Crypto deposit: client must send cryptoAmount (raw crypto)
      if (cryptoAmount == null || cryptoAmount <= 0) {
        return error(`cryptoAmount required for ${method} deposits`, 422);
      }
      storedCryptoAmount = cryptoAmount;

      if (method === "USDT") {
        // 1:1 USD peg
        usdValue = cryptoAmount;
      } else {
        // BTC / LTC — fetch live price and compute USD equivalent
        const price = await getCryptoPriceUsd(method);
        usdValue = cryptoAmount * price;
      }

      if (usdValue < limits.minCryptoDepositUsd) {
        return error(`Minimum crypto deposit is $${limits.minCryptoDepositUsd}`, 422);
      }
    }
  } else {
    // WITHDRAWAL — keep existing balance check, no minimum enforcement
    const holding = await db.holding.findUnique({
      where: { userId_fundId: { userId: user.id, fundId } },
    });
    const lastNav = await db.nAVPoint.findFirst({ where: { fundId }, orderBy: { date: "desc" } });
    const currentNav = lastNav?.nav ?? fund.inceptionNav;
    const currentValue = holding ? holding.units * currentNav : 0;
    if (currentValue < amount) {
      return error(
        `Withdrawal exceeds current portfolio value ($${currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })})`,
        422
      );
    }

    // For crypto withdrawals we still store method/crypto metadata if provided,
    // but skip minimum enforcement as per spec.
    if (CRYPTO_METHODS.includes(method) && cryptoAmount != null && cryptoAmount > 0) {
      storedCryptoAmount = cryptoAmount;
      if (method === "USDT") {
        usdValue = cryptoAmount;
      } else {
        const price = await getCryptoPriceUsd(method);
        usdValue = cryptoAmount * price;
      }
    }
  }

  const txn = await db.transaction.create({
    data: {
      userId: user.id,
      fundId,
      type,
      amount,
      notes: notes ?? null,
      status: "PENDING",
      method,
      cryptoAmount: storedCryptoAmount,
      usdValue,
      proofRef: normalisedProof || null,
    },
  });

  await audit({
    actorId: user.id,
    action: "TRANSACTION_REQUESTED",
    resourceType: "Transaction",
    resourceId: txn.id,
    metadata: { type, amount, fundId, method, cryptoAmount: storedCryptoAmount, usdValue, proofRef: normalisedProof || null },
  });

  return json({ transaction: txn });
});
