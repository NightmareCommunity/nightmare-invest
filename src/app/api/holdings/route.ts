import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { json, error } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return error("Unauthorized", 401);
  const holdings = await db.holding.findMany({
    where: { userId: user.id },
    include: { fund: true },
  });
  return json({ holdings });
}
