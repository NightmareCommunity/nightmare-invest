import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, error, safeHandler } from "@/lib/api";

export interface NotificationItem {
  id: string;
  type: "TRANSACTION_APPROVED" | "TRANSACTION_REJECTED" | "NAV_UPDATED" | "SYSTEM";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  referenceId: string;
}

/**
 * Build the list of notifications for the current user. Read receipts are
 * persisted in the NotificationRead table — they survive server restarts
 * and sync across devices.
 */
async function buildNotifications(userId: string): Promise<NotificationItem[]> {
  const notifications: NotificationItem[] = [];

  // 1. Transaction status changes for the current user
  const processedTxns = await db.transaction.findMany({
    where: {
      userId,
      status: { in: ["APPROVED", "REJECTED"] },
    },
    include: { fund: { select: { name: true } } },
    orderBy: { processedAt: "desc" },
    take: 20,
  });

  for (const txn of processedTxns) {
    const isApproved = txn.status === "APPROVED";
    const type = isApproved ? "TRANSACTION_APPROVED" : "TRANSACTION_REJECTED";
    const title = isApproved
      ? `${txn.type === "DEPOSIT" ? "Deposit" : "Withdrawal"} Approved`
      : `${txn.type === "DEPOSIT" ? "Deposit" : "Withdrawal"} Rejected`;
    const amount = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(txn.amount);
    const description = isApproved
      ? `Your ${txn.type.toLowerCase()} of ${amount} in ${txn.fund.name} has been approved.`
      : `Your ${txn.type.toLowerCase()} of ${amount} in ${txn.fund.name} has been rejected.${txn.notes ? ` Reason: ${txn.notes}` : ""}`;
    const id = `txn-${txn.id}`;
    notifications.push({
      id,
      type,
      title,
      description,
      timestamp: (txn.processedAt ?? txn.createdAt).toISOString(),
      read: false, // populated below
      referenceId: txn.id,
    });
  }

  // 2. Latest NAV update
  const latestNav = await db.nAVPoint.findFirst({
    orderBy: { date: "desc" },
    include: { fund: { select: { name: true } } },
  });

  if (latestNav) {
    notifications.push({
      id: `nav-${latestNav.id}`,
      type: "NAV_UPDATED",
      title: "NAV Updated",
      description: `${latestNav.fund.name} NAV updated to ${latestNav.nav.toFixed(2)} as of ${latestNav.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`,
      timestamp: latestNav.createdAt.toISOString(),
      read: false,
      referenceId: latestNav.id,
    });
  }

  // Sort by timestamp descending
  notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Hydrate read state from the DB (single query)
  if (notifications.length > 0) {
    const reads = await db.notificationRead.findMany({
      where: { userId, notificationId: { in: notifications.map((n) => n.id) } },
      select: { notificationId: true },
    });
    const readSet = new Set(reads.map((r) => r.notificationId));
    for (const n of notifications) n.read = readSet.has(n.id);
  }

  return notifications;
}

export const GET = safeHandler(async () => {
  const user = await requireUser();
  const notifications = await buildNotifications(user.id);
  const unreadCount = notifications.filter((n) => !n.read).length;
  return json({ notifications, unreadCount });
});

/**
 * PUT /api/notifications — mark all as read for the current user.
 */
export const PUT = safeHandler(async () => {
  const user = await requireUser();
  const notifications = await buildNotifications(user.id);
  if (notifications.length === 0) return json({ success: true, marked: 0 });

  // Upsert read receipts (skip duplicates)
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return json({ success: true, marked: 0 });

  await db.notificationRead.createMany({
    data: unread.map((n) => ({ userId: user.id, notificationId: n.id })),
    skipDuplicates: true,
  });

  return json({ success: true, marked: unread.length });
});

/**
 * POST /api/notifications/read — mark a single notification as read.
 * Body: { id: string }
 */
export const POST = safeHandler(async (req: Request) => {
  const user = await requireUser();
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return error("Missing notification id", 422);

  await db.notificationRead.upsert({
    where: {
      userId_notificationId: { userId: user.id, notificationId: body.id },
    },
    update: { readAt: new Date() },
    create: { userId: user.id, notificationId: body.id },
  });

  return json({ success: true });
});
