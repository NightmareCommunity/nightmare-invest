import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, error, parseBody } from "@/lib/api";

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  try {
    const body = await parseBody<{ name?: string; role?: string; isActive?: boolean }>(req);
    const data: Record<string, unknown> = {};
    if (typeof body.name === "string") data.name = body.name;
    if (body.role === "USER" || body.role === "ADMIN") data.role = body.role;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;

    const user = await db.user.update({ where: { id }, data, select: { id: true, name: true, email: true, role: true, isActive: true } });
    await audit({
      actorId: admin.id,
      action: "USER_UPDATED",
      resourceType: "User",
      resourceId: id,
      metadata: data,
    });
    return json({ user });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Update failed", 500);
  }
}
