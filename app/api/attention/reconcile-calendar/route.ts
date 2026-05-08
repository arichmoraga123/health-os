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

function isReconnectError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("insufficient authentication scopes") ||
    m.includes("insufficient_scope") ||
    m.includes("invalid_grant") ||
    m.includes("token has been expired or revoked") ||
    m.includes("invalid_token") ||
    m.includes("unauthorized_client") ||
    m.includes("invalid credentials") ||
    m.includes("scope") ||
    m.includes("reconnect")
  );
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  try {
    const user = await getUserById(auth.userId);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const tokenDiag = await getCalendarTokenDiagnostics(auth.userId);
    console.log("[reconcile-calendar] token diagnostics", {
      userId: auth.userId,
      ...tokenDiag,
    });

    const has = await userHasGoogleCalendarTokens(auth.userId);
    if (!has) {
      return Response.json(
        {
          error: "Google Calendar is not connected. Reconnect from Settings to grant calendar.events scope.",
          reconnectRequired: true,
          reconnectUrl: "/api/calendar/auth",
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
      body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
        ? body.date
        : dateKeyInTimeZone(new Date(), tz);

    const startUtc = localToUtc(dateKey, "00:00", tz);
    const endUtc = localToUtc(nextDayKey(dateKey), "00:00", tz);

    console.log("[reconcile-calendar] querying Google Calendar", {
      userId: auth.userId,
      dateKey,
      tz,
      timeMin: startUtc.toISOString(),
      timeMax: endUtc.toISOString(),
    });

    const unmatched = await listUnmatchedCalendarEvents(auth.userId, startUtc, endUtc);
    console.log("[reconcile-calendar] success", {
      userId: auth.userId,
      dateKey,
      unmatchedCount: unmatched.length,
    });
    return Response.json({ ok: true, date: dateKey, unmatched });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const reconnectRequired = isReconnectError(message);
    console.error("[reconcile-calendar] failed", {
      userId: auth.userId,
      error: message,
      reconnectRequired,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return Response.json(
      {
        error: message,
        reconnectRequired,
        reconnectUrl: reconnectRequired ? "/api/calendar/auth" : undefined,
        unmatched: [],
      },
      { status: 500 },
    );
  }
}
