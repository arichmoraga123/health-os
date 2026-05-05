import { and, asc, desc, eq, gte } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "@/db/client";
import { dailyAiBriefs, dailySnapshots, journalEntries, users } from "@/db/schema";
import { dateKeyInTimeZone, rangeStartEnd, yesterdayKeyInZone } from "@/lib/dates";
import { makeMockSnapshots } from "@/lib/mock-data";

export type DailySnapshotRow = InferSelectModel<typeof dailySnapshots>;

/** @deprecated prefer getSnapshotsAsc with explicit timezone */
export async function getSnapshots(userId: string, days: number, timeZone?: string) {
  const user = await getUserById(userId);
  const tz = timeZone || user?.currentTimezone || user?.homeTimezone || "UTC";
  return getSnapshotsAsc(userId, days, tz);
}

export async function getTodayBrief(userId: string) {
  const user = await getUserById(userId);
  const tz = user?.currentTimezone || user?.homeTimezone || "UTC";
  const today = dateKeyInTimeZone(new Date(), tz);
  return getBriefForDate(userId, today);
}

export async function getUserById(userId: string) {
  try {
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return u ?? null;
  } catch {
    return null;
  }
}

export async function getSnapshotsAsc(userId: string, days: number, timeZone: string): Promise<DailySnapshotRow[]> {
  const { start } = rangeStartEnd(days, timeZone);
  try {
    const rows = await db
      .select()
      .from(dailySnapshots)
      .where(and(eq(dailySnapshots.userId, userId), gte(dailySnapshots.date, start)))
      .orderBy(asc(dailySnapshots.date));
    if (rows.length) return rows;
  } catch {
    // fall through
  }
  return makeMockSnapshots(days).map((m) => ({
    id: crypto.randomUUID(),
    userId,
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
    createdAt: new Date(),
  })) as DailySnapshotRow[];
}

export async function getBriefForDate(userId: string, dateKey: string) {
  try {
    const [row] = await db
      .select()
      .from(dailyAiBriefs)
      .where(and(eq(dailyAiBriefs.userId, userId), eq(dailyAiBriefs.date, dateKey)))
      .limit(1);
    if (row?.briefMarkdown) return row;
    const [latest] = await db
      .select()
      .from(dailyAiBriefs)
      .where(eq(dailyAiBriefs.userId, userId))
      .orderBy(desc(dailyAiBriefs.date))
      .limit(1);
    if (latest?.briefMarkdown) return latest;
  } catch {}
  return {
    briefMarkdown:
      "You are carrying strong momentum. Protect evening wind-down and keep intensity moderate if HRV dips below baseline.",
    keyInsight: "Your consistency drives readiness.",
    actionItems: ["Morning light within 30 min of wake", "End caffeine by 2 PM", "20-minute walk post dinner"],
    moodPrompt: "What helped you feel calm yesterday?",
    date: dateKey,
  };
}

export async function getRecentJournal(userId: string) {
  try {
    return await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .orderBy(desc(journalEntries.date))
      .limit(14);
  } catch {
    return [];
  }
}

export function pickTodayRow<T extends { date: string }>(
  rows: T[],
  timeZone: string,
): { row: T | undefined; isFallback: boolean; label: string } {
  const today = dateKeyInTimeZone(new Date(), timeZone);
  const yStr = yesterdayKeyInZone(timeZone);
  const todayRow = rows.find((r) => r.date === today);
  if (todayRow) return { row: todayRow, isFallback: false, label: today };
  const yRow = rows.find((r) => r.date === yStr);
  if (yRow) return { row: yRow, isFallback: true, label: yStr };
  const last = rows[rows.length - 1];
  return { row: last, isFallback: true, label: last?.date ?? today };
}

export function prevRow<T extends { date: string }>(rows: T[], currentDate: string): T | undefined {
  const idx = rows.findIndex((r) => r.date === currentDate);
  if (idx <= 0) return undefined;
  return rows[idx - 1];
}

/** Format Oura sleep seconds as "1h 32m" */
export function formatDurationSeconds(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const m = Math.round(sec / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm}m`;
  return `${h}h ${mm}m`;
}
