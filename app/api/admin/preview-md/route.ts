import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { buildComprehensiveDailyMarkdown } from "@/lib/comprehensive-oura-md";
import { dateKeyInTimeZone } from "@/lib/dates";
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

  if (!user.ouraToken) {
    return NextResponse.json({ error: "User has no Oura token — cannot fetch raw API data" }, { status: 400 });
  }

  const tz = user.homeTimezone || user.currentTimezone || "UTC";
  const today = dateKeyInTimeZone(new Date(), tz);
  const dateKey =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;

  try {
    const markdown = await buildComprehensiveDailyMarkdown({
      token: user.ouraToken,
      dateKey,
      userName: user.name ?? user.email,
    });
    return NextResponse.json({ markdown, date: dateKey });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to build markdown" },
      { status: 502 },
    );
  }
}
