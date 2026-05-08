import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { attentionLogs } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import {
  ATTENTION_CATEGORIES,
  localToUtc,
  tzOffsetLabel,
} from "@/lib/attention";
import { dateKeyInTimeZone } from "@/lib/dates";
import { getUserById } from "@/lib/health";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function nextDayKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let body: {
    date?: string;
    startLocal?: string;
    endLocal?: string;
    activity?: string;
    category?: string;
    withPerson?: string | null;
    location?: string | null;
    notes?: string | null;
    timezone?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const user = await getUserById(auth.userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const tzIana = (body.timezone || user.currentTimezone || user.homeTimezone || "UTC").trim();
  const date =
    body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : dateKeyInTimeZone(new Date(), tzIana);
  const startLocal = (body.startLocal || "").trim();
  const endLocal = (body.endLocal || "").trim();

  if (!HHMM.test(startLocal) || !HHMM.test(endLocal)) {
    return NextResponse.json({ error: "startLocal/endLocal must be HH:MM" }, { status: 400 });
  }

  const activity = (body.activity || "").trim();
  if (!activity) return NextResponse.json({ error: "activity required" }, { status: 400 });

  const category = (body.category || "Other").trim();
  if (!ATTENTION_CATEGORIES.includes(category as (typeof ATTENTION_CATEGORIES)[number])) {
    return NextResponse.json(
      { error: `category must be one of ${ATTENTION_CATEGORIES.join(", ")}` },
      { status: 400 },
    );
  }

  const startUtc = localToUtc(date, startLocal, tzIana);
  let endUtc = localToUtc(date, endLocal, tzIana);
  if (endUtc.getTime() <= startUtc.getTime()) {
    endUtc = localToUtc(nextDayKey(date), endLocal, tzIana);
  }

  const now = new Date();
  const [inserted] = await db
    .insert(attentionLogs)
    .values({
      userId: auth.userId,
      date,
      startUtc,
      endUtc,
      startLocal,
      endLocal,
      location: body.location?.trim() || null,
      timezone: tzOffsetLabel(tzIana, startUtc),
      withPerson: body.withPerson?.trim() || null,
      activity,
      category,
      notes: body.notes?.trim() || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return NextResponse.json({ ok: true, log: inserted });
}
