/** Phase 5 structured trip plan (Claude JSON + serverMeta merged). */

export type FlightTimelineSegment = {
  startHourOfFlight: number;
  endHourOfFlight: number;
  phase: "sleep" | "awake" | "wind_down" | "caffeine" | "melatonin";
  label: string;
  detail?: string;
};

export type PreDepartureDayCard = {
  dayLabel: string;
  date?: string;
  bedtime: string;
  wake: string;
  brightLight: string;
  avoidBrightLight: string;
  melatonin?: string;
  exercise: string;
  caffeineCutoff: string;
};

export type CaffeineDayWindow = {
  dayLabel: string;
  okWindows: string[];
  avoidWindows: string[];
};

export type DailyRecoveryPlan = {
  dayNumber: number;
  date: string;
  targetSleep: string;
  targetWake: string;
  lightSeek: string;
  lightAvoid: string;
  exercise: string;
  expectedReadiness: number;
  expectedHrvPctOfBaseline?: number;
  expectedHRV?: number;
  notes: string;
  highStakesWarning?: string;
};

export type Phase5StructuredPlan = {
  executiveSummary?: string;
  performanceFraming?: string;
  directionScience?: { direction: string; bullets: string[] };
  chronotypeAdvice?: string;
  preDepartureDays?: PreDepartureDayCard[];
  /** Legacy shape from older plans */
  preDeparture?: Array<{ day: number; advice: string; sleepTarget: string }>;
  flightPlan?: {
    sleepWindows?: Array<{ start: string; end: string; timezone: "origin" | "dest"; note: string }>;
    awakeWindows?: Array<{ start: string; end: string; note: string }>;
    melatoninOnFlight?: string;
    mealStrategy?: string;
    hydrationMlPerHour?: number;
    seatAndGear?: string[];
    screenPolicy?: string;
    timesSummary?: {
      departOriginLocal?: string;
      landDestLocal?: string;
      destTimeAtBoarding?: string;
      destTimeAtLanding?: string;
    };
  };
  flightTimeline?: {
    segments: FlightTimelineSegment[];
    narrative?: string;
  };
  arrivalProtocol?: {
    hotelCheckIn?: string;
    napRule?: string;
    firstMeal?: string;
    brightLightWindow?: string;
    avoidList?: string[];
    exercise?: string;
  };
  arrivalDay?: { immediateActions: string; targetBedtime: string; lightExposure: string };
  dailyPlans?: DailyRecoveryPlan[];
  predictedRecoveryCurve?: Array<{
    dayOffset: number;
    expectedReadiness: number;
    expectedHrvPctOfBaseline: number;
  }>;
  melatoninSchedule?: Array<{ day: number; time: string; dose: string }>;
  caffeineStrategy?: string;
  caffeineTimelineDays?: CaffeineDayWindow[];
  sleepBanking?: {
    narrative: string;
    targetSleepHours: number;
    hoursToBankTotal: number;
    dailyChecklist: Array<{ dayLabel: string; targetHours: number; tip: string }>;
  };
  serverMeta?: {
    travelReadinessScore: number;
    travelReadinessBand: string;
    chronotype: string;
    travelDirection: string;
    baselineHrv7d: number | null;
    readinessToday: number | null;
    avgSleepHours14d: number | null;
  };
  raw?: string;
};

export function isPhase5Plan(p: unknown): p is Phase5StructuredPlan {
  return typeof p === "object" && p !== null;
}
