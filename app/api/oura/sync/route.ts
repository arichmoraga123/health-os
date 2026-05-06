import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { runOuraSyncForUser } from "@/lib/run-oura-sync";

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let body: { days?: number; timeZone?: string; reset?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const days = Math.min(90, Math.max(1, Number(body.days) || 7));
  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  const timeZone = body.timeZone || user?.currentTimezone || user?.homeTimezone || "UTC";

  if (body.timeZone && user) {
    await db.update(users).set({ currentTimezone: body.timeZone }).where(eq(users.id, user.id));
  }

  const result = await runOuraSyncForUser({
    userId: auth.userId,
    days,
    timeZone,
    reset: body.reset,
    updateCurrentTimezone: false,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    data: result.data,
    range: result.range,
    syncedDays: result.syncedDays,
    message: result.message,
  });
}
