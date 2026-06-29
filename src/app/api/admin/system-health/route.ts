import { safeHandler } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = safeHandler(async () => {
  await requireAdmin();

  // Database health check
  const dbStart = Date.now();
  let dbStatus = "healthy";
  let dbLatency = 0;
  try {
    await db.user.findFirst({ select: { id: true } });
    dbLatency = Date.now() - dbStart;
  } catch {
    dbStatus = "unhealthy";
    dbLatency = Date.now() - dbStart;
  }

  // API latency (measure current request processing time as a baseline)
  const apiStart = Date.now();
  // Simulate a quick internal check
  await db.$queryRaw`SELECT 1`;
  const apiLatency = Date.now() - apiStart;

  // Memory usage
  const mem = process.memoryUsage();

  // Uptime
  const uptime = process.uptime();

  // Last NAV update
  const lastNav = await db.nAVPoint.findFirst({
    orderBy: { date: "desc" },
    select: { date: true, createdAt: true },
  });

  // Active connections (users with lastLogin in last 24h)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const activeConnections = await db.user.count({
    where: {
      lastLogin: { gte: twentyFourHoursAgo },
      isActive: true,
    },
  });

  // Cache status based on MarketPrice freshness
  const latestPrice = await db.marketPrice.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true, symbol: true },
  });
  const priceCount = await db.marketPrice.count();
  const cacheAge = latestPrice ? Date.now() - new Date(latestPrice.updatedAt).getTime() : Infinity;
  const cacheStatus = cacheAge < 5 * 60 * 1000 ? "warm" : "cold"; // warm if < 5 min old

  // Price feed status
  const priceFeedStatus = cacheAge < 2 * 60 * 1000 ? "live" : "stale"; // live if < 2 min old

  // Version
  const version = "1.8.0";

  // Environment
  const environment = process.env.NODE_ENV || "development";

  // Determine overall health
  const checks = [
    dbStatus === "healthy",
    dbLatency < 500,
    apiLatency < 500,
    priceFeedStatus === "live",
    cacheStatus === "warm",
  ];
  const healthyCount = checks.filter(Boolean).length;
  const overallHealth: "healthy" | "degraded" | "critical" =
    healthyCount === checks.length ? "healthy" : healthyCount >= 3 ? "degraded" : "critical";

  // Build activity timeline from recent events
  const recentAuditLogs = await db.auditLog.findMany({
    take: 10,
    orderBy: { timestamp: "desc" },
    select: {
      id: true,
      action: true,
      resourceType: true,
      timestamp: true,
      actor: { select: { name: true } },
    },
  });

  const activity = [
    ...(lastNav
      ? [
          {
            id: "nav-last",
            type: "nav-update" as const,
            description: `NAV updated`,
            timestamp: lastNav.createdAt.toISOString(),
          },
        ]
      : []),
    ...(latestPrice
      ? [
          {
            id: "price-feed",
            type: "price-feed" as const,
            description: `Price feed ${priceFeedStatus} (last: ${latestPrice.symbol})`,
            timestamp: new Date(latestPrice.updatedAt).toISOString(),
          },
        ]
      : []),
    ...recentAuditLogs.map((log) => ({
      id: log.id,
      type: "admin-action" as const,
      description: `${log.actor?.name || "System"}: ${log.action}${log.resourceType ? ` on ${log.resourceType}` : ""}`,
      timestamp: log.timestamp.toISOString(),
    })),
  ];

  // 2FA adoption
  const totalUsers = await db.user.count({ where: { isActive: true } });
  const totpEnabled = await db.user.count({ where: { isActive: true, totpEnabled: true } });
  const twoFaRate = totalUsers > 0 ? Math.round((totpEnabled / totalUsers) * 100) : 0;

  return Response.json({
    overallHealth,
    dbStatus,
    dbLatency,
    apiLatency,
    memoryUsage: {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
    },
    uptime,
    lastNavUpdate: lastNav?.createdAt?.toISOString() ?? null,
    activeConnections,
    cacheStatus,
    priceFeedStatus,
    cachedAssets: priceCount,
    version,
    environment,
    accessExpiry: "30m",
    twoFaRate,
    activity,
  });
});
