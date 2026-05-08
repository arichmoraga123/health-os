import { NextResponse } from "next/server";
import { getSnapshotsAsc, getUserById } from "@/lib/health";
import { requireApiUser } from "@/lib/api-auth";
import { createSleepEvent, pickSleepRowForCalendarLog, userHasGoogleCalendarTokens } from "@/lib/google-calendar";

export async function POST() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const user = await getUserById(auth.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const has = await userHasGoogleCalendarTokens(auth.userId);
  if (!has) {
    return NextResponse.json({ error: "Connect Google Calendar in Settings first." }, { status: 400 });
  }

  const tz = user.homeTimezone || user.currentTimezone || "UTC";
  const snapshots = await getSnapshotsAsc(auth.userId, 30, tz);
  const { sleepRow, readinessRow, wakeDayDateKey } = pickSleepRowForCalendarLog(snapshots, tz);

  if (!sleepRow?.bedtimeStart || !sleepRow?.bedtimeEnd) {
    return NextResponse.json({ error: "No sleep window with bedtimes found for today." }, { status: 400 });
  }

  try {
    const result = await createSleepEvent(auth.userId, {
      timeZone: tz,
      sleepRow,
      readinessRow,
      wakeDayDateKey,
    });
    if (!result) {
      return NextResponse.json({ error: "Could not create calendar event (check Google connection)." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, eventId: result.eventId, wakeDayDateKey });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Calendar error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
