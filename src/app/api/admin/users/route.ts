import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { json, error } from "@/lib/api";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  void admin;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
        ],
      }
    : {};

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      totpEnabled: true,
      createdAt: true,
      lastLogin: true,
      _count: { select: { holdings: true, transactions: true } },
    },
  });
  return json({ users });
}
