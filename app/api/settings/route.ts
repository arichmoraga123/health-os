import { addDays, format } from "date-fns";
import { and, eq, isNotNull, isNull, or, type InferInsertModel } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { ouraFetch } from "@/lib/oura";

const patchSchema = z.object({
  phoneNumber: z.string().nullable().optional(),
  notificationEmail: z.string().nullable().optional(),
  morningMessageTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  eveningCallTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  eveningCallEnabled: z.boolean().optional(),
  nightlyEmailEnabled: z.boolean().optional(),
  phoneVerified: z.boolean().optional(),
  homeTimezone: z.string().min(1).optional(),
  currentTimezone: z.string().min(1).optional(),
});

function normalizeHHMM(s: string): string {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const OFFSET_TO_TZ: Record<string, string> = {
  "-08:00": "America/Los_Angeles",
  "-07:00": "America/Denver",
  "-06:00": "America/Chicago",
  "-05:00": "America/New_York",
  "-04:00": "America/New_York",
  "-03:00": "America/Sao_Paulo",
  "-02:00": "Atlantic/South_Georgia",
  "-01:00": "Atlantic/Azores",
  "+00:00": "UTC",
  "+01:00": "Europe/Paris",
  "+02:00": "Europe/Athens",
  "+03:00": "Europe/Moscow",
  "+04:00": "Asia/Dubai",
  "+05:00": "Asia/Karachi",
  "+05:30": "Asia/Kolkata",
  "+06:00": "Asia/Dhaka",
  "+07:00": "Asia/Bangkok",
  "+08:00": "Asia/Singapore",
  "+09:00": "Asia/Tokyo",
  "+10:00": "Australia/Sydney",
  "+11:00": "Pacific/Noumea",
  "+12:00": "Pacific/Auckland",
};
let didRunOneTimeTimezoneMigration = false;

function offsetToTimezone(offset: string): string | null {
  return OFFSET_TO_TZ[offset] ?? null;
}

function extractOffset(ts: unknown): string | null {
  if (typeof ts !== "string") return null;
  const m = ts.match(/([+-]\d{2}:\d{2})$/);
  return m?.[1] ?? null;
}

async function detectTimezoneFromOuraToken(token: string): Promise<string | null> {
  try {
    const end = new Date();
    const start = addDays(end, -14);
    const res = await ouraFetch("v2/usercollection/sleep", token, {
      start_date: format(start, "yyyy-MM-dd"),
      end_date: format(end, "yyyy-MM-dd"),
    });
    const rows = Array.isArray((res as { data?: unknown })?.data) ? ((res as { data: unknown[] }).data ?? []) : [];
    const offsets = rows
      .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
      .filter((r) => r.type === "long_sleep")
      .map((r) => extractOffset(r.bedtime_start))
      .filter((x): x is string => !!x);
    if (!offsets.length) return null;

    const counts = offsets.reduce<Record<string, number>>((acc, off) => {
      acc[off] = (acc[off] ?? 0) + 1;
      return acc;
    }, {});
    const bestOffset = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!bestOffset) return null;
    return offsetToTimezone(bestOffset);
  } catch {
    return null;
  }
}

async function migrateMissingHomeTimezonesFromOura() {
  if (didRunOneTimeTimezoneMigration) return;
  didRunOneTimeTimezoneMigration = true;

  const candidates = await db
    .select({ id: users.id, ouraToken: users.ouraToken })
    .from(users)
    .where(and(or(isNull(users.homeTimezone), eq(users.homeTimezone, "UTC")), isNotNull(users.ouraToken)));

  if (!candidates.length) return;

  const updates: Array<{ id: string; tz: string }> = [];
  for (const row of candidates) {
    if (!row.ouraToken) continue;
    const tz = await detectTimezoneFromOuraToken(row.ouraToken);
    if (tz && tz !== "UTC") updates.push({ id: row.id, tz });
  }

  for (const u of updates) {
    await db.update(users).set({ homeTimezone: u.tz }).where(eq(users.id, u.id));
  }
}

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  await migrateMissingHomeTimezonesFromOura();

  const [u] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    phoneNumber: u.phoneNumber,
    phoneVerified: u.phoneVerified,
    notificationEmail: u.notificationEmail,
    morningMessageTime: u.morningMessageTime,
    eveningCallTime: u.eveningCallTime,
    smsEnabled: u.smsEnabled,
    emailEnabled: u.emailEnabled,
    eveningCallEnabled: u.eveningCallEnabled,
    nightlyEmailEnabled: u.nightlyEmailEnabled,
    email: u.email,
    homeTimezone: u.homeTimezone,
    currentTimezone: u.currentTimezone,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  await migrateMissingHomeTimezonesFromOura();

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.phoneNumber !== undefined) {
    const p = body.phoneNumber?.trim() || null;
    updates.phoneNumber = p;
    if (p === null || p === "") updates.phoneVerified = false;
  }
  if (body.notificationEmail !== undefined) {
    const e = body.notificationEmail?.trim() || null;
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return NextResponse.json({ error: "Invalid notification email" }, { status: 400 });
    }
    updates.notificationEmail = e;
  }
  if (body.morningMessageTime !== undefined) updates.morningMessageTime = normalizeHHMM(body.morningMessageTime);
  if (body.eveningCallTime !== undefined) updates.eveningCallTime = normalizeHHMM(body.eveningCallTime);
  if (body.smsEnabled !== undefined) updates.smsEnabled = body.smsEnabled;
  if (body.emailEnabled !== undefined) updates.emailEnabled = body.emailEnabled;
  if (body.eveningCallEnabled !== undefined) updates.eveningCallEnabled = body.eveningCallEnabled;
  if (body.nightlyEmailEnabled !== undefined) updates.nightlyEmailEnabled = body.nightlyEmailEnabled;
  if (body.phoneVerified !== undefined) updates.phoneVerified = body.phoneVerified;
  if (body.homeTimezone !== undefined) updates.homeTimezone = body.homeTimezone.trim();
  if (body.currentTimezone !== undefined) updates.currentTimezone = body.currentTimezone.trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, updated: false });
  }

  await db
    .update(users)
    .set(updates as Partial<InferInsertModel<typeof users>>)
    .where(eq(users.id, auth.userId));

  return NextResponse.json({ ok: true, updated: true });
}
