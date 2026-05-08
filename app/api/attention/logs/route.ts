import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { getLogsForDate } from "@/lib/attention";
import { dateKeyInTimeZone } from "@/lib/dates";
import { getUserById } from "@/lib/health";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const user = await getUserById(auth.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const tz = user.currentTimezone || user.homeTimezone || "UTC";
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : dateKeyInTimeZone(new Date(), tz);

  const logs = await getLogsForDate(auth.userId, date);
  return NextResponse.json({ ok: true, date, timezone: tz, logs });
}
