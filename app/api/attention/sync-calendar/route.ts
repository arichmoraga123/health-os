import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { attentionLogs } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { getLogsForDate } from "@/lib/attention";
import { dateKeyInTimeZone } from "@/lib/dates";
import {
  createAttentionEvent,
  updateAttentionEvent,
  userHasGoogleCalendarTokens,
} from "@/lib/google-calendar";
import { getUserById } from "@/lib/health";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const user = await getUserById(auth.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const has = await userHasGoogleCalendarTokens(auth.userId);
  if (!has) {
    return NextResponse.json(
      { error: "Connect Google Calendar in Settings first." },
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

  const logs = await getLogsForDate(auth.userId, dateKey);
  let synced = 0;
  let errors = 0;

  for (const log of logs) {
    try {
      const newEventId = log.googleEventId
        ? await updateAttentionEvent(auth.userId, log)
        : await createAttentionEvent(auth.userId, log);
      if (newEventId) {
        if (newEventId !== log.googleEventId) {
          await db
            .update(attentionLogs)
            .set({ googleEventId: newEventId, updatedAt: new Date() })
            .where(eq(attentionLogs.id, log.id));
        }
        synced += 1;
      } else {
        errors += 1;
      }
    } catch (e) {
      console.error("[attention] sync calendar failed", e);
      errors += 1;
    }
  }

  return NextResponse.json({ ok: errors === 0, synced, errors, date: dateKey });
}
