export type NormalizedSnapshot = {
  date: string;
  sleepScore: number | null;
  readinessScore: number | null;
  activityScore: number | null;
  hrv: number | null;
  sleepDuration: number | null;
  deepSleep: number | null;
  remSleep: number | null;
  lightSleep: number | null;
  efficiency: number | null;
  latency: number | null;
  restfulness: number | null;
  timing: number | null;
  steps: number | null;
  activeCalories: number | null;
  totalCalories: number | null;
  walkingDistance: number | null;
  highActivityTime: number | null;
  sedentaryTime: number | null;
  bodyTempDeviation: number | null;
  rawSleep: unknown;
  rawReadiness: unknown;
  rawActivity: unknown;
};

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mergeOuraDaily(
  sleepRows: Array<Record<string, unknown>>,
  readinessRows: Array<Record<string, unknown>>,
  activityRows: Array<Record<string, unknown>>,
): NormalizedSnapshot[] {
  const sleepByDay = new Map<string, Record<string, unknown>>();
  for (const row of sleepRows) {
    const day = String(row.day ?? row.date ?? "");
    if (day) sleepByDay.set(day, row);
  }
  const readinessByDay = new Map<string, Record<string, unknown>>();
  for (const row of readinessRows) {
    const day = String(row.day ?? row.date ?? "");
    if (day) readinessByDay.set(day, row);
  }
  const activityByDay = new Map<string, Record<string, unknown>>();
  for (const row of activityRows) {
    const day = String(row.day ?? row.date ?? "");
    if (day) activityByDay.set(day, row);
  }

  const days = new Set<string>([
    ...sleepByDay.keys(),
    ...readinessByDay.keys(),
    ...activityByDay.keys(),
  ]);
  const sorted = [...days].sort();

  return sorted.map((date) => {
    const s = sleepByDay.get(date);
    const r = readinessByDay.get(date);
    const a = activityByDay.get(date);

    const sleepContrib = (s?.contributors ?? {}) as Record<string, unknown>;
    const readContrib = (r?.contributors ?? {}) as Record<string, unknown>;

    return {
      date,
      sleepScore: num(s?.score),
      sleepDuration: num(s?.total_sleep_duration),
      deepSleep: num(s?.deep_sleep_duration),
      remSleep: num(s?.rem_sleep_duration),
      lightSleep: num(s?.light_sleep_duration),
      hrv: num(s?.average_hrv) ?? num(readContrib.hrv_balance),
      efficiency: num(s?.efficiency),
      latency: num(s?.latency),
      restfulness: num(sleepContrib.restfulness),
      timing: num(sleepContrib.timing),
      readinessScore: num(r?.score),
      bodyTempDeviation: num(r?.temperature_deviation),
      activityScore: num(a?.score),
      steps: num(a?.steps),
      activeCalories: num(a?.active_calories),
      totalCalories: num(a?.total_calories),
      walkingDistance: num(a?.equivalent_walking_distance),
      highActivityTime: num(a?.high_activity_time),
      sedentaryTime: num(a?.sedentary_time),
      rawSleep: s ?? null,
      rawReadiness: r ?? null,
      rawActivity: a ?? null,
    };
  });
}
