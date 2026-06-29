import { createServer } from "http";
import { Server } from "socket.io";

const PORT = 3003;

const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path — Caddy uses this to forward to the correct port
  path: "/",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Types ──────────────────────────────────────────────────────────────
interface PriceData {
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
}

interface FearGreedData {
  btcDominance: number;
  fearGreed: number;
  fearGreedLabel: string;
}

// ── Cached state ───────────────────────────────────────────────────────
let cachedPrices: PriceData[] = [];
let cachedFearGreed: FearGreedData = {
  btcDominance: 52.4,
  fearGreed: 72,
  fearGreedLabel: "Greed",
};
let lastFetchTime = 0;

// ── CoinGecko fetch ───────────────────────────────────────────────────
const COINS: Record<string, { id: string; symbol: string; name: string }> = {
  BTC: { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  ETH: { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  SOL: { id: "solana", symbol: "SOL", name: "Solana" },
};

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

async function fetchPrices(): Promise<PriceData[]> {
  const ids = Object.values(COINS)
    .map((c) => c.id)
    .join(",");
  const results: PriceData[] = [];
  try {
    const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, {
      headers: { accept: "application/json" },
    });
    if (res.ok) {
      const data = (await res.json()) as Record<
        string,
        { usd: number; usd_24h_change: number }
      >;
      for (const key of Object.keys(COINS)) {
        const coin = COINS[key];
        const row = data[coin.id];
        if (row) {
          results.push({
            symbol: coin.symbol,
            name: coin.name,
            priceUsd: row.usd,
            change24h: row.usd_24h_change ?? 0,
          });
        }
      }
    } else {
      console.error(
        `[price-stream] CoinGecko prices returned ${res.status}`
      );
    }
  } catch (e) {
    console.error("[price-stream] CoinGecko price fetch failed:", e);
  }
  return results;
}

async function fetchFearGreed(): Promise<FearGreedData> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1");
    if (res.ok) {
      const json = (await res.json()) as {
        data: { value: string; value_classification: string }[];
      };
      if (json.data?.[0]) {
        return {
          btcDominance: cachedFearGreed.btcDominance, // no free API for BTC dominance
          fearGreed: parseInt(json.data[0].value, 10),
          fearGreedLabel: json.data[0].value_classification,
        };
      }
    }
  } catch (e) {
    console.error("[price-stream] Fear & Greed fetch failed:", e);
  }
  return cachedFearGreed;
}

// ── Periodic fetch & broadcast ─────────────────────────────────────────
async function fetchAndBroadcast() {
  const now = Date.now();
  if (now - lastFetchTime < 14000) return; // debounce ~15s
  lastFetchTime = now;

  console.log("[price-stream] Fetching latest prices & sentiment…");

  const [prices, fearGreed] = await Promise.all([
    fetchPrices(),
    fetchFearGreed(),
  ]);

  if (prices.length > 0) {
    cachedPrices = prices;
    io.emit("price-update", { prices: cachedPrices, updatedAt: new Date().toISOString() });
    console.log(
      `[price-stream] Emitted price-update: ${cachedPrices.map((p) => `${p.symbol}=${p.priceUsd}`).join(", ")}`
    );
  }

  if (fearGreed) {
    cachedFearGreed = fearGreed;
    io.emit("fear-greed-update", fearGreed);
    console.log(
      `[price-stream] Emitted fear-greed-update: ${fearGreed.fearGreed} (${fearGreed.fearGreedLabel})`
    );
  }
}

// Fetch every 15 seconds
setInterval(fetchAndBroadcast, 15_000);

// ── Connection handling ────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[price-stream] Client connected: ${socket.id} (total: ${io.engine.clientsCount})`);

  // Send cached data immediately on connect so the client doesn't wait
  if (cachedPrices.length > 0) {
    socket.emit("price-update", {
      prices: cachedPrices,
      updatedAt: new Date().toISOString(),
    });
  }
  socket.emit("fear-greed-update", cachedFearGreed);

  socket.on("disconnect", (reason) => {
    console.log(
      `[price-stream] Client disconnected: ${socket.id} reason=${reason} (total: ${io.engine.clientsCount})`
    );
  });

  socket.on("error", (error) => {
    console.error(`[price-stream] Socket error (${socket.id}):`, error);
  });
});

// ── Start server ───────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`[price-stream] WebSocket server running on port ${PORT}`);

  // Initial fetch on startup
  fetchAndBroadcast();
});

// ── Graceful shutdown ──────────────────────────────────────────────────
process.on("SIGTERM", () => {
  console.log("[price-stream] Received SIGTERM, shutting down…");
  io.disconnectSockets();
  httpServer.close(() => {
    console.log("[price-stream] Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[price-stream] Received SIGINT, shutting down…");
  io.disconnectSockets();
  httpServer.close(() => {
    console.log("[price-stream] Server closed");
    process.exit(0);
  });
});
