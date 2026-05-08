import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { localToUtc } from "@/lib/attention";
import { dateKeyInTimeZone } from "@/lib/dates";
import {
  listUnmatchedCalendarEvents,
  userHasGoogleCalendarTokens,
} from "@/lib/google-calendar";
import { getUserById } from "@/lib/health";

function nextDayKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const user = await getUserById(auth.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const has = await userHasGoogleCalendarTokens(auth.userId);
  if (!has) {
    return NextResponse.json(
      { error: "Connect Google Calendar in Settings first.", unmatched: [] },
      { status: 400 },
    );
  }

  const tz = user.currentTimezone || user.homeTimezone || "UTC";

  let body: { date?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const dateKey =
    body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : dateKeyInTimeZone(new Date(), tz);

  const startUtc = localToUtc(dateKey, "00:00", tz);
  const endUtc = localToUtc(nextDayKey(dateKey), "00:00", tz);
  const unmatched = await listUnmatchedCalendarEvents(auth.userId, startUtc, endUtc);

  return NextResponse.json({ ok: true, date: dateKey, unmatched });
}
