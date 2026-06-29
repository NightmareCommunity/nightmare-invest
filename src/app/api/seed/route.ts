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

    // 9. Seed fund updates (news/commentary)
    const existingUpdates = await db.fundUpdate.count();
    if (existingUpdates === 0) {
      const adminUser = await db.user.findFirst({ where: { role: "ADMIN" } });
      const updates = [
        { title: "Q2 2026 Performance Update", body: "The fund delivered +18.4% in Q2 2026, outperforming BTC (+12.1%) and ETH (+9.8%). Our multi-strategy approach with concentrated BTC exposure and tactical alt positions drove strong alpha generation. Key contributors: BTC momentum, SOL DeFi yield, and timely ETH positions ahead of the Pectra upgrade.", category: "PERFORMANCE", priority: "IMPORTANT", pinned: true },
        { title: "Portfolio Rebalance Effective July 1", body: "Following the investment committee's quarterly review, we are adjusting allocations: BTC 40%→38%, ETH 25%→27%, SOL 15%→15%, Stablecoins 10%→8%, Altcoins 10%→12%. The shift reflects growing confidence in ETH's ecosystem momentum and selective alt opportunities in the AI+crypto convergence theme.", category: "STRATEGY", priority: "IMPORTANT", pinned: false },
        { title: "New Custody Partnership with Fireblocks", body: "We are pleased to announce our partnership with Fireblocks for enhanced institutional custody. All fund assets are now secured with MPC-TSS technology, multi-layer approval workflows, and $150M insurance coverage. This upgrade reinforces our commitment to institutional-grade security standards.", category: "GENERAL", priority: "NORMAL", pinned: false },
        { title: "Market Outlook: Navigating Q3 Volatility", body: "With the Fed rate decision and BTC halving effects still unfolding, we anticipate elevated volatility in Q3. Our risk management framework has reduced net exposure by 5% and increased stablecoin allocation as a tactical buffer. The fund remains well-positioned to capitalize on dislocations while protecting downside.", category: "MARKET", priority: "NORMAL", pinned: false },
        { title: "Regulatory Update: MiCA Compliance", body: "In line with the EU Markets in Crypto-Assets (MiCA) regulation taking effect, Nightmare Invest has completed all compliance requirements. Our registration and operational procedures have been updated to ensure full regulatory alignment across all jurisdictions we serve.", category: "REGULATORY", priority: "NORMAL", pinned: false },
        { title: "Monthly NAV Update — June 2026", body: "NAV as of June 30, 2026: $176.9572 per unit. Monthly return: +6.2%. AUM: $64.28M across 2 investor accounts. The fund continues its upward trajectory with disciplined risk management and strategic asset allocation.", category: "PERFORMANCE", priority: "NORMAL", pinned: false },
      ];
      for (const u of updates) {
        await db.fundUpdate.create({
          data: { ...u, authorId: adminUser?.id ?? null, createdAt: new Date(Date.now() - Math.random() * 30 * 86400000) },
        });
      }
      // Re-pin the first update to ensure it's the most recent
      await db.fundUpdate.updateMany({ where: { pinned: true }, data: { createdAt: new Date() } });
    }

    // 10. Seed watchlist items for demo investor
    const existingWatchlist = await db.watchlistItem.count({ where: { userId: demo.id } });
    if (existingWatchlist === 0) {
      const watchlistItems = [
        { symbol: "bitcoin", name: "Bitcoin", alertPrice: 70000, alertDirection: "ABOVE", notes: "Breakout level — key resistance" },
        { symbol: "ethereum", name: "Ethereum", alertPrice: 3200, alertDirection: "BELOW", notes: "Buy zone support" },
        { symbol: "solana", name: "Solana", alertPrice: 200, alertDirection: "ABOVE", notes: "Momentum trigger" },
      ];
      for (const w of watchlistItems) {
        await db.watchlistItem.create({
          data: { userId: demo.id, ...w },
        });
      }
    }

    // 11. Admin messages seed
    const adminUser = await db.user.findFirst({ where: { role: "ADMIN" } });
    const investorUser = await db.user.findFirst({ where: { role: "USER" } });
    if (adminUser) {
      const existingMsgs = await db.adminMessage.count();
      if (existingMsgs === 0) {
        await db.adminMessage.createMany({
          data: [
            {
              senderId: adminUser.id,
              recipientId: investorUser?.id,
              subject: "Welcome to Nightmare Alpha Crypto Fund",
              body: "Dear Investor,\n\nWelcome to the Nightmare Invest portal. Your account has been set up and you now have access to your personal dashboard, portfolio analytics, and transaction management tools.\n\nPlease review your holdings and familiarize yourself with the platform. Our investor relations team is available at ir@nightmare.invest for any questions.\n\nBest regards,\nNightmare Invest Management",
              priority: "IMPORTANT",
              isBroadcast: false,
              isRead: false,
            },
            {
              senderId: adminUser.id,
              recipientId: null,
              subject: "Q3 2026 Investment Outlook",
              body: "Dear Investors,\n\nAs we enter Q3 2026, the crypto market continues to show strong momentum with institutional adoption accelerating across multiple sectors.\n\nKey highlights:\n- Bitcoin ETF inflows reached new highs in June\n- Ethereum's Pectra upgrade has enhanced staking economics\n- Our fund's risk-adjusted returns remain top-quartile\n\nWe remain constructive on the market and will continue to actively manage positions to maximize alpha generation.\n\nNightmare Invest Investment Committee",
              priority: "NORMAL",
              isBroadcast: true,
              isRead: false,
            },
            {
              senderId: adminUser.id,
              recipientId: null,
              subject: "Scheduled Maintenance Window — July 5",
              body: "Please be advised that our platform will undergo scheduled maintenance on July 5, 2026, from 02:00 UTC to 06:00 UTC.\n\nDuring this period, the portal may be temporarily unavailable. All pending transactions will be processed after the maintenance window.\n\nThank you for your patience.\n\nOperations Team",
              priority: "URGENT",
              isBroadcast: true,
              isRead: false,
            },
          ],
        });
      }
    }

    // 12. Audit bootstrap (using the hash-chained audit() helper)
    const { audit } = await import("@/lib/audit");
    await audit({
      action: "SYSTEM_SEED",
      resourceType: "Fund",
      resourceId: fund.id,
      metadata: { note: "Initial fund + demo data seeded" },
    });

    return json({ ok: true, fund: { id: fund.id, name: fund.name, slug: fund.slug }, demoInvestor: { email: demoEmail, password: "investor123" } });
  } catch (e) {
    console.error(e);
    return error(e instanceof Error ? e.message : "Seed failed", 500);
  }
}
