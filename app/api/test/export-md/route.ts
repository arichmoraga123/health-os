import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { dailySnapshots, users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { dateKeyInTimeZone } from "@/lib/dates";
import { generateDailyMarkdown } from "@/lib/generate-daily-md";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const tz = user.homeTimezone || user.currentTimezone || "UTC";
  const today = dateKeyInTimeZone(new Date(), tz);

  const [snap] = await db
    .select()
    .from(dailySnapshots)
    .where(and(eq(dailySnapshots.userId, auth.userId), eq(dailySnapshots.date, today)))
    .limit(1);

  if (!snap) {
    return new NextResponse("# No snapshot for today yet\n\nSync your Oura ring first.", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const md = generateDailyMarkdown(user, snap);
  return new NextResponse(md, {
    status: 200,
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
