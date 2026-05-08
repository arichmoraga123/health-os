import { NextResponse } from "next/server";
import {
  generateAttentionMarkdownDay,
  generateAttentionMarkdownMonth,
  getLogsForDate,
  getLogsForDateRange,
} from "@/lib/attention";
import { requireApiUser } from "@/lib/api-auth";
import { dateKeyInTimeZone } from "@/lib/dates";
import { getUserById } from "@/lib/health";

function monthRange(monthKey: string): { start: string; end: string } {
  const [y, m] = monthKey.split("-").map(Number);
  const start = `${monthKey}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${monthKey}-${String(last).padStart(2, "0")}`;
  return { start, end };
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const user = await getUserById(auth.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const tz = user.currentTimezone || user.homeTimezone || "UTC";

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");
  const dateParam = url.searchParams.get("date");

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const { start, end } = monthRange(monthParam);
    const logs = await getLogsForDateRange(auth.userId, start, end);
    const md = generateAttentionMarkdownMonth(logs, monthParam);
    const filename = `attention-${monthParam}.md`;
    return new NextResponse(md, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const dateKey =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : dateKeyInTimeZone(new Date(), tz);
  const logs = await getLogsForDate(auth.userId, dateKey);
  const md = generateAttentionMarkdownDay(logs, dateKey);
  const filename = `attention-${dateKey}.md`;
  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
