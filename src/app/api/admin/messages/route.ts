import { safeHandler, json, error, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyUser, notifyAll } from "@/lib/realtime";

export const GET = safeHandler(async (req: Request) => {
  const admin = await requireAdmin();

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const filter = url.searchParams.get("filter"); // "broadcast" | "individual"

  const where: any = { senderId: admin.id };
  if (filter === "broadcast") where.isBroadcast = true;
  if (filter === "individual") where.isBroadcast = false;

  const [messages, total] = await Promise.all([
    db.adminMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        recipient: { select: { id: true, name: true, email: true } },
      },
    }),
    db.adminMessage.count({ where }),
  ]);

  return json({
    messages,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const POST = safeHandler(async (req: Request) => {
  const admin = await requireAdmin();
  const body = await parseBody<{
    recipientId?: string;
    subject: string;
    body: string;
    priority?: string;
    isBroadcast?: boolean;
  }>(req);

  if (!body.subject?.trim()) return error("Subject is required");
  if (!body.body?.trim()) return error("Body is required");

  const priority = ["NORMAL", "IMPORTANT", "URGENT"].includes(body.priority || "")
    ? body.priority!
    : "NORMAL";

  const isBroadcast = body.isBroadcast === true;

  if (!isBroadcast && !body.recipientId) {
    return error("Recipient is required for individual messages");
  }

  if (isBroadcast) {
    // Create a single broadcast message (all users can see it via isBroadcast=true)
    const msg = await db.adminMessage.create({
      data: {
        senderId: admin.id,
        recipientId: null,
        subject: body.subject.trim(),
        body: body.body.trim(),
        priority,
        isBroadcast: true,
        isRead: false,
      },
      include: {
        recipient: { select: { id: true, name: true, email: true } },
      },
    });

    // Log audit
    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: "BROADCAST_MESSAGE",
        resourceType: "AdminMessage",
        resourceId: msg.id,
        metadata: JSON.stringify({ subject: body.subject, priority }),
      },
    });

    // Real-time broadcast notification to all connected investors
    await notifyAll("new_message", {
      messageId: msg.id,
      subject: msg.subject,
      priority: msg.priority,
      isBroadcast: true,
      senderName: admin.name,
    });

    return json({ message: msg, broadcast: true }, 201);
  } else {
    // Create individual message
    const recipient = await db.user.findUnique({
      where: { id: body.recipientId },
    });
    if (!recipient) return error("Recipient not found");

    const msg = await db.adminMessage.create({
      data: {
        senderId: admin.id,
        recipientId: body.recipientId!,
        subject: body.subject.trim(),
        body: body.body.trim(),
        priority,
        isBroadcast: false,
        isRead: false,
      },
      include: {
        recipient: { select: { id: true, name: true, email: true } },
      },
    });

    // Log audit
    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: "SEND_MESSAGE",
        resourceType: "AdminMessage",
        resourceId: msg.id,
        metadata: JSON.stringify({ recipientId: body.recipientId, subject: body.subject, priority }),
      },
    });

    // Real-time notification to the recipient only
    await notifyUser(recipient.id, "new_message", {
      messageId: msg.id,
      subject: msg.subject,
      priority: msg.priority,
      isBroadcast: false,
      senderName: admin.name,
    });

    return json({ message: msg, broadcast: false }, 201);
  }
});
