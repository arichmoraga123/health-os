import type { FlightTimelineSegment, Phase5StructuredPlan } from "@/lib/trip-plan-types";

/** Strip one or more outer ```json ... ``` wrappers. */
export function stripCodeFences(text: string): string {
  let t = text.trim();
  for (let i = 0; i < 4; i++) {
    const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/im);
    if (m) t = m[1].trim();
    else break;
  }
  return t;
}

export function tryParseJsonObject(text: string): Record<string, unknown> | null {
  const stripped = stripCodeFences(text.trim());
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function coercePhase(p: unknown): FlightTimelineSegment["phase"] {
  const s = String(p ?? "awake").toLowerCase().replace(/-/g, "_");
  if (s === "sleep" || s === "sleep_now") return "sleep";
  if (s === "awake" || s === "stay_awake") return "awake";
  if (s === "wind_down" || s === "winddown") return "wind_down";
  if (s === "caffeine") return "caffeine";
  if (s === "melatonin") return "melatonin";
  return "awake";
}

function normalizeSegment(seg: unknown): FlightTimelineSegment | null {
  if (!seg || typeof seg !== "object") return null;
  const s = seg as Record<string, unknown>;
  const start = Number(
    s.startHourOfFlight ?? s.start_hour_of_flight ?? s.startHour ?? s.start ?? 0,
  );
  const end = Number(s.endHourOfFlight ?? s.end_hour_of_flight ?? s.endHour ?? s.end ?? 0);
  return {
    startHourOfFlight: Number.isFinite(start) ? start : 0,
    endHourOfFlight: Number.isFinite(end) ? end : 0,
    phase: coercePhase(s.phase),
    label: String(s.label ?? ""),
    detail: s.detail != null ? String(s.detail) : undefined,
  };
}

function normalizeFlightTimeline(ft: unknown): Phase5StructuredPlan["flightTimeline"] {
  if (!ft || typeof ft !== "object") return undefined;
  const o = ft as Record<string, unknown>;
  const rawSegs = (o.segments ?? o.Segments) as unknown;
  if (!Array.isArray(rawSegs)) return { segments: [], narrative: o.narrative != null ? String(o.narrative) : undefined };
  const segments = rawSegs.map(normalizeSegment).filter((x): x is FlightTimelineSegment => x != null);
  return {
    segments,
    narrative: o.narrative != null ? String(o.narrative) : undefined,
  };
}

function liftSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const pairs: [string, string][] = [
    ["executiveSummary", "executive_summary"],
    ["performanceFraming", "performance_framing"],
    ["directionScience", "direction_science"],
    ["chronotypeAdvice", "chronotype_advice"],
    ["preDepartureDays", "pre_departure_days"],
    ["preDeparture", "pre_departure"],
    ["flightTimeline", "flight_timeline"],
    ["flightPlan", "flight_plan"],
    ["arrivalProtocol", "arrival_protocol"],
    ["arrivalDay", "arrival_day"],
    ["dailyPlans", "daily_plans"],
    ["predictedRecoveryCurve", "predicted_recovery_curve"],
    ["melatoninSchedule", "melatonin_schedule"],
    ["caffeineStrategy", "caffeine_strategy"],
    ["caffeineTimelineDays", "caffeine_timeline_days"],
    ["sleepBanking", "sleep_banking"],
    ["serverMeta", "server_meta"],
  ];
  const out = { ...obj };
  for (const [camel, snake] of pairs) {
    if (out[camel] == null && out[snake] != null) out[camel] = out[snake];
  }
  return out;
}

function unwrapExecutiveSummaryField(obj: Record<string, unknown>): void {
  const ex = obj.executiveSummary;
  if (typeof ex !== "string") return;
  let t = ex.trim();
  if (!t) return;
  if (t.startsWith("```") || (t.startsWith("{") && t.includes('"executiveSummary"'))) {
    const inner = tryParseJsonObject(t);
    if (inner) {
      for (const [k, v] of Object.entries(inner)) {
        if (v === undefined || v === null) continue;
        if (obj[k] == null || k === "executiveSummary") obj[k] = v;
      }
    }
  }
  if (typeof obj.executiveSummary === "string") {
    obj.executiveSummary = stripCodeFences(String(obj.executiveSummary));
  }
}

