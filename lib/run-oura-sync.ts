import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { dailySnapshots, users } from "@/db/schema";
import { rangeStartEnd } from "@/lib/dates";
import { mergeOuraDaily, type NormalizedSnapshot } from "@/lib/oura-sync";
import { ouraFetch } from "@/lib/oura";
import { makeMockSnapshots } from "@/lib/mock-data";

function endpointDebug(name: string, payload: unknown) {
  const rows = Array.isArray((payload as { data?: unknown[] })?.data)
    ? ((payload as { data?: unknown[] }).data ?? [])
    : [];
  const first = rows[0];
  console.log(`[sync] ${name} response`, {
    count: rows.length,
    keys: first && typeof first === "object" ? Object.keys(first as Record<string, unknown>) : [],
    first,
  });
}

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
    awakeTime: n.awakeTime != null ? Math.round(n.awakeTime) : null,
    timeInBed: n.timeInBed != null ? Math.round(n.timeInBed) : null,
    bedtimeStart: n.bedtimeStart,
    bedtimeEnd: n.bedtimeEnd,
    efficiency: n.efficiency != null ? Math.round(n.efficiency) : null,
    latency: n.latency != null ? Math.round(n.latency) : null,
    averageBreath: n.averageBreath,
    lowestHeartRate: n.lowestHeartRate != null ? Math.round(n.lowestHeartRate) : null,
    averageHeartRate: n.averageHeartRate != null ? Math.round(n.averageHeartRate) : null,
    maxHeartRate: n.maxHeartRate != null ? Math.round(n.maxHeartRate) : null,
    minSpo2: n.minSpo2,
    avgSpo2: n.avgSpo2,
    inactivityAlerts: n.inactivityAlerts != null ? Math.round(n.inactivityAlerts) : null,
    averageMetMinutes: n.averageMetMinutes,
    targetCalories: n.targetCalories != null ? Math.round(n.targetCalories) : null,
    targetMeters: n.targetMeters != null ? Math.round(n.targetMeters) : null,
    stressHigh: n.stressHigh != null ? Math.round(n.stressHigh) : null,
    recoveryHigh: n.recoveryHigh != null ? Math.round(n.recoveryHigh) : null,
    stressSummary: n.stressSummary,
    resilienceLevel: n.resilienceLevel,
    resilienceSleepRecovery: n.resilienceSleepRecovery,
    resilienceDaytimeRecovery: n.resilienceDaytimeRecovery,
    resilienceStressBalance: n.resilienceStressBalance,
    optimalBedtimeStart: n.optimalBedtimeStart,
    optimalBedtimeEnd: n.optimalBedtimeEnd,
    hrvBalance: n.hrvBalance != null ? Math.round(n.hrvBalance) : null,
    recoveryIndex: n.recoveryIndex != null ? Math.round(n.recoveryIndex) : null,
    restingHeartRateScore:
      n.restingHeartRateScore != null ? Math.round(n.restingHeartRateScore) : null,
    bodyTemperatureScore:
      n.bodyTemperatureScore != null ? Math.round(n.bodyTemperatureScore) : null,
    activityBalance: n.activityBalance != null ? Math.round(n.activityBalance) : null,
    sleepBalance: n.sleepBalance != null ? Math.round(n.sleepBalance) : null,
    previousDayActivity:
      n.previousDayActivity != null ? Math.round(n.previousDayActivity) : null,
    previousNightScore:
      n.previousNightScore != null ? Math.round(n.previousNightScore) : null,
    stayActiveScore: n.stayActiveScore != null ? Math.round(n.stayActiveScore) : null,
    moveEveryHourScore:
      n.moveEveryHourScore != null ? Math.round(n.moveEveryHourScore) : null,
    meetDailyTargetsScore:
      n.meetDailyTargetsScore != null ? Math.round(n.meetDailyTargetsScore) : null,
    trainingFrequencyScore:
      n.trainingFrequencyScore != null ? Math.round(n.trainingFrequencyScore) : null,
    trainingVolumeScore:
      n.trainingVolumeScore != null ? Math.round(n.trainingVolumeScore) : null,
    recoveryTimeScore:
      n.recoveryTimeScore != null ? Math.round(n.recoveryTimeScore) : null,
    tags: n.tags as object | null,
    sleepPhase5Min: n.sleepPhase5Min as object | null,
    hrv5Min: n.hrv5Min as object | null,
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

