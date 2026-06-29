import { safeHandler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const GET = safeHandler(async (req: Request) => {
  const user = await requireUser();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));

  // Get broadcasts + direct messages to this user
  const where = {
    OR: [
      { isBroadcast: true },
      { recipientId: user.id },
    ],
  };

  const [messages, total] = await Promise.all([
    db.adminMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sender: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    db.adminMessage.count({ where }),
  ]);

  // Mark individual unread messages as read
  const unreadIds = messages
    .filter((m) => m.recipientId === user.id && !m.isRead)
    .map((m) => m.id);

  if (unreadIds.length > 0) {
    await db.adminMessage.updateMany({
      where: { id: { in: unreadIds } },
      data: { isRead: true },
    });
  }

  // Count total unread (for badge)
  const unreadCount = await db.adminMessage.count({
    where: {
      OR: [
        { isBroadcast: true, isRead: false },
        { recipientId: user.id, isRead: false },
      ],
    },
  });

  return json({
    messages: messages.map((m) => ({
      ...m,
      isRead: m.recipientId === user.id ? true : m.isRead, // just-marked-as-read
    })),
    unreadCount,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});
