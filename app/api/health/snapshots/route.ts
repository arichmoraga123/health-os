import { and, asc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { dailySnapshots, users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { rangeStartEnd } from "@/lib/dates";

export async function GET(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 30));
  const tzParam = url.searchParams.get("timeZone");
  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  const timeZone = tzParam || user?.currentTimezone || user?.homeTimezone || "UTC";
  const { start } = rangeStartEnd(days, timeZone);

  try {
    const rows = await db
      .select()
      .from(dailySnapshots)
      .where(and(eq(dailySnapshots.userId, auth.userId), gte(dailySnapshots.date, start)))
      .orderBy(asc(dailySnapshots.date));
    return NextResponse.json({ data: rows, timeZone, start });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
