import { db } from "./db";

// CoinGecko simple price endpoint (no key required for basic usage)
const COINS: Record<string, { id: string; symbol: string; name: string }> = {
  BTC: { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  ETH: { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  SOL: { id: "solana", symbol: "SOL", name: "Solana" },
};

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

interface PriceResult {
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
}

/** Fetch live prices from CoinGecko, cache in DB, fall back to cache + seeded values. */
export async function fetchAndCachePrices(): Promise<PriceResult[]> {
  const ids = Object.values(COINS).map((c) => c.id).join(",");
  const results: PriceResult[] = [];
  try {
    const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      // cache briefly
      next: { revalidate: 30 },
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, { usd: number; usd_24h_change: number }>;
      for (const key of Object.keys(COINS)) {
        const coin = COINS[key];
        const row = data[coin.id];
        if (row) {
          const price = row.usd;
          const change = row.usd_24h_change ?? 0;
          results.push({ symbol: coin.symbol, name: coin.name, priceUsd: price, change24h: change });
          await db.marketPrice.upsert({
            where: { symbol: coin.id },
            update: { priceUsd: price, change24h: change, name: coin.name, updatedAt: new Date() },
            create: { symbol: coin.id, name: coin.name, priceUsd: price, change24h: change },
          });
        }
      }
    }
  } catch (e) {
    console.error("coingecko fetch failed", e);
  }

  // Fall back to cached values for missing coins
  if (results.length < Object.keys(COINS).length) {
    const cached = await db.marketPrice.findMany();
    for (const key of Object.keys(COINS)) {
      const coin = COINS[key];
      if (results.find((r) => r.symbol === coin.symbol)) continue;
      const c = cached.find((x) => x.symbol === coin.id);
      if (c) {
        results.push({ symbol: coin.symbol, name: c.name, priceUsd: c.priceUsd, change24h: c.change24h });
      }
    }
  }
  return results;
}

/** Return cached prices (used by API routes that don't want to wait for upstream). */
export async function getCachedPrices(): Promise<PriceResult[]> {
  const rows = await db.marketPrice.findMany();
  return rows.map((r) => ({ symbol: r.symbol.toUpperCase(), name: r.name, priceUsd: r.priceUsd, change24h: r.change24h }));
}

/** BTC dominance + Fear & Greed (best-effort; falls back to deterministic values). */
export async function getMarketSentiment(): Promise<{
  btcDominance: number;
  fearGreed: number;
  fearGreedLabel: string;
}> {
  let btcDominance = 52.4;
  let fearGreed = 72;
  let fearGreedLabel = "Greed";
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const json = (await res.json()) as { data: { value: string; value_classification: string }[] };
      if (json.data?.[0]) {
        fearGreed = parseInt(json.data[0].value, 10);
        fearGreedLabel = json.data[0].value_classification;
      }
    }
  } catch {
    /* ignore */
  }
  return { btcDominance, fearGreed, fearGreedLabel };
}
