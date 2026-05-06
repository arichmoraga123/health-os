import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import {
  fetchOuraRawDayBundle,
  generateComprehensiveOuraMarkdown,
} from "@/lib/comprehensive-oura-md";
import { requireApiUser } from "@/lib/api-auth";
import { dateKeyInTimeZone } from "@/lib/dates";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!user.ouraToken) {
    return NextResponse.json(
      {
        error:
          "Oura token required for raw export. Connect your ring (same token used for sync) and try again.",
      },
      { status: 400 },
    );
  }

  const tz = user.homeTimezone || user.currentTimezone || "UTC";
  const u = new URL(request.url);
  const param = u.searchParams.get("date");
  const today = dateKeyInTimeZone(new Date(), tz);
  const dateKey = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : today;

  try {
    const bundle = await fetchOuraRawDayBundle(user.ouraToken, dateKey);
    const md = generateComprehensiveOuraMarkdown({
      dateKey,
      displayName: user.name ?? user.email ?? "User",
      bundle,
    });
    const filename = `health-report-${dateKey}.md`;

    return new NextResponse(md, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
