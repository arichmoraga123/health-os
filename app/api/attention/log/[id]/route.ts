import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { attentionLogs } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import {
  ATTENTION_CATEGORIES,
  localToUtc,
  tzOffsetLabel,
} from "@/lib/attention";
import { deleteCalendarEvent, updateAttentionEvent } from "@/lib/google-calendar";
import { getUserById } from "@/lib/health";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function nextDayKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const [existing] = await db
    .select()
    .from(attentionLogs)
    .where(and(eq(attentionLogs.id, id), eq(attentionLogs.userId, auth.userId)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Log not found" }, { status: 404 });

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
  const fallbackTz = user?.currentTimezone || user?.homeTimezone || "UTC";
  const tzIana = (body.timezone || fallbackTz).trim();

  const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : existing.date;
  const startLocal = (body.startLocal || existing.startLocal).trim();
  const endLocal = (body.endLocal || existing.endLocal).trim();

  if (!HHMM.test(startLocal) || !HHMM.test(endLocal)) {
    return NextResponse.json({ error: "startLocal/endLocal must be HH:MM" }, { status: 400 });
  }

  const activity = (body.activity ?? existing.activity).trim();
  if (!activity) return NextResponse.json({ error: "activity required" }, { status: 400 });

  const category = (body.category ?? existing.category).trim();
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
  const [updated] = await db
    .update(attentionLogs)
    .set({
      date,
      startUtc,
      endUtc,
      startLocal,
      endLocal,
      location: body.location !== undefined ? body.location?.trim() || null : existing.location,
      timezone: body.timezone ? tzOffsetLabel(tzIana, startUtc) : existing.timezone,
      withPerson:
        body.withPerson !== undefined ? body.withPerson?.trim() || null : existing.withPerson,
      activity,
      category,
      notes: body.notes !== undefined ? body.notes?.trim() || null : existing.notes,
      updatedAt: now,
    })
    .where(eq(attentionLogs.id, id))
    .returning();

  if (updated?.googleEventId) {
    try {
      const newEventId = await updateAttentionEvent(auth.userId, updated);
      if (newEventId && newEventId !== updated.googleEventId) {
        await db
          .update(attentionLogs)
          .set({ googleEventId: newEventId })
          .where(eq(attentionLogs.id, id));
      }
    } catch (e) {
      console.error("[attention] update calendar event failed", e);
    }
  }

  return NextResponse.json({ ok: true, log: updated });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const [existing] = await db
    .select()
    .from(attentionLogs)
    .where(and(eq(attentionLogs.id, id), eq(attentionLogs.userId, auth.userId)))
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Log not found" }, { status: 404 });

  if (existing.googleEventId) {
    try {
      await deleteCalendarEvent(auth.userId, existing.googleEventId);
    } catch (e) {
      console.error("[attention] delete calendar event failed", e);
    }
  }

  await db.delete(attentionLogs).where(eq(attentionLogs.id, id));
  return NextResponse.json({ ok: true });
}
