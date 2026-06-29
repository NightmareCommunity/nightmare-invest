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

    // 13. Seed documents vault (3 monthly PDF statements + 1 tax + 1 trade confirmation)
    const existingDocs = await db.document.count({ where: { userId: demo.id } });
    if (existingDocs === 0) {
      const { generateMonthlyStatement, savePdfToDisk, saveUploadedFileToDisk } = await import("@/lib/pdf");
      const adminUserForDocs = await db.user.findFirst({ where: { role: "ADMIN" } });

      // Helper to fetch historical data and build a StatementData object for a given month
      const buildStatement = async (year: number, month: number) => {
        const periodStart = new Date(year, month, 1);
        const periodEnd = new Date(year, month + 1, 0, 23, 59, 59);
        const navPoints = await db.nAVPoint.findMany({
          where: { fundId: fund.id, date: { gte: periodStart, lte: periodEnd } },
          orderBy: { date: "asc" },
        });
        const preNav = await db.nAVPoint.findFirst({
          where: { fundId: fund.id, date: { lt: periodStart } },
          orderBy: { date: "desc" },
        });
        const navStart = preNav?.nav ?? navPoints[0]?.nav ?? fund.inceptionNav;
        const navEnd = navPoints[navPoints.length - 1]?.nav ?? fund.inceptionNav;
        const aum = navPoints[navPoints.length - 1]?.aum ?? 0;

        const holding = await db.holding.findUnique({
          where: { userId_fundId: { userId: demo.id, fundId: fund.id } },
        });
        const unitsEnd = holding?.units ?? 1000;
        const avgCost = holding?.avgPrice ?? navStart;

        // All transactions for the demo user in this period (any status)
        const txns = await db.transaction.findMany({
          where: { userId: demo.id, createdAt: { gte: periodStart, lte: periodEnd } },
          orderBy: { createdAt: "asc" },
        });

        const periodReturnPct = navStart > 0 ? ((navEnd - navStart) / navStart) * 100 : 0;
        const inceptionReturnPct = fund.inceptionNav > 0 ? ((navEnd - fund.inceptionNav) / fund.inceptionNav) * 100 : 0;

        // Compute Sharpe + drawdown
        const series = navPoints.map((p) => p.nav);
        let sharpe = 1.2 + Math.random() * 0.8; // fallback
        if (series.length > 5) {
          const rets: number[] = [];
          for (let i = 1; i < series.length; i++) {
            if (series[i - 1] > 0) rets.push((series[i] - series[i - 1]) / series[i - 1]);
          }
          if (rets.length > 0) {
            const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
            const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
            const std = Math.sqrt(variance);
            sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0;
          }
        }
        let maxDrawdown = 0;
        if (series.length > 1) {
          let peak = series[0];
          for (const v of series) {
            if (v > peak) peak = v;
            const dd = peak > 0 ? ((v - peak) / peak) * 100 : 0;
            if (dd < maxDrawdown) maxDrawdown = dd;
          }
        } else {
          maxDrawdown = -(3 + Math.random() * 5);
        }

        const currentValue = unitsEnd * navEnd;
        const unrealizedPnl = currentValue - unitsEnd * avgCost;

        return {
          investorName: demo.name,
          investorEmail: demo.email,
          investorId: demo.id,
          kycTier: demo.kycTier || "STANDARD",
          fundName: fund.name,
          fundDescription: fund.description,
          periodStart,
          periodEnd,
          navStart,
          navEnd,
          aum,
          unitsStart: unitsEnd, // approximation
          unitsEnd,
          avgCost,
          currentValue,
          unrealizedPnl,
          periodReturnPct,
          inceptionReturnPct,
          sharpe,
          maxDrawdown,
          managementFee: "2% annualized",
          performanceFee: "20% with high-water mark",
          transactions: txns.map((t) => ({
            date: t.createdAt,
            type: t.type,
            amount: t.amount,
            status: t.status,
          })),
        };
      };

      // Generate 3 monthly statements: April, May, June 2026
      const statementMonths = [
        { year: 2026, month: 3, label: "April 2026", period: "2026-04" },  // April (month=3)
        { year: 2026, month: 4, label: "May 2026", period: "2026-05" },    // May (month=4)
        { year: 2026, month: 5, label: "June 2026", period: "2026-06" },   // June (month=5)
      ];
      for (const m of statementMonths) {
        try {
          const data = await buildStatement(m.year, m.month);
          const pdfBuffer = await generateMonthlyStatement(data);
          const fileName = `statement-${demo.id.slice(0, 8)}-${m.period}-seed.pdf`;
          const filePath = await savePdfToDisk(pdfBuffer, fileName);
          await db.document.create({
            data: {
              userId: demo.id,
              title: `${m.label} Monthly Statement`,
              type: "MONTHLY_STATEMENT",
              period: m.period,
              description: `Official account statement for ${m.label}.`,
              fileName,
              filePath,
              mimeType: "application/pdf",
              sizeBytes: pdfBuffer.length,
              generatedBy: adminUserForDocs?.id ?? null,
              isRead: false,
              createdAt: new Date(m.year, m.month + 1, 1, 9, 0, 0),
            },
          });
        } catch (e) {
          console.error(`Failed to seed statement for ${m.label}`, e);
        }
      }

      // Tax statement (placeholder PDF generated from a simple statement payload)
      try {
        const taxData = await buildStatement(2026, 5);
        const taxPdf = await generateMonthlyStatement({
          ...taxData,
          periodStart: new Date(2026, 0, 1),
          periodEnd: new Date(2026, 5, 30, 23, 59, 59),
          transactions: [],
        });
        const taxFileName = `tax-2026-H1-${demo.id.slice(0, 8)}-seed.pdf`;
        const taxPath = await savePdfToDisk(taxPdf, taxFileName);
        await db.document.create({
          data: {
            userId: demo.id,
            title: "2026 H1 Tax Statement (Preliminary)",
            type: "TAX_STATEMENT",
            period: "2026-H1",
            description: "Preliminary tax statement covering January–June 2026. Final tax documents will be issued by January 31, 2027.",
            fileName: taxFileName,
            filePath: taxPath,
            mimeType: "application/pdf",
            sizeBytes: taxPdf.length,
            generatedBy: adminUserForDocs?.id ?? null,
            isRead: false,
            createdAt: new Date(2026, 6, 5, 10, 0, 0),
          },
        });
      } catch (e) {
        console.error("Failed to seed tax statement", e);
      }

      // Trade confirmation (small placeholder text file → saved as text/plain)
      try {
        const tradeContent = `NIGHTMARE INVEST — TRADE CONFIRMATION
=========================================
Investor:    ${demo.name} (${demo.email})
Account ID:  ${demo.id.slice(0, 8).toUpperCase()}
Fund:        ${fund.name}

Transaction Details:
  Type:        DEPOSIT
  Amount:      $250,000.00 USD
  Status:      APPROVED
  Settled:     2026-06-15 14:32 UTC
  Reference:   TC-2026-06-${Math.floor(Math.random() * 90000 + 10000)}

Allocation:
  Units Credited:    ${(250000 / 175).toFixed(4)}
  NAV at Execution:  $175.0000

This confirmation is generated electronically and serves as your official
record of the executed transaction. Please retain for your records.

Nightmare Invest LLC — Operations Team
`;
        const tradeBuffer = Buffer.from(tradeContent, "utf-8");
        const tradeFileName = `trade-confirm-2026-06-${demo.id.slice(0, 8)}-seed.txt`;
        const tradePath = await saveUploadedFileToDisk(tradeBuffer, tradeFileName);
        await db.document.create({
          data: {
            userId: demo.id,
            title: "Trade Confirmation — $250,000 Deposit (June 15, 2026)",
            type: "TRADE_CONFIRMATION",
            period: "2026-06",
            description: "Confirmation of approved deposit transaction settled on June 15, 2026.",
            fileName: tradeFileName,
            filePath: tradePath,
            mimeType: "text/plain",
            sizeBytes: tradeBuffer.length,
            generatedBy: adminUserForDocs?.id ?? null,
            isRead: true,
            createdAt: new Date(2026, 5, 15, 14, 32, 0),
          },
        });
      } catch (e) {
        console.error("Failed to seed trade confirmation", e);
      }

      // Audit the document seeding
      await audit({
        actorId: adminUserForDocs?.id,
        action: "DOCUMENTS_SEEDED",
        resourceType: "Document",
        metadata: { note: "Seeded 3 monthly statements + 1 tax + 1 trade confirmation for demo investor" },
      });
    }

    // 14. Seed statement requests (2 pending + 1 completed linked to an existing document)
    // Idempotent — only seeds if no statement requests exist yet for the demo investor.
    const existingRequests = await db.statementRequest.count({ where: { userId: demo.id } });
    if (existingRequests === 0) {
      const adminUserForReqs = await db.user.findFirst({ where: { role: "ADMIN" } });
      // Find the April 2026 statement to link the completed request to it
      const aprilDoc = await db.document.findFirst({
        where: { userId: demo.id, type: "MONTHLY_STATEMENT", period: "2026-04" },
      });

      // 2 pending requests — April 2026 (monthly) + Q1 2026 (quarterly)
      await db.statementRequest.create({
        data: {
          userId: demo.id,
          periodStart: new Date(2026, 3, 1),
          periodEnd: new Date(2026, 3, 30, 23, 59, 59),
          type: "MONTHLY_STATEMENT",
          notes: "Need for tax filing — accountant requested duplicate.",
          status: "PENDING",
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26), // ~26h ago
        },
      });
      await db.statementRequest.create({
        data: {
          userId: demo.id,
          periodStart: new Date(2026, 0, 1),
          periodEnd: new Date(2026, 2, 31, 23, 59, 59),
          type: "QUARTERLY_REPORT",
          notes: "Q1 2026 comprehensive review for LP meeting.",
          status: "PENDING",
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4), // ~4h ago
        },
      });

      // 1 completed request — linked to the April 2026 monthly statement
      if (aprilDoc) {
        await db.statementRequest.create({
          data: {
            userId: demo.id,
            periodStart: new Date(2026, 3, 1),
            periodEnd: new Date(2026, 3, 30, 23, 59, 59),
            type: "MONTHLY_STATEMENT",
            notes: "Re-issued at investor's request.",
            status: "COMPLETED",
            documentId: aprilDoc.id,
            processedBy: adminUserForReqs?.id ?? null,
            createdAt: new Date(2026, 4, 12, 14, 30, 0), // mid-May 2026
            completedAt: new Date(2026, 4, 12, 16, 0, 0), // ~1.5h later
          },
        });
      }

      await audit({
        actorId: adminUserForReqs?.id,
        action: "STATEMENT_REQUESTS_SEEDED",
        resourceType: "StatementRequest",
        metadata: { note: "Seeded 2 pending + 1 completed statement request for demo investor" },
      });
    }

    return json({ ok: true, fund: { id: fund.id, name: fund.name, slug: fund.slug }, demoInvestor: { email: demoEmail, password: "investor123" } });
  } catch (e) {
    console.error(e);
    return error(e instanceof Error ? e.message : "Seed failed", 500);
  }
}
