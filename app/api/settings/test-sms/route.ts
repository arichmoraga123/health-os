import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { sendSms } from "@/lib/messaging";

const bodySchema = z.object({
  phone: z.string().min(8),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const phone = parsed.phone.trim();
  if (!phone.startsWith("+")) {
    return NextResponse.json({ error: "Use E.164 format including country code (e.g. +15551234567)" }, { status: 400 });
  }

  const sms = await sendSms(
    phone,
    "Health OS: test message — you're set up for SMS health briefs. Reply STOP to opt out at the carrier if needed.",
  );
  if (sms.error) {
    return NextResponse.json({ error: sms.error }, { status: 502 });
  }

  await db
    .update(users)
    .set({ phoneNumber: phone, phoneVerified: true })
    .where(eq(users.id, auth.userId));

  return NextResponse.json({ ok: true, sid: sms.sid });
}
