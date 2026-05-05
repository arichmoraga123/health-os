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
  awakeTime: number | null;
  timeInBed: number | null;
  bedtimeStart: Date | null;
  bedtimeEnd: Date | null;
  efficiency: number | null;
  latency: number | null;
  averageBreath: number | null;
  lowestHeartRate: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  minSpo2: number | null;
  avgSpo2: number | null;
  inactivityAlerts: number | null;
  averageMetMinutes: number | null;
  targetCalories: number | null;
  targetMeters: number | null;
  stressHigh: number | null;
  recoveryHigh: number | null;
  stressSummary: string | null;
  resilienceLevel: string | null;
  resilienceSleepRecovery: number | null;
  resilienceDaytimeRecovery: number | null;
  resilienceStressBalance: number | null;
  optimalBedtimeStart: string | null;
  optimalBedtimeEnd: string | null;
  hrvBalance: number | null;
  recoveryIndex: number | null;
  restingHeartRateScore: number | null;
  bodyTemperatureScore: number | null;
  activityBalance: number | null;
  sleepBalance: number | null;
  previousDayActivity: number | null;
  previousNightScore: number | null;
  stayActiveScore: number | null;
  moveEveryHourScore: number | null;
  meetDailyTargetsScore: number | null;
  trainingFrequencyScore: number | null;
  trainingVolumeScore: number | null;
  recoveryTimeScore: number | null;
  tags: unknown;
  sleepPhase5Min: unknown;
  hrv5Min: unknown;
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

