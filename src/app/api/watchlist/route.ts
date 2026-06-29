import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, error, parseBody, safeHandler } from "@/lib/api";

// Valid crypto symbols that can be watchlisted
const VALID_SYMBOLS: Record<string, string> = {
  bitcoin: "Bitcoin",
  ethereum: "Ethereum",
  solana: "Solana",
};

// GET /api/watchlist — Return user's watchlist items with current prices
export const GET = safeHandler(async () => {
  const user = await requireUser();

  const items = await db.watchlistItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // Fetch current market prices for the watchlisted symbols
  const marketPrices = await db.marketPrice.findMany({
    where: { symbol: { in: items.map((i) => i.symbol) } },
  });

  const priceMap = new Map(marketPrices.map((p) => [p.symbol, p]));

  // Merge current prices into watchlist items
  const enriched = items.map((item) => {
    const mp = priceMap.get(item.symbol);
    const currentPrice = mp?.priceUsd ?? null;
    const change24h = mp?.change24h ?? null;

    // Check if alert is triggered
    let alertTriggered = false;
    if (item.alertPrice !== null && currentPrice !== null) {
      if (item.alertDirection === "ABOVE") {
        alertTriggered = currentPrice >= item.alertPrice;
      } else {
        alertTriggered = currentPrice <= item.alertPrice;
      }
    }

    return {
      id: item.id,
      symbol: item.symbol,
      name: item.name,
      alertPrice: item.alertPrice,
      alertDirection: item.alertDirection,
      notes: item.notes,
      createdAt: item.createdAt,
      currentPrice,
      change24h,
      alertTriggered,
    };
  });

  return json({ items: enriched });
});

// POST /api/watchlist — Add item to watchlist
export const POST = safeHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await parseBody<{
    symbol: string;
    alertPrice?: number | null;
    alertDirection?: "ABOVE" | "BELOW";
    notes?: string;
  }>(req);

  const symbol = body.symbol?.toLowerCase();
  if (!symbol || !VALID_SYMBOLS[symbol]) {
    return error("Invalid symbol. Supported: bitcoin, ethereum, solana", 400);
  }

  // Check for duplicate
  const existing = await db.watchlistItem.findUnique({
    where: { userId_symbol: { userId: user.id, symbol } },
  });
  if (existing) {
    return error("Asset already in watchlist", 409);
  }

  const item = await db.watchlistItem.create({
    data: {
      userId: user.id,
      symbol,
      name: VALID_SYMBOLS[symbol],
      alertPrice: body.alertPrice ?? null,
      alertDirection: body.alertDirection ?? "ABOVE",
      notes: body.notes ?? null,
    },
  });

  return json({ item }, 201);
});

// DELETE /api/watchlist?id=xxx — Remove item from watchlist
export const DELETE = safeHandler(async (req: NextRequest) => {
  const user = await requireUser();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return error("Missing id query parameter", 400);

  const item = await db.watchlistItem.findUnique({ where: { id } });
  if (!item || item.userId !== user.id) {
    return error("Watchlist item not found", 404);
  }

  await db.watchlistItem.delete({ where: { id } });
  return json({ ok: true });
});
