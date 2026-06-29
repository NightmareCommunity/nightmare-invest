import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { json } from "@/lib/api";
import { audit } from "@/lib/audit";
import { notifyAll } from "@/lib/realtime";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  const body = await req.json();
  const { title, body: text, category, priority, pinned } = body;

  if (!title || !text) return json({ error: "Title and body are required" }, 400);

  const update = await db.fundUpdate.create({
    data: {
      title,
      body: text,
      category: category ?? "GENERAL",
      priority: priority ?? "NORMAL",
      pinned: pinned ?? false,
      authorId: admin.id,
    },
    include: { author: { select: { name: true, email: true } } },
  });

  await audit({
    actorId: admin.id,
    action: "FUND_UPDATE_CREATED",
    resourceType: "FundUpdate",
    resourceId: update.id,
    metadata: { title: update.title, category: update.category },
  });

  // Real-time broadcast notification to all connected investors
  await notifyAll("fund_update", {
    updateId: update.id,
    title: update.title,
    category: update.category,
    priority: update.priority,
    pinned: update.pinned,
  });

  return json(update);
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return json({ error: "id required" }, 400);

  await db.fundUpdate.delete({ where: { id } });

  await audit({
    actorId: admin.id,
    action: "FUND_UPDATE_DELETED",
    resourceType: "FundUpdate",
    resourceId: id,
  });

  return json({ ok: true });
}
