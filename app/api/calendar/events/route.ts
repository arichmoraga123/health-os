import { and, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/db/client";
import { calendarEvents, googleCalendarTokens } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { getOAuthClient } from "@/lib/google";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const [tokens] = await db
    .select()
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.userId, auth.userId))
    .limit(1);
  if (!tokens?.accessToken) return NextResponse.json([]);
  const oauth = getOAuthClient(`${process.env.NEXTAUTH_URL}/api/calendar/callback`);
  oauth.setCredentials({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken ?? undefined });
  const calendar = google.calendar({ version: "v3", auth: oauth });
  const result = await calendar.events.list({ calendarId: "primary", maxResults: 25, singleEvents: true });
  const events = result.data.items ?? [];
  for (const item of events) {
    const end = item.end?.dateTime ? new Date(item.end.dateTime) : null;
    const start = item.start?.dateTime ? new Date(item.start.dateTime) : null;
    if (!end || !start || !item.id) continue;
    const isLateEvening = end.getHours() >= 20;
    const [existing] = await db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.userId, auth.userId), eq(calendarEvents.googleEventId, item.id)))
      .limit(1);
    if (!existing) {
      await db.insert(calendarEvents).values({
        userId: auth.userId,
        googleEventId: item.id,
        title: item.summary ?? "Untitled Event",
        startTime: start,
        endTime: end,
        isLateEvening,
      });
    }
  }
  const cached = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.userId, auth.userId), gte(calendarEvents.createdAt, new Date(Date.now() - 1000 * 60 * 60 * 24 * 14))));
  return NextResponse.json(cached);
}
