import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, safeHandler } from "@/lib/api";

// GET /api/watchlist/alerts — Check which watchlist items have triggered price alerts
export const GET = safeHandler(async () => {
  const user = await requireUser();

  const items = await db.watchlistItem.findMany({
    where: { userId: user.id, alertPrice: { not: null } },
  });

  if (items.length === 0) {
    return json({ triggered: [] });
  }

  const marketPrices = await db.marketPrice.findMany({
    where: { symbol: { in: items.map((i) => i.symbol) } },
  });

  const priceMap = new Map(marketPrices.map((p) => [p.symbol, p.priceUsd]));

  const triggered = items
    .filter((item) => {
      const currentPrice = priceMap.get(item.symbol);
      if (currentPrice === undefined || item.alertPrice === null) return false;
      if (item.alertDirection === "ABOVE") {
        return currentPrice >= item.alertPrice;
      } else {
        return currentPrice <= item.alertPrice;
      }
    })
    .map((item) => ({
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      alertPrice: item.alertPrice!,
      alertDirection: item.alertDirection,
      currentPrice: priceMap.get(item.symbol) ?? null,
    }));

  return json({ triggered });
});
