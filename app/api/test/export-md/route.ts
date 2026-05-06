import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { buildComprehensiveDailyMarkdown } from "@/lib/comprehensive-oura-md";
import { requireApiUser } from "@/lib/api-auth";
import { dateKeyInTimeZone } from "@/lib/dates";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!user.ouraToken) {
    return new NextResponse("# Oura token required\n\nConnect your ring to export raw API data.", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const tz = user.homeTimezone || user.currentTimezone || "UTC";
  const today = dateKeyInTimeZone(new Date(), tz);

  try {
    const md = await buildComprehensiveDailyMarkdown({
      token: user.ouraToken,
      dateKey: today,
      userName: user.name ?? user.email,
      homeTimezone: tz,
    });
    return new NextResponse(md, {
      status: 200,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    return new NextResponse(`# Export failed\n\n${msg}`, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
