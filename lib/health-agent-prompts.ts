import type { DailySnapshotRow } from "@/lib/health";

function avg(nums: (number | null | undefined)[]): number | null {
  const n = nums.filter((x): x is number => x != null && Number.isFinite(x));
  if (!n.length) return null;
  return n.reduce((a, b) => a + b, 0) / n.length;
}

function pickLatestWithSleep(rows: DailySnapshotRow[]): DailySnapshotRow | undefined {
  return [...rows].reverse().find((r) => r.sleepScore != null || (r.sleepDuration ?? 0) > 0);
}

function readinessLabel(score: number | null | undefined): string {
  if (score == null) return "unknown";
  if (score >= 85) return "peak — you can push";
  if (score >= 70) return "good — normal training day";
  return "recovery — prioritize easy movement and sleep";
}

export function buildFlags(rows: DailySnapshotRow[]): string {
  const last3 = rows.slice(-3);
  const last5 = rows.slice(-5);
  const hrvDown =
    last3.length >= 2 &&
    (last3[last3.length - 1]?.hrv ?? 0) < (last3[0]?.hrv ?? 0) - 5;
  const lowSleep = last5.filter((r) => (r.sleepScore ?? 100) < 70).length >= 2;
  const parts: string[] = [];
  if (hrvDown) parts.push("HRV trending down over the last few days");
  if (lowSleep) parts.push("sleep score below 70 for 2+ of the last 5 nights");
  return parts.length ? parts.join("; ") : "none notable";
}

export function buildMorningPrompt(
  name: string,
  rows: DailySnapshotRow[],
  sleepRow: DailySnapshotRow | undefined,
  todayRow: DailySnapshotRow | undefined,
): string {
  const last7 = rows.slice(-7);
  const hrv7 = avg(last7.map((r) => r.hrv));
  const todayHrv = todayRow?.hrv ?? sleepRow?.hrv;
  const hrvTrend =
    hrv7 != null && todayHrv != null
      ? todayHrv > hrv7 + 3
        ? "higher"
        : todayHrv < hrv7 - 3
          ? "lower"
          : "in line"
      : "unknown";

  const readiness = todayRow?.readinessScore ?? sleepRow?.readinessScore;
  const durMin = sleepRow?.sleepDuration != null ? Math.round(sleepRow.sleepDuration / 60) : null;
  const deepMin = sleepRow?.deepSleep != null ? Math.round(sleepRow.deepSleep / 60) : null;
  const remMin = sleepRow?.remSleep != null ? Math.round(sleepRow.remSleep / 60) : null;

  const yesterdayActivity = [...rows].reverse().find((r) => r.steps != null);

  return `You are a personal health AI companion texting a high-performing professional their morning health brief. Be warm, specific, and actionable. Reference their actual numbers. Write like a knowledgeable friend, not a medical report. Keep it under 200 words. Use their name.

User's data:
- Name: ${name}
- Last night: sleep score ${sleepRow?.sleepScore ?? "n/a"}, ${durMin != null ? `${durMin} min` : "n/a"} total sleep, ${deepMin ?? "n/a"}min deep, ${remMin ?? "n/a"}min REM, efficiency ${sleepRow?.efficiency ?? "n/a"}%, HRV ${sleepRow?.hrv ?? "n/a"}ms, resting HR ${sleepRow?.lowestHeartRate ?? "n/a"}bpm, bedtime ${sleepRow?.bedtimeStart ? new Date(sleepRow.bedtimeStart).toISOString() : "n/a"}, wake ${sleepRow?.bedtimeEnd ? new Date(sleepRow.bedtimeEnd).toISOString() : "n/a"}
- Readiness today: ${readiness ?? "n/a"} (${readinessLabel(readiness)})
- 7-day HRV average: ${hrv7 != null ? `${Math.round(hrv7)}ms` : "n/a"} (today is ${hrvTrend} than average)
- Body temp deviation: ${todayRow?.bodyTempDeviation ?? sleepRow?.bodyTempDeviation ?? "n/a"}°C
- Yesterday's activity: ${yesterdayActivity?.steps ?? "n/a"} steps, ${yesterdayActivity?.activeCalories ?? "n/a"} active calories
- Any flags: ${buildFlags(rows)}

Generate a morning message covering:
1. One-sentence sleep summary with the key number
2. What their readiness means for today (push hard / normal day / recovery day)
3. One specific actionable tip based on their data
4. One thing to watch today

Tone: Like a sharp, caring coach who knows their data cold. Not overly positive — be honest if numbers are low.`;
}

export function buildEveningPrompt(name: string, rows: DailySnapshotRow[], todayRow: DailySnapshotRow | undefined): string {
  const last7 = rows.slice(-7);
  const hrv7 = avg(last7.map((r) => r.hrv));
  const trend =
    todayRow?.hrv != null && hrv7 != null
      ? todayRow.hrv > hrv7
        ? "above baseline"
        : todayRow.hrv < hrv7
          ? "below baseline"
          : "near baseline"
      : "unknown";

  const sleepRow = pickLatestWithSleep(rows);
  const optBed = sleepRow?.optimalBedtimeStart && sleepRow?.optimalBedtimeEnd
    ? `${sleepRow.optimalBedtimeStart}–${sleepRow.optimalBedtimeEnd}`
    : "their usual average window";

  return `You are a personal health AI making an evening check-in call to a high-performing professional. Write a warm, concise script for a 60-90 second voice call. Use their name. Be conversational — this will be read aloud by a voice AI. Keep under 250 words.

Today's data:
- Activity score: ${todayRow?.activityScore ?? "n/a"}
- Steps: ${todayRow?.steps ?? "n/a"} (goal: 10,000)
- Active calories: ${todayRow?.activeCalories ?? "n/a"}
- High activity time: ${todayRow?.highActivityTime != null ? `${Math.round(todayRow.highActivityTime / 60)} min` : "n/a"}
- Inactivity alerts: ${todayRow?.inactivityAlerts ?? "n/a"}
- Current readiness: ${todayRow?.readinessScore ?? "n/a"}
- HRV trend today vs baseline: ${trend}

Typical optimal bedtime window from data: ${optBed}

Generate a call script covering:
1. Warm greeting using their name
2. Today's activity summary in one sentence
3. One observation about today's data (good or needs attention)
4. Tonight's wind-down recommendation based on their data
5. Optimal bedtime based on their average sleep schedule
6. One thing to do right now to set up a good night

Tone: Warm, direct, like a trusted advisor. Not robotic. Natural pauses indicated with commas. End with an encouraging close.`;
}

export { pickLatestWithSleep, readinessLabel };
