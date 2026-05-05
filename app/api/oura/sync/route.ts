import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { dailySnapshots, users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { ouraFetch } from "@/lib/oura";
import { makeMockSnapshots } from "@/lib/mock-data";

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { days = 7 } = await req.json();
  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  let normalized = makeMockSnapshots(days);

  if (user?.ouraToken) {
    try {
      const [sleep, readiness, activity] = await Promise.all([
        ouraFetch("/v2/usercollection/daily_sleep", user.ouraToken),
        ouraFetch("/v2/usercollection/daily_readiness", user.ouraToken),
        ouraFetch("/v2/usercollection/daily_activity", user.ouraToken),
      ]);
      normalized = (sleep.data ?? []).map((item: any, i: number) => ({
        date: item.day,
        sleepScore: item.score ?? 70,
        readinessScore: readiness.data?.[i]?.score ?? 70,
        activityScore: activity.data?.[i]?.score ?? 70,
        hrv: readiness.data?.[i]?.contributors?.hrv_balance ?? 45,
      }));
    } catch {}
  }

  for (const row of normalized) {
    const [existing] = await db
      .select()
      .from(dailySnapshots)
      .where(and(eq(dailySnapshots.userId, auth.userId), eq(dailySnapshots.date, row.date)))
      .limit(1);
    if (existing) {
      await db.update(dailySnapshots).set(row).where(eq(dailySnapshots.id, existing.id));
    } else {
      await db.insert(dailySnapshots).values({ ...row, userId: auth.userId });
    }
  }
  return NextResponse.json(normalized);
}
