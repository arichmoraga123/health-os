import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { dailySnapshots, users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { rangeStartEnd } from "@/lib/dates";
import { mergeOuraDaily, type NormalizedSnapshot } from "@/lib/oura-sync";
import { ouraFetch } from "@/lib/oura";
import { makeMockSnapshots } from "@/lib/mock-data";

function toRow(userId: string, n: NormalizedSnapshot) {
  return {
    userId,
    date: n.date,
    sleepScore: n.sleepScore,
    readinessScore: n.readinessScore,
    activityScore: n.activityScore,
    hrv: n.hrv != null ? Math.round(n.hrv) : null,
    sleepDuration: n.sleepDuration != null ? Math.round(n.sleepDuration) : null,
    deepSleep: n.deepSleep != null ? Math.round(n.deepSleep) : null,
    remSleep: n.remSleep != null ? Math.round(n.remSleep) : null,
    lightSleep: n.lightSleep != null ? Math.round(n.lightSleep) : null,
    efficiency: n.efficiency != null ? Math.round(n.efficiency) : null,
    latency: n.latency != null ? Math.round(n.latency) : null,
    restfulness: n.restfulness != null ? Math.round(n.restfulness) : null,
    timing: n.timing != null ? Math.round(n.timing) : null,
    steps: n.steps != null ? Math.round(n.steps) : null,
    activeCalories: n.activeCalories != null ? Math.round(n.activeCalories) : null,
    totalCalories: n.totalCalories != null ? Math.round(n.totalCalories) : null,
    walkingDistance: n.walkingDistance,
    highActivityTime: n.highActivityTime != null ? Math.round(n.highActivityTime) : null,
    sedentaryTime: n.sedentaryTime != null ? Math.round(n.sedentaryTime) : null,
    bodyTempDeviation: n.bodyTempDeviation,
    rawSleep: n.rawSleep as object | null,
    rawReadiness: n.rawReadiness as object | null,
    rawActivity: n.rawActivity as object | null,
  };
}

export async function POST(req: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let body: { days?: number; timeZone?: string };
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

  const { start, end } = rangeStartEnd(days, timeZone);
  let normalized: NormalizedSnapshot[] = [];

  if (user?.ouraToken) {
    try {
      const params = { start_date: start, end_date: end };
      const [sleepRes, readinessRes, activityRes] = await Promise.all([
        ouraFetch("v2/usercollection/daily_sleep", user.ouraToken, params),
        ouraFetch("v2/usercollection/daily_readiness", user.ouraToken, params),
        ouraFetch("v2/usercollection/daily_activity", user.ouraToken, params),
      ]);
      const sleepData = Array.isArray(sleepRes?.data) ? sleepRes.data : [];
      const readinessData = Array.isArray(readinessRes?.data) ? readinessRes.data : [];
      const activityData = Array.isArray(activityRes?.data) ? activityRes.data : [];

      if (sleepData.length === 0 && readinessData.length === 0 && activityData.length === 0) {
        normalized = makeMockSnapshots(days).map((m) => ({
          date: m.date,
          sleepScore: m.sleepScore,
          readinessScore: m.readinessScore,
          activityScore: m.activityScore,
          hrv: m.hrv,
          sleepDuration: m.sleepDuration ? m.sleepDuration * 60 : null,
          deepSleep: m.deepSleep ? m.deepSleep * 60 : null,
          remSleep: m.remSleep ? m.remSleep * 60 : null,
          lightSleep: m.lightSleep ? m.lightSleep * 60 : null,
          efficiency: m.efficiency,
          latency: null,
          restfulness: null,
          timing: null,
          steps: m.steps,
          activeCalories: m.activeCalories,
          totalCalories: null,
          walkingDistance: null,
          highActivityTime: null,
          sedentaryTime: null,
          bodyTempDeviation: m.bodyTempDeviation,
          rawSleep: null,
          rawReadiness: null,
          rawActivity: null,
        }));
      } else {
        normalized = mergeOuraDaily(sleepData, readinessData, activityData);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Oura sync failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  } else {
    normalized = makeMockSnapshots(days).map((m) => ({
      date: m.date,
      sleepScore: m.sleepScore,
      readinessScore: m.readinessScore,
      activityScore: m.activityScore,
      hrv: m.hrv,
      sleepDuration: m.sleepDuration ? m.sleepDuration * 60 : null,
      deepSleep: m.deepSleep ? m.deepSleep * 60 : null,
      remSleep: m.remSleep ? m.remSleep * 60 : null,
      lightSleep: m.lightSleep ? m.lightSleep * 60 : null,
      efficiency: m.efficiency,
      latency: null,
      restfulness: null,
      timing: null,
      steps: m.steps,
      activeCalories: m.activeCalories,
      totalCalories: null,
      walkingDistance: null,
      highActivityTime: null,
      sedentaryTime: null,
      bodyTempDeviation: m.bodyTempDeviation,
      rawSleep: null,
      rawReadiness: null,
      rawActivity: null,
    }));
  }

  for (const n of normalized) {
    const row = toRow(auth.userId, n);
    const [existing] = await db
      .select()
      .from(dailySnapshots)
      .where(and(eq(dailySnapshots.userId, auth.userId), eq(dailySnapshots.date, n.date)))
      .limit(1);
    if (existing) {
      await db.update(dailySnapshots).set(row).where(eq(dailySnapshots.id, existing.id));
    } else {
      await db.insert(dailySnapshots).values(row);
    }
  }

  const sorted = [...normalized].sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ data: sorted, range: { start, end, timeZone } });
}
