import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { loadWorkouts } from "@/lib/oura-workouts";

export async function GET(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const url = new URL(req.url);
  const days = Math.min(30, Math.max(1, Number(url.searchParams.get("days")) || 14));
  const tzParam = url.searchParams.get("timeZone");
  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  const timeZone = tzParam || user?.currentTimezone || user?.homeTimezone || "UTC";

  try {
    const { data, range } = await loadWorkouts(user?.ouraToken, timeZone, days);
    return NextResponse.json({ data, timeZone, range });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Workout fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