function normalizeDirectionScience(ds: unknown): Phase5StructuredPlan["directionScience"] {
  if (!ds || typeof ds !== "object") return undefined;
  const o = ds as Record<string, unknown>;
  let bullets = o.bullets;
  if (typeof bullets === "string") {
    bullets = bullets
      .split(/\n|•/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  const bulletList: unknown[] = Array.isArray(bullets) ? bullets : [];
  return {
    direction: String(o.direction ?? ""),
    bullets: bulletList.map((b) => String(b)),
  };
}

function normalizePreDepartureDay(d: unknown): unknown {
  if (!d || typeof d !== "object") return d;
  const o = d as Record<string, unknown>;
  return {
    dayLabel: String(o.dayLabel ?? o.day_label ?? ""),
    date: o.date != null ? String(o.date) : undefined,
    bedtime: String(o.bedtime ?? ""),
    wake: String(o.wake ?? ""),
    brightLight: String(o.brightLight ?? o.bright_light ?? ""),
    avoidBrightLight: String(o.avoidBrightLight ?? o.avoid_bright_light ?? ""),
    melatonin: o.melatonin != null ? String(o.melatonin) : undefined,
    exercise: String(o.exercise ?? ""),
    caffeineCutoff: String(o.caffeineCutoff ?? o.caffeine_cutoff ?? ""),
  };
}

function normalizeDailyPlanRow(row: unknown): unknown {
  if (!row || typeof row !== "object") return row;
  const o = row as Record<string, unknown>;
  return {
    ...o,
    dayNumber: Number(o.dayNumber ?? o.day_number ?? o.day ?? 0),
    date: String(o.date ?? ""),
    targetSleep: String(o.targetSleep ?? o.target_sleep ?? ""),
    targetWake: String(o.targetWake ?? o.target_wake ?? ""),
    lightSeek: String(o.lightSeek ?? o.light_seek ?? ""),
    lightAvoid: String(o.lightAvoid ?? o.light_avoid ?? ""),
    exercise: String(o.exercise ?? ""),
    expectedReadiness: Number(o.expectedReadiness ?? o.expected_readiness ?? 0),
    expectedHRV: o.expectedHRV ?? o.expected_hrv,
    expectedHrvPctOfBaseline: o.expectedHrvPctOfBaseline ?? o.expected_hrv_pct_of_baseline,
    notes: String(o.notes ?? ""),
    highStakesWarning:
      o.highStakesWarning != null
        ? String(o.highStakesWarning)
        : o.high_stakes_warning != null
          ? String(o.high_stakes_warning)
          : undefined,
  };
}

function normalizeFlightPlan(fp: unknown): unknown {
  if (!fp || typeof fp !== "object") return fp;
  const o = fp as Record<string, unknown>;
  const out = { ...o };
  if (out.sleepWindows == null && out.sleep_windows != null) out.sleepWindows = out.sleep_windows;
  if (out.awakeWindows == null && out.awake_windows != null) out.awakeWindows = out.awake_windows;
  if (out.melatoninOnFlight == null && out.melatonin_on_flight != null)
    out.melatoninOnFlight = out.melatonin_on_flight;
  if (out.mealStrategy == null && out.meal_strategy != null) out.mealStrategy = out.meal_strategy;
  if (out.hydrationMlPerHour == null && out.hydration_ml_per_hour != null)
    out.hydrationMlPerHour = out.hydration_ml_per_hour;
  if (out.timesSummary == null && out.times_summary != null) out.timesSummary = out.times_summary;
  if (out.screenPolicy == null && out.screen_policy != null) out.screenPolicy = out.screen_policy;
  if (out.seatAndGear == null && out.seat_and_gear != null) out.seatAndGear = out.seat_and_gear;
  return out;
}

function normalizeArrivalProtocol(ap: unknown): unknown {
  if (!ap || typeof ap !== "object") return ap;
  const o = ap as Record<string, unknown>;
  return {
    hotelCheckIn: o.hotelCheckIn ?? o.hotel_check_in,
    napRule: o.napRule ?? o.nap_rule,
    firstMeal: o.firstMeal ?? o.first_meal,
    brightLightWindow: o.brightLightWindow ?? o.bright_light_window,
    avoidList: o.avoidList ?? o.avoid_list,
    exercise: o.exercise,
  };
}

function normalizeSleepBanking(sb: unknown): unknown {
  if (!sb || typeof sb !== "object") return sb;
  const o = sb as Record<string, unknown>;
  const checklist = o.dailyChecklist ?? o.daily_checklist;
  const mapped = Array.isArray(checklist)
    ? checklist.map((c) => {
        if (!c || typeof c !== "object") return c;
        const x = c as Record<string, unknown>;
        return {
          dayLabel: String(x.dayLabel ?? x.day_label ?? ""),
          targetHours: Number(x.targetHours ?? x.target_hours ?? 0),
          tip: String(x.tip ?? ""),
        };
      })
    : [];
  return {
    narrative: String(o.narrative ?? ""),
    targetSleepHours: Number(o.targetSleepHours ?? o.target_sleep_hours ?? 8.5),
    hoursToBankTotal: Number(o.hoursToBankTotal ?? o.hours_to_bank_total ?? 0),
    dailyChecklist: mapped,
  };
}

/**
 * Normalize DB/API payload: unwrap stringified JSON, markdown fences, snake_case,
 * and nested JSON mistakenly stored in executiveSummary.
 */
export function normalizeStructuredPlan(raw: unknown): Phase5StructuredPlan {
  if (raw == null) {
    return { executiveSummary: "No plan data." };
  }

  if (typeof raw === "string") {
    const parsed = tryParseJsonObject(raw);
    if (parsed) return normalizeStructuredPlan(parsed);
    return { executiveSummary: stripCodeFences(raw).slice(0, 8000) };
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { executiveSummary: String(raw).slice(0, 2000) };
  }

  let obj = { ...(raw as Record<string, unknown>) };

  if (typeof obj.raw === "string") {
    const inner = tryParseJsonObject(obj.raw);
    if (inner) obj = { ...obj, ...inner };
  }

  obj = liftSnakeCase(obj);
  unwrapExecutiveSummaryField(obj);

  if (obj.flightTimeline) {
    obj.flightTimeline = normalizeFlightTimeline(obj.flightTimeline);
  }
  if (obj.directionScience) {
    obj.directionScience = normalizeDirectionScience(obj.directionScience);
  }
  if (obj.flightPlan) {
    obj.flightPlan = normalizeFlightPlan(obj.flightPlan);
  }
  if (obj.arrivalProtocol) {
    obj.arrivalProtocol = normalizeArrivalProtocol(obj.arrivalProtocol);
  }
  if (obj.sleepBanking) {
    obj.sleepBanking = normalizeSleepBanking(obj.sleepBanking);
  }
  if (Array.isArray(obj.preDepartureDays)) {
    obj.preDepartureDays = obj.preDepartureDays.map(normalizePreDepartureDay);
  }
  if (Array.isArray(obj.dailyPlans)) {
    obj.dailyPlans = obj.dailyPlans.map(normalizeDailyPlanRow);
  }
  if (Array.isArray(obj.caffeineTimelineDays)) {
    obj.caffeineTimelineDays = obj.caffeineTimelineDays.map((d) => {
      if (!d || typeof d !== "object") return d;
      const x = d as Record<string, unknown>;
      return {
        dayLabel: String(x.dayLabel ?? x.day_label ?? ""),
        okWindows: (x.okWindows ?? x.ok_windows) as string[],
        avoidWindows: (x.avoidWindows ?? x.avoid_windows) as string[],
      };
    });
  }

  return obj as Phase5StructuredPlan;
}

/** Parse assistant message text into a structured plan (server). */
export function parseClaudeTripPlanPayload(text: string): Phase5StructuredPlan {
  const parsed = tryParseJsonObject(text);
  if (parsed) return normalizeStructuredPlan(parsed);
  return normalizeStructuredPlan({ raw: text });
}
