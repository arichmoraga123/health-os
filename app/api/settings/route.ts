import { eq, type InferInsertModel } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";

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
});

function normalizeHHMM(s: string): string {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

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

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, updated: false });
  }

  await db
    .update(users)
    .set(updates as Partial<InferInsertModel<typeof users>>)
    .where(eq(users.id, auth.userId));

  return NextResponse.json({ ok: true, updated: true });
}
