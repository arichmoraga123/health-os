import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { localToUtc } from "@/lib/attention";
import { dateKeyInTimeZone } from "@/lib/dates";
import {
  getCalendarTokenDiagnostics,
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

  const tokenDiag = await getCalendarTokenDiagnostics(auth.userId);
  console.log("[reconcile-calendar] token diagnostics", {
    userId: auth.userId,
    ...tokenDiag,
  });

  const has = await userHasGoogleCalendarTokens(auth.userId);
  if (!has) {
    return NextResponse.json(
      {
        error: "Connect Google Calendar in Settings first.",
        unmatched: [],
        tokenDiag,
      },
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

  let startUtc: Date;
  let endUtc: Date;
  try {
    startUtc = localToUtc(dateKey, "00:00", tz);
    endUtc = localToUtc(nextDayKey(dateKey), "00:00", tz);
  } catch (e) {
    console.error("[reconcile-calendar] time conversion failed", { dateKey, tz, error: e });
    return NextResponse.json(
      {
        error: `Time conversion failed for ${dateKey} (${tz})`,
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  console.log("[reconcile-calendar] querying Google Calendar", {
    userId: auth.userId,
    dateKey,
    tz,
    timeMin: startUtc.toISOString(),
    timeMax: endUtc.toISOString(),
  });

  try {
    const unmatched = await listUnmatchedCalendarEvents(auth.userId, startUtc, endUtc);
    console.log("[reconcile-calendar] success", {
      userId: auth.userId,
      dateKey,
      unmatchedCount: unmatched.length,
    });
    return NextResponse.json({ ok: true, date: dateKey, unmatched });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[reconcile-calendar] failed", {
      userId: auth.userId,
      dateKey,
      tz,
      tokenDiag,
      error: message,
      stack: e instanceof Error ? e.stack : undefined,
    });
    return NextResponse.json(
      {
        error: message,
        date: dateKey,
        timezone: tz,
        tokenDiag,
        unmatched: [],
      },
      { status: 502 },
    );
  }
}
