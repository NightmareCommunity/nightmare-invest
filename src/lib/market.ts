import { db } from "./db";

// CoinGecko simple price endpoint (no key required for basic usage)
const COINS: Record<string, { id: string; symbol: string; name: string }> = {
  BTC: { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  ETH: { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  SOL: { id: "solana", symbol: "SOL", name: "Solana" },
  LTC: { id: "litecoin", symbol: "LTC", name: "Litecoin" },
  USDT: { id: "tether", symbol: "USDT", name: "Tether" },
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
  // Seed sensible fallbacks for any still-missing coins (USDT pegged to $1)
  const SEED_FALLBACK: Record<string, number> = { BTC: 67000, ETH: 3500, SOL: 180, LTC: 85, USDT: 1 };
  for (const key of Object.keys(COINS)) {
    const coin = COINS[key];
    if (results.find((r) => r.symbol === coin.symbol)) continue;
    const fallback = SEED_FALLBACK[key] ?? 0;
    results.push({ symbol: coin.symbol, name: coin.name, priceUsd: fallback, change24h: 0 });
  }
  return results;
}

/**
 * Get the live USD price for a single crypto symbol (BTC, LTC, USDT, ETH, SOL).
 * Tries CoinGecko first, then cached DB value, then a hardcoded fallback.
 * Used by deposit minimum validation.
 */
export async function getCryptoPriceUsd(symbol: string): Promise<number> {
  const sym = symbol.toUpperCase();
  const coin = COINS[sym];
  if (!coin) throw new Error(`Unsupported crypto: ${symbol}`);

  // Try fresh CoinGecko fetch for this single coin (cached 30s via fetch revalidate)
  try {
    const url = `${COINGECKO_BASE}/simple/price?ids=${coin.id}&vs_currencies=usd`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: 30 },
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, { usd: number }>;
      if (data[coin.id]?.usd) {
        // Persist to cache
        await db.marketPrice.upsert({
          where: { symbol: coin.id },
          update: { priceUsd: data[coin.id].usd, name: coin.name, updatedAt: new Date() },
          create: { symbol: coin.id, name: coin.name, priceUsd: data[coin.id].usd, change24h: 0 },
        });
        return data[coin.id].usd;
      }
    }
  } catch {
    /* fall through to cache */
  }

  // Fall back to cached DB value
  const cached = await db.marketPrice.findUnique({ where: { symbol: coin.id } });
  if (cached) return cached.priceUsd;

  // Hardcoded last-resort fallback
  const FALLBACK: Record<string, number> = { BTC: 67000, ETH: 3500, SOL: 180, LTC: 85, USDT: 1 };
  return FALLBACK[sym] ?? 0;
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
