import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, safeHandler } from "@/lib/api";

export interface NotificationItem {
  id: string;
  type: "TRANSACTION_APPROVED" | "TRANSACTION_REJECTED" | "NAV_UPDATED" | "SYSTEM";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  referenceId: string;
}

// In-memory read state: Map<userId, Set<notificationId>>
const readState = new Map<string, Set<string>>();

export const GET = safeHandler(async () => {
  const user = await requireUser();

  const notifications: NotificationItem[] = [];

    // 1. Transaction status changes for the current user
    const processedTxns = await db.transaction.findMany({
      where: {
        userId: user.id,
        status: { in: ["APPROVED", "REJECTED"] },
      },
      include: {
        fund: { select: { name: true } },
      },
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
      const userReadSet = readState.get(user.id);
      const read = userReadSet ? userReadSet.has(id) : false;

      notifications.push({
        id,
        type,
        title,
        description,
        timestamp: (txn.processedAt ?? txn.createdAt).toISOString(),
        read,
        referenceId: txn.id,
      });
    }

    // 2. Latest NAV update
    const latestNav = await db.nAVPoint.findFirst({
      orderBy: { date: "desc" },
      include: { fund: { select: { name: true } } },
    });

    if (latestNav) {
      const navId = `nav-${latestNav.id}`;
      const userReadSet = readState.get(user.id);
      const read = userReadSet ? userReadSet.has(navId) : false;
      notifications.push({
        id: navId,
        type: "NAV_UPDATED",
        title: "NAV Updated",
        description: `${latestNav.fund.name} NAV updated to ${latestNav.nav.toFixed(2)} as of ${latestNav.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`,
        timestamp: latestNav.createdAt.toISOString(),
        read,
        referenceId: latestNav.id,
      });
    }

    // Sort by timestamp descending
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const unreadCount = notifications.filter((n) => !n.read).length;

  return json({ notifications, unreadCount });
});

export const PUT = safeHandler(async () => {
  // Mark all notifications as read for the current user
  const user = await requireUser();

  // Get all notification IDs for this user
  const processedTxns = await db.transaction.findMany({
    where: {
      userId: user.id,
      status: { in: ["APPROVED", "REJECTED"] },
    },
    select: { id: true },
  });

  const latestNav = await db.nAVPoint.findFirst({
    orderBy: { date: "desc" },
    select: { id: true },
  });

  const readSet = readState.get(user.id) ?? new Set<string>();

  for (const txn of processedTxns) {
    readSet.add(`txn-${txn.id}`);
  }
  if (latestNav) {
    readSet.add(`nav-${latestNav.id}`);
  }

  readState.set(user.id, readSet);

  return json({ success: true });
});
