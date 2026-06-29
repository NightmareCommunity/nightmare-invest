"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// ── Types ──────────────────────────────────────────────────────────────

export interface StreamPrice {
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
}

export interface StreamPriceUpdate {
  prices: StreamPrice[];
  updatedAt: string;
}

export interface StreamFearGreedUpdate {
  btcDominance: number;
  fearGreed: number;
  fearGreedLabel: string;
}

export type ConnectionStatus = "connected" | "disconnected" | "connecting";

export interface UsePriceStreamReturn {
  /** Latest streamed prices (empty array until first update) */
  prices: StreamPrice[];
  /** Timestamp of the last price update */
  lastPriceUpdate: string | null;
  /** Latest Fear & Greed data from stream */
  fearGreed: StreamFearGreedUpdate | null;
  /** WebSocket connection status */
  connectionStatus: ConnectionStatus;
  /** Manually reconnect */
  reconnect: () => void;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function usePriceStream(): UsePriceStreamReturn {
  const [prices, setPrices] = useState<StreamPrice[]>([]);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<string | null>(null);
  const [fearGreed, setFearGreed] = useState<StreamFearGreedUpdate | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  // Counter state to trigger reconnection — incrementing causes the effect to re-run
  const [reconnectId, setReconnectId] = useState(0);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Disconnect previous if any
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // IMPORTANT: use relative path with XTransformPort query param for Caddy gateway
    // NEVER use http://localhost:3003
    const socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[usePriceStream] Connected:", socket.id);
      setConnectionStatus("connected");
    });

    socket.on("disconnect", (reason) => {
      console.log("[usePriceStream] Disconnected:", reason);
      setConnectionStatus("disconnected");
    });

    socket.on("connect_error", (err) => {
      console.warn("[usePriceStream] Connection error:", err.message);
      setConnectionStatus("disconnected");
    });

    socket.on("price-update", (data: StreamPriceUpdate) => {
      setPrices(data.prices);
      setLastPriceUpdate(data.updatedAt);
    });

    socket.on("fear-greed-update", (data: StreamFearGreedUpdate) => {
      setFearGreed(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [reconnectId]);

  const reconnect = useCallback(() => {
    setReconnectId((prev) => prev + 1);
  }, []);

  return {
    prices,
    lastPriceUpdate,
    fearGreed,
    connectionStatus,
    reconnect,
  };
}