let hasLoggedSleepSample = false;

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function mergeOuraDaily(
  sleepRows: Array<Record<string, unknown>>,
  readinessRows: Array<Record<string, unknown>>,
  activityRows: Array<Record<string, unknown>>,
  detailed: {
    sleepByDay?: Map<string, Array<Record<string, unknown>>>;
    heartByDay?: Map<string, Record<string, unknown>>;
    spo2ByDay?: Map<string, Record<string, unknown>>;
    stressByDay?: Map<string, Record<string, unknown>>;
    resilienceByDay?: Map<string, Record<string, unknown>>;
    tagsByDay?: Map<string, unknown[]>;
    sleepTimeByDay?: Map<string, Record<string, unknown>>;
  } = {},
): NormalizedSnapshot[] {
  function pickMainSleepRecord(rows: Array<Record<string, unknown>> | undefined) {
    if (!rows || rows.length === 0) return undefined;
    const longSleep = rows.find((r) => String(r.type ?? "") === "long_sleep");
    if (longSleep) return longSleep;
    return [...rows].sort(
      (a, b) => (num(b.total_sleep_duration) ?? -1) - (num(a.total_sleep_duration) ?? -1),
    )[0];
  }

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
    const ds = pickMainSleepRecord(detailed.sleepByDay?.get(date));
    const hr = detailed.heartByDay?.get(date);
    const spo2 = detailed.spo2ByDay?.get(date);
    const stress = detailed.stressByDay?.get(date);
    const resilience = detailed.resilienceByDay?.get(date);
    const tags = detailed.tagsByDay?.get(date) ?? [];
    const sleepTime = detailed.sleepTimeByDay?.get(date);

    const sleepContrib = (s?.contributors ?? {}) as Record<string, unknown>;
    const readContrib = (r?.contributors ?? {}) as Record<string, unknown>;
    const activityContrib = (a?.contributors ?? {}) as Record<string, unknown>;
    const resilContrib = (resilience?.contributors ?? {}) as Record<string, unknown>;

    if (!hasLoggedSleepSample && ds) {
      hasLoggedSleepSample = true;
      console.log("Oura sleep sample fields", {
        keys: Object.keys(ds),
        sample: ds,
      });
    }

    const deepSleep = num(ds?.deep_sleep_duration) ?? num(s?.deep_sleep_duration);
    console.log("[oura-sync] deepSleep assignment", {
      date,
      deepSleep,
      detailedType: ds?.type ?? null,
      detailedDeepSleep: ds?.deep_sleep_duration ?? null,
    });

    return {
      date,
      sleepScore: num(s?.score),
      sleepDuration: num(ds?.total_sleep_duration) ?? num(s?.total_sleep_duration),
      deepSleep,
      remSleep: num(ds?.rem_sleep_duration) ?? num(s?.rem_sleep_duration),
      lightSleep: num(ds?.light_sleep_duration) ?? num(s?.light_sleep_duration),
      awakeTime: num(ds?.awake_time),
      timeInBed: num(ds?.time_in_bed),
      bedtimeStart: ds?.bedtime_start ? new Date(String(ds.bedtime_start)) : null,
      bedtimeEnd: ds?.bedtime_end ? new Date(String(ds.bedtime_end)) : null,
      hrv: num(ds?.average_hrv) ?? num(s?.average_hrv) ?? num(readContrib.hrv_balance),
      efficiency: num(ds?.efficiency) ?? num(s?.efficiency),
      latency:
        num(ds?.latency) != null
          ? Math.round((num(ds?.latency) ?? 0) / 60)
          : num(s?.latency) != null
            ? Math.round((num(s?.latency) ?? 0) / 60)
            : null,
      averageBreath: num(ds?.average_breath),
      lowestHeartRate: num(ds?.lowest_heart_rate),
      averageHeartRate: num(ds?.average_heart_rate) ?? num(hr?.average_heart_rate),
      maxHeartRate: num(hr?.max_heart_rate) ?? num(ds?.max_heart_rate),
      minSpo2: num(spo2?.spo2_percentage_min),
      avgSpo2: num(spo2?.average_spo2),
      inactivityAlerts: num(a?.inactivity_alerts),
      averageMetMinutes: num(a?.average_met_minutes),
      targetCalories: num(a?.target_calories),
      targetMeters: num(a?.target_meters),
      stressHigh: num(stress?.stress_high),
      recoveryHigh: num(stress?.recovery_high),
      stressSummary:
        typeof stress?.day_summary === "string" ? String(stress.day_summary) : null,
      resilienceLevel:
        typeof resilience?.level === "string" ? String(resilience.level) : null,
      resilienceSleepRecovery: num(resilContrib.sleep_recovery),
      resilienceDaytimeRecovery: num(resilContrib.daytime_recovery),
      resilienceStressBalance: num(resilContrib.stress_balance),
      optimalBedtimeStart:
        typeof sleepTime?.optimal_bedtime_start === "string"
          ? String(sleepTime.optimal_bedtime_start)
          : null,
      optimalBedtimeEnd:
        typeof sleepTime?.optimal_bedtime_end === "string"
          ? String(sleepTime.optimal_bedtime_end)
          : null,
      hrvBalance: num(readContrib.hrv_balance),
      recoveryIndex: num(readContrib.recovery_index),
      restingHeartRateScore: num(readContrib.resting_heart_rate),
      bodyTemperatureScore: num(readContrib.body_temperature),
      activityBalance: num(readContrib.activity_balance),
      sleepBalance: num(readContrib.sleep_balance),
      previousDayActivity: num(readContrib.previous_day_activity),
      previousNightScore: num(readContrib.previous_night),
      stayActiveScore: num(activityContrib.stay_active),
      moveEveryHourScore: num(activityContrib.move_every_hour),
      meetDailyTargetsScore: num(activityContrib.meet_daily_targets),
      trainingFrequencyScore: num(activityContrib.training_frequency),
      trainingVolumeScore: num(activityContrib.training_volume),
      recoveryTimeScore: num(activityContrib.recovery_time),
      tags,
      sleepPhase5Min: ds?.sleep_phase_5_min ?? null,
      hrv5Min: ds?.hrv_5_min ?? null,
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
      rawReadiness: { row: r ?? null, contributors: readContrib },
      rawActivity: { row: a ?? null, contributors: activityContrib },
    };
  });
}