export type RunOuraSyncResult =
  | {
      ok: true;
      data: NormalizedSnapshot[];
      range: { start: string; end: string; timeZone: string };
      syncedDays: number;
      message: string;
    }
  | { ok: false; error: string };

export async function runOuraSyncForUser(opts: {
  userId: string;
  days?: number;
  timeZone?: string;
  reset?: boolean;
  updateCurrentTimezone?: boolean;
}): Promise<RunOuraSyncResult> {
  const days = Math.min(90, Math.max(1, Number(opts.days) || 7));
  const [user] = await db.select().from(users).where(eq(users.id, opts.userId)).limit(1);
  if (!user) return { ok: false, error: "User not found" };

  const timeZone =
    opts.timeZone || user.currentTimezone || user.homeTimezone || "UTC";

  if (opts.updateCurrentTimezone && opts.timeZone) {
    await db.update(users).set({ currentTimezone: opts.timeZone }).where(eq(users.id, user.id));
  }

  if (opts.reset) {
    await db.delete(dailySnapshots).where(eq(dailySnapshots.userId, opts.userId));
  }

  const { start, end } = rangeStartEnd(days, timeZone);
  let normalized: NormalizedSnapshot[] = [];

  if (user.ouraToken) {
    try {
      const params = { start_date: start, end_date: end };
      const [sleepRes, readinessRes, activityRes] = await Promise.all([
        ouraFetch("v2/usercollection/daily_sleep", user.ouraToken, params),
        ouraFetch("v2/usercollection/daily_readiness", user.ouraToken, params),
        ouraFetch("v2/usercollection/daily_activity", user.ouraToken, params),
      ]);
      const [
        sleepDetailedRes,
        heartRateRes,
        spo2Res,
        stressRes,
        resilienceRes,
        tagRes,
        sleepTimeRes,
      ] = await Promise.all([
        ouraFetch("v2/usercollection/sleep", user.ouraToken, params).catch(() => ({ data: [] })),
        ouraFetch("v2/usercollection/heartrate", user.ouraToken, params).catch(() => ({ data: [] })),
        ouraFetch("v2/usercollection/spo2", user.ouraToken, params).catch(() => ({ data: [] })),
        ouraFetch("v2/usercollection/daily_stress", user.ouraToken, params).catch(() => ({ data: [] })),
        ouraFetch("v2/usercollection/resilience", user.ouraToken, params).catch(() => ({ data: [] })),
        ouraFetch("v2/usercollection/tag", user.ouraToken, params).catch(() => ({ data: [] })),
        ouraFetch("v2/usercollection/sleep_time", user.ouraToken, params).catch(() => ({ data: [] })),
      ]);
      endpointDebug("daily_sleep", sleepRes);
      const sleepData = Array.isArray(sleepRes?.data) ? sleepRes.data : [];
      const readinessData = Array.isArray(readinessRes?.data) ? readinessRes.data : [];
      const activityData = Array.isArray(activityRes?.data) ? activityRes.data : [];
      const sleepDetailed = Array.isArray(sleepDetailedRes?.data) ? sleepDetailedRes.data : [];
      const heartRateData = Array.isArray(heartRateRes?.data) ? heartRateRes.data : [];
      const spo2Data = Array.isArray(spo2Res?.data) ? spo2Res.data : [];
      const stressData = Array.isArray(stressRes?.data) ? stressRes.data : [];
      const resilienceData = Array.isArray(resilienceRes?.data) ? resilienceRes.data : [];
      const tagData = Array.isArray(tagRes?.data) ? tagRes.data : [];
      const sleepTimeData = Array.isArray(sleepTimeRes?.data) ? sleepTimeRes.data : [];

      const byDay = (rows: Array<Record<string, unknown>>) =>
        new Map(
          rows
            .map((r) => {
              const raw = String(r.day ?? r.date ?? r.timestamp ?? "");
              const day = raw.includes("T") ? raw.slice(0, 10) : raw;
              return [day, r] as const;
            })
            .filter(([k]) => k),
        );
      const sleepByDay = (rows: Array<Record<string, unknown>>) => {
        const m = new Map<string, Array<Record<string, unknown>>>();
        for (const r of rows) {
          const raw = String(r.day ?? r.date ?? r.timestamp ?? "");
          const day = raw.includes("T") ? raw.slice(0, 10) : raw;
          if (!day) continue;
          m.set(day, [...(m.get(day) ?? []), r]);
        }
        return m;
      };
      const tagsByDay = new Map<string, unknown[]>();
      for (const t of tagData) {
        const day = String(t.day ?? t.date ?? "");
        if (!day) continue;
        tagsByDay.set(day, [...(tagsByDay.get(day) ?? []), t]);
      }

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
          awakeTime: null,
          timeInBed: null,
          bedtimeStart: null,
          bedtimeEnd: null,
          efficiency: m.efficiency,
          latency: null,
          averageBreath: null,
          lowestHeartRate: null,
          averageHeartRate: null,
          maxHeartRate: null,
          minSpo2: null,
          avgSpo2: null,
          inactivityAlerts: null,
          averageMetMinutes: null,
          targetCalories: null,
          targetMeters: null,
          stressHigh: null,
          recoveryHigh: null,
          stressSummary: null,
          resilienceLevel: null,
          resilienceSleepRecovery: null,
          resilienceDaytimeRecovery: null,
          resilienceStressBalance: null,
          optimalBedtimeStart: null,
          optimalBedtimeEnd: null,
          hrvBalance: null,
          recoveryIndex: null,
          restingHeartRateScore: null,
          bodyTemperatureScore: null,
          activityBalance: null,
          sleepBalance: null,
          previousDayActivity: null,
          previousNightScore: null,
          stayActiveScore: null,
          moveEveryHourScore: null,
          meetDailyTargetsScore: null,
          trainingFrequencyScore: null,
          trainingVolumeScore: null,
          recoveryTimeScore: null,
          tags: [],
          sleepPhase5Min: null,
          hrv5Min: null,
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
        normalized = mergeOuraDaily(sleepData, readinessData, activityData, {
          sleepByDay: sleepByDay(sleepDetailed),
          heartByDay: byDay(heartRateData),
          spo2ByDay: byDay(spo2Data),
          stressByDay: byDay(stressData),
          resilienceByDay: byDay(resilienceData),
          tagsByDay,
          sleepTimeByDay: byDay(sleepTimeData),
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Oura sync failed";
      return { ok: false, error: message };
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
      awakeTime: null,
      timeInBed: null,
      bedtimeStart: null,
      bedtimeEnd: null,
      efficiency: m.efficiency,
      latency: null,
      averageBreath: null,
      lowestHeartRate: null,
      averageHeartRate: null,
      maxHeartRate: null,
      minSpo2: null,
      avgSpo2: null,
      inactivityAlerts: null,
      averageMetMinutes: null,
      targetCalories: null,
      targetMeters: null,
      stressHigh: null,
      recoveryHigh: null,
      stressSummary: null,
      resilienceLevel: null,
      resilienceSleepRecovery: null,
      resilienceDaytimeRecovery: null,
      resilienceStressBalance: null,
      optimalBedtimeStart: null,
      optimalBedtimeEnd: null,
      hrvBalance: null,
      recoveryIndex: null,
      restingHeartRateScore: null,
      bodyTemperatureScore: null,
      activityBalance: null,
      sleepBalance: null,
      previousDayActivity: null,
      previousNightScore: null,
      stayActiveScore: null,
      moveEveryHourScore: null,
      meetDailyTargetsScore: null,
      trainingFrequencyScore: null,
      trainingVolumeScore: null,
      recoveryTimeScore: null,
      tags: [],
      sleepPhase5Min: null,
      hrv5Min: null,
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
    const row = toRow(opts.userId, n);
    const [existing] = await db
      .select()
      .from(dailySnapshots)
      .where(and(eq(dailySnapshots.userId, opts.userId), eq(dailySnapshots.date, n.date)))
      .limit(1);
    try {
      if (existing) {
        await db.update(dailySnapshots).set(row).where(eq(dailySnapshots.id, existing.id));
      } else {
        await db.insert(dailySnapshots).values(row);
      }
    } catch (e) {
      console.error("[sync] upsert failed", { date: row.date, error: e });
      throw e;
    }
  }

  const sorted = [...normalized].sort((a, b) => a.date.localeCompare(b.date));
  return {
    ok: true,
    data: sorted,
    range: { start, end, timeZone },
    syncedDays: sorted.length,
    message: `Synced ${sorted.length} days of data`,
  };
}
