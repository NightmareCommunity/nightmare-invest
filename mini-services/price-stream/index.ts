import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server } from "socket.io";

// ── Ports ──────────────────────────────────────────────────────────────
// PORT 3003 — Socket.io server (path "/"). Used by the frontend via
//   `io("/?XTransformPort=3003")` (Caddy strips the query param and proxies
//   to localhost:3003). Because Socket.io's `path: "/"` matches every URL,
//   ALL HTTP requests on this port are intercepted by engine.io — we cannot
//   attach our own HTTP routes here.
// PORT 3004 — Internal webhook HTTP server. The Next.js server (port 3000)
//   POSTs to http://localhost:3004/notify to push real-time notifications
//   into the Socket.io server. localhost-only; never exposed via Caddy.
const SOCKET_PORT = 3003;
const WEBHOOK_PORT = 3004;

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

// ── Socket.io server (port 3003) ───────────────────────────────────────
// IMPORTANT: Socket.io's `path: "/"` matches every URL (engine.io uses
// `url.indexOf(path) === 0`), so it intercepts ALL HTTP requests on this
// port. Therefore, no custom HTTP routes can be served on port 3003 — they
// must go on the webhook server (port 3004).
const ioServer = createServer();
const io = new Server(ioServer, {
  // DO NOT change the path — Caddy uses this to forward to the correct port
  path: "/",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

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

  // ── Join a user-specific room so we can target notifications ────────
  // Client emits: socket.emit("join", userId)
  socket.on("join", (userId: unknown) => {
    if (typeof userId === "string" && userId.length > 0) {
      socket.join(`user:${userId}`);
      console.log(`[price-stream] Socket ${socket.id} joined room user:${userId}`);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(
      `[price-stream] Client disconnected: ${socket.id} reason=${reason} (total: ${io.engine.clientsCount})`
    );
  });

  socket.on("error", (error) => {
    console.error(`[price-stream] Socket error (${socket.id}):`, error);
  });
});

// ── Webhook HTTP server (port 3004) ────────────────────────────────────
// Internal-only — called by the Next.js server to push notifications into
// the Socket.io server. Not exposed via Caddy (no XTransformPort needed
// because both servers run on the same host).
const webhookServer = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    // ── POST /notify — internal webhook from Next.js ───────────────────
    if (req.method === "POST" && req.url === "/notify") {
      let body = "";
      for await (const chunk of req) body += chunk.toString();
      try {
        const parsed = JSON.parse(body) as {
          userIds: string[] | "all";
          event: string;
          payload: unknown;
        };
        const { userIds, event, payload } = parsed;
        const message = { event, payload, timestamp: Date.now() };

        if (userIds === "all") {
          io.emit("notification", message);
          console.log(`[price-stream] Broadcast notification: ${event}`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, sent: "all" }));
          return;
        }
        if (Array.isArray(userIds)) {
          let delivered = 0;
          for (const uid of userIds) {
            if (typeof uid === "string" && uid.length > 0) {
              io.to(`user:${uid}`).emit("notification", message);
              delivered++;
            }
          }
          console.log(
            `[price-stream] Notified ${delivered} user(s): ${event}`
          );
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, sent: delivered }));
          return;
        }
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "userIds must be an array or 'all'" }));
      } catch (e) {
        console.error("[price-stream] /notify invalid JSON:", e);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }
      return;
    }

    // ── GET /health — diagnostics ──────────────────────────────────────
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          socketPort: SOCKET_PORT,
          webhookPort: WEBHOOK_PORT,
          clients: io.engine.clientsCount,
          pricesCached: cachedPrices.length,
          fearGreed: cachedFearGreed.fearGreed,
          fearGreedLabel: cachedFearGreed.fearGreedLabel,
        })
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
);

// ── Start both servers ─────────────────────────────────────────────────
ioServer.listen(SOCKET_PORT, () => {
  console.log(`[price-stream] Socket.io server running on port ${SOCKET_PORT}`);

  // Initial fetch on startup
  fetchAndBroadcast();
});

webhookServer.listen(WEBHOOK_PORT, () => {
  console.log(
    `[price-stream] Webhook server running on port ${WEBHOOK_PORT} (POST /notify, GET /health)`
  );
});

// ── Graceful shutdown ──────────────────────────────────────────────────
function shutdown(signal: string) {
  console.log(`[price-stream] Received ${signal}, shutting down…`);
  io.disconnectSockets();
  ioServer.close(() => {
    console.log("[price-stream] Socket.io server closed");
  });
  webhookServer.close(() => {
    console.log("[price-stream] Webhook server closed");
  });
  // Force exit after a short delay (both close()s may have already completed)
  setTimeout(() => process.exit(0), 1000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
