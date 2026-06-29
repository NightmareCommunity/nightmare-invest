import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { json, error } from "@/lib/api";

// POST /api/seed — idempotent bootstrap of the Nightmare Alpha fund + demo data.
// Protected: requires an existing admin account (the first signup auto-becomes admin).
export async function POST(req: NextRequest) {
  try {
    // Require an admin to exist already (first signup = admin). If none, allow seed (bootstrap).
    const adminEmail = req.headers.get("x-seed-admin-email");
    if (adminEmail) {
      const admin = await db.user.findUnique({ where: { email: adminEmail.toLowerCase() } });
      if (!admin || admin.role !== "ADMIN") return error("Admin required to seed", 403);
    }

    // 1. Fund
    let fund = await db.fund.findUnique({ where: { slug: "nightmare-alpha" } });
    if (!fund) {
      fund = await db.fund.create({
        data: {
          name: "Nightmare Alpha Crypto Fund",
          slug: "nightmare-alpha",
          description:
            "A flagship institutional crypto hedge fund delivering asymmetric alpha through disciplined allocation across Bitcoin, Ethereum, Solana, stablecoin yield strategies, and high-conviction digital assets. Managed by the Nightmare Invest investment committee.",
          minInvest: 50000,
          feeStructure: "2% management fee / 20% performance fee (high-water mark)",
          inceptionNav: 100,
          isActive: true,
        },
      });
    }

    // 2. Allocations
    const allocs = [
      { asset: "Bitcoin (BTC)", weight: 40, color: "#F7931A" },
      { asset: "Ethereum (ETH)", weight: 25, color: "#627EEA" },
      { asset: "Solana (SOL)", weight: 15, color: "#14F195" },
      { asset: "Stablecoin Yield", weight: 10, color: "#4A90E2" },
      { asset: "High Conviction Altcoins", weight: 10, color: "#D4AF37" },
    ];
    await db.allocation.deleteMany({ where: { fundId: fund.id } });
    for (const a of allocs) {
      await db.allocation.create({ data: { fundId: fund.id, ...a } });
    }

    // 3. NAV history (~ 18 months of daily points with realistic upward drift + volatility)
    await db.nAVPoint.deleteMany({ where: { fundId: fund.id } });
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1, start.getMonth() - 6, 1);
    start.setHours(0, 0, 0, 0);

    let nav = fund.inceptionNav;
    let aum = 25_000_000; // seed AUM $25M
    const dayMs = 86400000;
    const totalDays = Math.floor((Date.now() - start.getTime()) / dayMs);
    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(start.getTime() + i * dayMs);
      // drift ~ +0.12% per day with volatility 1.6%
      const drift = 0.0012;
      const vol = 0.016;
      const shock = (Math.random() - 0.5) * 2 * vol;
      nav = nav * (1 + drift + shock);
      // AUM grows with deposits trend + nav
      aum = aum * (1 + drift * 0.6 + shock * 0.4) + 40_000;
      await db.nAVPoint.create({
        data: { fundId: fund.id, date, nav: Math.round(nav * 10000) / 10000, aum: Math.round(aum) },
      });
    }

    // 4. Demo investor (if not exists)
    const demoEmail = "investor@nightmare.invest";
    let demo = await db.user.findUnique({ where: { email: demoEmail } });
    if (!demo) {
      demo = await db.user.create({
        data: {
          name: "Alexander Whitmore",
          email: demoEmail,
          passwordHash: await hashPassword("investor123"),
          role: "USER",
          lastLogin: new Date(Date.now() - 86400000),
        },
      });
    }

    // 5. Holding for demo investor
    const lastNavPoint = await db.nAVPoint.findFirst({ where: { fundId: fund.id }, orderBy: { date: "desc" } });
    const currentNav = lastNavPoint?.nav ?? fund.inceptionNav;
    const invested = 500_000;
    const unitsAtAvg = invested / (currentNav * 0.82); // bought earlier when nav was lower
    await db.holding.upsert({
      where: { userId_fundId: { userId: demo.id, fundId: fund.id } },
      update: { units: unitsAtAvg, avgPrice: currentNav * 0.82 },
      create: { userId: demo.id, fundId: fund.id, units: unitsAtAvg, avgPrice: currentNav * 0.82 },
    });

    // 6. Ledger entries for demo
    await db.ledgerEntry.deleteMany({ where: { userId: demo.id } });
    const accountId = `${demo.id}-${fund.id}`;
    let balance = 0;
    const ledgerDeposits = [200_000, 150_000, 100_000, 50_000];
    for (const amt of ledgerDeposits) {
      balance += amt;
      await db.ledgerEntry.create({
        data: { userId: demo.id, accountId, amount: amt, type: "DEPOSIT", balanceAfter: balance, createdAt: new Date(Date.now() - Math.random() * 60 * 86400000) },
      });
    }
    // one withdrawal
    balance -= 40_000;
    await db.ledgerEntry.create({
      data: { userId: demo.id, accountId, amount: -40_000, type: "WITHDRAWAL", balanceAfter: balance, createdAt: new Date(Date.now() - 12 * 86400000) },
    });

    // 7. Sample transactions (some pending for admin to review)
    const existingTx = await db.transaction.count({ where: { userId: demo.id } });
    if (existingTx === 0) {
      await db.transaction.create({ data: { userId: demo.id, fundId: fund.id, type: "DEPOSIT", amount: 250_000, status: "PENDING", notes: "Q4 capital allocation" } });
      await db.transaction.create({ data: { userId: demo.id, fundId: fund.id, type: "WITHDRAWAL", amount: 75_000, status: "PENDING", notes: "Liquidity for portfolio rebalance" } });
      await db.transaction.create({ data: { userId: demo.id, fundId: fund.id, type: "DEPOSIT", amount: 100_000, status: "APPROVED", processedAt: new Date(Date.now() - 30 * 86400000) } });
      await db.transaction.create({ data: { userId: demo.id, fundId: fund.id, type: "DEPOSIT", amount: 50_000, status: "REJECTED", notes: "Insufficient KYC documentation", processedAt: new Date(Date.now() - 45 * 86400000) } });
    }

    // 8. Seed market prices cache (fallback values)
    const seeds = [
      { symbol: "bitcoin", name: "Bitcoin", priceUsd: 67250.4, change24h: 2.34 },
      { symbol: "ethereum", name: "Ethereum", priceUsd: 3520.18, change24h: 3.12 },
      { symbol: "solana", name: "Solana", priceUsd: 178.92, change24h: 5.67 },
    ];
    for (const s of seeds) {
      await db.marketPrice.upsert({
        where: { symbol: s.symbol },
        update: { priceUsd: s.priceUsd, change24h: s.change24h, name: s.name },
        create: { ...s },
      });
    }

    // 9. Audit bootstrap
    await db.auditLog.create({
      data: {
        action: "SYSTEM_SEED",
        resourceType: "Fund",
        resourceId: fund.id,
        metadata: JSON.stringify({ note: "Initial fund + demo data seeded" }),
      },
    });

    return json({ ok: true, fund: { id: fund.id, name: fund.name, slug: fund.slug }, demoInvestor: { email: demoEmail, password: "investor123" } });
  } catch (e) {
    console.error(e);
    return error(e instanceof Error ? e.message : "Seed failed", 500);
  }
}
