import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { dailySnapshots, users } from "@/db/schema";
import { dateKeyInTimeZone } from "@/lib/dates";
import { generateDailyMarkdown } from "@/lib/generate-daily-md";
import { requireAdminApi } from "@/lib/require-admin-api";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const u = new URL(request.url);
  const userId = u.searchParams.get("userId");
  const dateParam = u.searchParams.get("date");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const tz = user.homeTimezone || user.currentTimezone || "UTC";
  const today = dateKeyInTimeZone(new Date(), tz);
  const dateKey =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

  const [snap] = await db
    .select()
    .from(dailySnapshots)
    .where(and(eq(dailySnapshots.userId, userId), eq(dailySnapshots.date, dateKey)))
    .limit(1);

  if (!snap) {
    return NextResponse.json({ error: "No snapshot for that date" }, { status: 404 });
  }

  const markdown = generateDailyMarkdown(user, snap);
  return NextResponse.json({ markdown, date: dateKey });
}
