/**
 * Server-side realtime notification helper.
 *
 * The Next.js app (port 3000) calls these functions to push real-time
 * notifications to the price-stream WebSocket service (port 3003), which
 * then broadcasts them to connected investors via Socket.io rooms.
 *
 * The price-stream service runs TWO listeners:
 *   - Port 3003: Socket.io server (path "/"). Because `path: "/"` matches
 *     every URL, ALL HTTP requests on port 3003 are intercepted by
 *     engine.io — we can't attach HTTP routes there.
 *   - Port 3004: Internal HTTP webhook server (POST /notify, GET /health).
 *     This is what we hit from the Next.js server.
 *
 * IMPORTANT: This module is server-side only. It uses `fetch()` against
 * `http://localhost:3004`, which is fine here because this code never
 * reaches the browser — it's only imported from API route handlers that
 * run on the Next.js server.
 */

const WEBHOOK_URL = process.env.PRICE_STREAM_WEBHOOK_URL || "http://localhost:3004";

export type RealtimeEvent =
  | "transaction_approved"
  | "transaction_rejected"
  | "new_message"
  | "new_document"
  | "kyc_approved"
  | "kyc_rejected"
  | "fund_update"
  | "investment_closed"
  | "investment_cancelled"
  | "investment_updated";

interface NotifyBody {
  userIds: string[] | "all";
  event: RealtimeEvent;
  payload: unknown;
}

async function postNotify(body: NotifyBody): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(`${WEBHOOK_URL}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (e) {
    // Realtime notifications are best-effort — never let a missing or
    // unresponsive stream service break the primary API flow.
    console.error("[realtime] postNotify failed:", e);
  }
}

/** Push a notification to a single investor (by user id). */
export async function notifyUser(
  userId: string,
  event: RealtimeEvent,
  payload: unknown
): Promise<void> {
  if (!userId) return;
  await postNotify({ userIds: [userId], event, payload });
}

/** Push a notification to a list of investors. */
export async function notifyUsers(
  userIds: string[],
  event: RealtimeEvent,
  payload: unknown
): Promise<void> {
  const valid = userIds.filter((id) => typeof id === "string" && id.length > 0);
  if (valid.length === 0) return;
  await postNotify({ userIds: valid, event, payload });
}

/** Broadcast a notification to every connected investor. */
export async function notifyAll(
  event: RealtimeEvent,
  payload: unknown
): Promise<void> {
  await postNotify({ userIds: "all", event, payload });
}
