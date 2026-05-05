import type { DailySnapshotRow } from "@/lib/health";

export type Chronotype = "early_riser" | "intermediate" | "night_owl";

export type TravelReadinessBand = "optimal" | "good" | "at_risk";

export type TravelReadinessResult = {
  score: number;
  band: TravelReadinessBand;
  interpretation: string;
};

function avg(vals: (number | null | undefined)[]): number | null {
  const n = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (!n.length) return null;
  return n.reduce((a, b) => a + b, 0) / n.length;
}

/** Last N rows by date ascending assumed */
export function computeTravelReadiness(rows: DailySnapshotRow[]): TravelReadinessResult {
  const last7 = rows.slice(-7);
  const last5 = rows.slice(-5);
  const last3 = rows.slice(-3);

  const base = avg(last7.map((r) => r.readinessScore)) ?? 70;
  let score = Math.round(base);
  let penalties = 0;
  let bonuses = 0;

  const hrv3 = last3.map((r) => r.hrv);
  if (hrv3.length >= 2) {
    const trend = (hrv3[hrv3.length - 1] ?? 0) - (hrv3[0] ?? 0);
    if (trend < -5) penalties += 10;
  }

  const lowSleepNights = last5.filter((r) => (r.sleepScore ?? 100) < 70).length;
  if (lowSleepNights >= 2) penalties += 5;

  const tempSpike = last3.some((r) => Math.abs(r.bodyTempDeviation ?? 0) > 0.5);
  if (tempSpike) penalties += 8;

  let consecutiveHigh = 0;
  let maxConsecutive = 0;
  for (const r of last7) {
    if ((r.readinessScore ?? 0) > 85) {
      consecutiveHigh++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveHigh);
    } else {
      consecutiveHigh = 0;
    }
  }
  if (maxConsecutive >= 3) bonuses += 5;

  score = Math.max(0, Math.min(100, score - penalties + bonuses));

  let band: TravelReadinessBand = "at_risk";
  if (score >= 85) band = "optimal";
  else if (score >= 70) band = "good";

  let interpretation =
    score >= 70
      ? `You're entering this trip in solid shape: your 7-day readiness baseline is about ${Math.round(base)} and the travel readiness score is ${score}. HRV and sleep patterns look supportive for circadian disruption — you can execute the shift protocol without starting from a deep hole.`
      : `You're entering this trip already fatigued: the travel readiness score is ${score}. Prioritize the pre-flight sleep banking and light protocol below so jet lag does not compound an existing deficit.`;

  if (penalties >= 15) {
    interpretation = `Travel readiness is constrained at ${score}: recent load on sleep, HRV, or temperature suggests incomplete recovery. Front-load an extra rest night and strict light hygiene before departure so adaptation does not stall on arrival.`;
  }

  return { score, band, interpretation };
}

export function detectChronotype(rows: DailySnapshotRow[]): Chronotype {
  const recent = rows.slice(-14).filter((r) => r.bedtimeEnd);
  if (!recent.length) return "intermediate";

  let wakeMinutes = 0;
  let n = 0;
  for (const r of recent) {
    const end = r.bedtimeEnd ? new Date(r.bedtimeEnd as unknown as string) : null;
    if (!end || Number.isNaN(end.getTime())) continue;
    wakeMinutes += end.getHours() * 60 + end.getMinutes();
    n++;
  }
  if (!n) return "intermediate";
  const avgWake = wakeMinutes / n;
  if (avgWake < 6.5 * 60) return "early_riser";
  if (avgWake > 8 * 60) return "night_owl";
  return "intermediate";
}

export function avgBedtimeWakeMinutes(rows: DailySnapshotRow[]): {
  avgBedtime: string;
  avgWake: string;
  avgSleepHours: number | null;
} {
  const recent = rows.slice(-14).filter((r) => r.bedtimeStart && r.bedtimeEnd);
  if (!recent.length) {
    return { avgBedtime: "—", avgWake: "—", avgSleepHours: null };
  }
  let bedM = 0;
  let wakeM = 0;
  let sleepSec = 0;
  for (const r of recent) {
    const bs = new Date(r.bedtimeStart as unknown as string);
    const be = new Date(r.bedtimeEnd as unknown as string);
    if (Number.isNaN(bs.getTime()) || Number.isNaN(be.getTime())) continue;
    bedM += bs.getHours() * 60 + bs.getMinutes();
    wakeM += be.getHours() * 60 + be.getMinutes();
    if (r.sleepDuration) sleepSec += r.sleepDuration;
  }
  const n = recent.length;
  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60) % 24;
    const m = Math.round(mins % 60);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };
  return {
    avgBedtime: fmt(bedM / n),
    avgWake: fmt(wakeM / n),
    avgSleepHours: sleepSec ? sleepSec / n / 3600 : null,
  };
}

export function hrv7DayAverage(rows: DailySnapshotRow[]): number | null {
  const last7 = rows.slice(-7);
  return avg(last7.map((r) => r.hrv));
}

export function currentReadiness(rows: DailySnapshotRow[]): number | null {
  const last = rows[rows.length - 1];
  return last?.readinessScore ?? null;
}
