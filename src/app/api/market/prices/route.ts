import { fetchAndCachePrices, getCachedPrices } from "@/lib/market";
import { json } from "@/lib/api";

export async function GET() {
  // Try fresh fetch (cached at upstream layer 30s); fall back to DB cache
  let prices = await fetchAndCachePrices();
  if (prices.length === 0) {
    prices = await getCachedPrices();
  }
  return json({ prices, updatedAt: new Date().toISOString() });
}
