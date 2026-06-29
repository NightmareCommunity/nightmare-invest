"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { useApp } from "@/lib/store";

/**
 * Realtime notification received from the price-stream WebSocket service.
 */
interface RealtimeNotification {
  event: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

/**
 * Per-event configuration: toast title, dynamic description, and toast type.
 */
const EVENT_CONFIG: Record<
  string,
  {
    title: string;
    description: (p: Record<string, unknown>) => string;
    type: "success" | "info" | "warning" | "error";
  }
> = {
  transaction_approved: {
    title: "Transaction Approved",
    description: (p) => {
      const type = String(p.type ?? "transaction").toLowerCase();
      const amount = Number(p.amount ?? 0);
      const fundName = p.fundName ? String(p.fundName) : "";
      const amountStr = amount.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
      });
      return fundName
        ? `Your ${type} of ${amountStr} in ${fundName} has been approved.`
        : `Your ${type} of ${amountStr} has been approved.`;
    },
    type: "success",
  },
  transaction_rejected: {
    title: "Transaction Rejected",
    description: (p) => {
      const type = String(p.type ?? "transaction").toLowerCase();
      const amount = Number(p.amount ?? 0);
      const amountStr = amount.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
      });
      const reason = p.reason ? ` Reason: ${String(p.reason)}` : "";
      return `Your ${type} of ${amountStr} was rejected.${reason}`;
    },
    type: "warning",
  },
  new_message: {
    title: "New Message",
    description: (p) => {
      const subject = p.subject ? String(p.subject) : "";
      const sender = p.senderName ? ` from ${String(p.senderName)}` : "";
      const prefix = p.isBroadcast ? "Broadcast" : "New message";
      return subject
        ? `${prefix}${sender}: ${subject}`
        : `${prefix}${sender}. You have a new message.`;
    },
    type: "info",
  },
  new_document: {
    title: "New Document",
    description: (p) => {
      const title = p.title ? String(p.title) : "";
      return title
        ? `A new document has been added to your vault: ${title}`
        : "A new document has been added to your vault.";
    },
    type: "info",
  },
  kyc_approved: {
    title: "KYC Verified",
    description: () =>
      "Your identity verification has been approved. Full account access enabled.",
    type: "success",
  },
  kyc_rejected: {
    title: "KYC Action Required",
    description: (p) => {
      const reason = p.reason ? ` ${String(p.reason)}` : "";
      return `Your KYC submission was rejected.${reason || " Please re-upload your documents."}`.trim();
    },
    type: "error",
  },
  fund_update: {
    title: "Fund Update",
    description: (p) => {
      const title = p.title ? String(p.title) : "";
      return title
        ? `New fund update: ${title}`
        : "A new fund update has been posted.";
    },
    type: "info",
  },
};

/**
 * useRealtimeNotifications
 *
 * Opens a SEPARATE Socket.io connection (from use-price-stream) so that
 * notification handling is decoupled from price data. On connect, joins a
 * `user:{userId}` room so the server can target this user specifically.
 *
 * On every notification:
 *   - Shows a Sonner toast (success / info / warning / error based on event type)
 *   - Dispatches a `notifications-updated` window event so other components
 *     (e.g. NotificationCenter) can refetch /api/notifications.
 *
 * Active whenever a logged-in user is present.
 */
export function useRealtimeNotifications(): void {
  const user = useApp((s) => s.user);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;

    // IMPORTANT: use relative path with XTransformPort query param for Caddy
    // gateway. NEVER use http://localhost:3003 on the client side.
    const socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      forceNew: true, // separate connection from use-price-stream
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      // Join this user's room so the server can target us specifically
      socket.emit("join", user.id);
      console.log("[realtime-notifications] Connected, joined room:", user.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("[realtime-notifications] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.warn("[realtime-notifications] Connection error:", err.message);
    });

    socket.on("notification", (data: RealtimeNotification) => {
      const config = EVENT_CONFIG[data.event];
      if (!config) {
        // Unknown event — ignore silently
        return;
      }

      const description = config.description(data.payload || {});
      try {
        toast[config.type](config.title, { description });
      } catch {
        // Toast library not loaded yet — fall back to console
        console.log(`[realtime-notifications] ${config.title}: ${description}`);
      }

      // Signal the rest of the app to refresh the notification list/badge
      window.dispatchEvent(new CustomEvent("notifications-updated"));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);
}
