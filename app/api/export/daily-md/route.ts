import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { dailySnapshots, users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { dateKeyInTimeZone } from "@/lib/dates";
import { generateDailyMarkdown } from "@/lib/generate-daily-md";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const tz = user.homeTimezone || user.currentTimezone || "UTC";
  const u = new URL(request.url);
  const param = u.searchParams.get("date");
  const today = dateKeyInTimeZone(new Date(), tz);
  const dateKey =
    param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : today;

  const [snap] = await db
    .select()
    .from(dailySnapshots)
    .where(and(eq(dailySnapshots.userId, auth.userId), eq(dailySnapshots.date, dateKey)))
    .limit(1);

  if (!snap) {
    return NextResponse.json({ error: "No snapshot for that date" }, { status: 404 });
  }

  const md = generateDailyMarkdown(user, snap);
  const filename = `health-report-${dateKey}.md`;

  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
