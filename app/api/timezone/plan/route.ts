import { desc, eq } from "drizzle-orm";
import { getTimezoneOffset } from "date-fns-tz";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { timezonePlans } from "@/db/schema";
import { createClaudeMessage } from "@/lib/ai";
import { requireApiUser } from "@/lib/api-auth";
import { resolveCityTimeZone } from "@/lib/city-tz";
import { landingDateKeyInDestination } from "@/lib/trip-dates";
import { getSnapshotsAsc, getUserById } from "@/lib/health";
import type { Phase5StructuredPlan } from "@/lib/trip-plan-types";
import {
  avgBedtimeWakeMinutes,
  computeTravelReadiness,
  currentReadiness,
  detectChronotype,
  hrv7DayAverage,
} from "@/lib/trip-metrics";

function extractJsonObject(text: string): Phase5StructuredPlan | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1)) as Phase5StructuredPlan;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let body: {
    origin?: string;
    destination?: string;
    departureDate?: string;
    departureTime?: string;
    flightDuration?: number;
    returnDate?: string;
    airline?: string;
    flightNumber?: string;
    firstCommitment?: { date?: string; time?: string; type?: string };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const origin = body.origin?.trim() || "";
  const destination = body.destination?.trim() || "";
  const departureDate = body.departureDate || "";
  const departureTime = body.departureTime || "09:00";
  const flightDuration = Number(body.flightDuration) || 6;
  const returnDate = body.returnDate || "";
  const airline = body.airline?.trim() || "";
  const flightNumber = body.flightNumber?.trim() || "";
  const firstCommitment = body.firstCommitment ?? {};

  if (!origin || !destination || !departureDate) {
    return NextResponse.json({ error: "origin, destination, and departureDate are required" }, { status: 400 });
  }

  const originTz = resolveCityTimeZone(origin) ?? "UTC";
  const destTz = resolveCityTimeZone(destination) ?? "UTC";

  const pivot = new Date(`${departureDate}T12:00:00.000Z`);
  const offsetHours =
    (getTimezoneOffset(originTz, pivot) - getTimezoneOffset(destTz, pivot)) / 3_600_000;

  const travelDirection =
    offsetHours > 0 ? "eastward" : offsetHours < 0 ? "westward" : "minimal_shift";

  const user = await getUserById(auth.userId);
  const userTz = user?.currentTimezone || user?.homeTimezone || "UTC";
  const snapshots = await getSnapshotsAsc(auth.userId, 30, userTz);
  const travelReadiness = computeTravelReadiness(snapshots);
  const chronotype = detectChronotype(snapshots);
  const hrv7 = hrv7DayAverage(snapshots);
  const readinessToday = currentReadiness(snapshots);
  const { avgBedtime, avgWake, avgSleepHours } = avgBedtimeWakeMinutes(snapshots);

  const landingDateDest = landingDateKeyInDestination(
    departureDate,
    departureTime,
    flightDuration,
    originTz,
    destTz,
  );

  const commitmentLine =
    firstCommitment?.date && firstCommitment?.time
      ? `First high-stakes commitment at destination: ${firstCommitment.date} ${firstCommitment.time} (${firstCommitment.type || "other"}). The entire protocol must work backwards from this event — cite it in executiveSummary, in-flight narrative, and daily warnings.`
      : "No specific commitment time provided; still anchor advice to typical business peak cognitive hours after landing.";

  const userMetrics = `OURA BASELINE (real numbers — every recommendation must reference these):
- Travel readiness score (server): ${travelReadiness.score}/100 (${travelReadiness.band}). Interpretation: ${travelReadiness.interpretation}
- Today's readiness (latest night): ${readinessToday ?? "unknown"}
- 7-day average HRV: ${hrv7 ?? "unknown"} ms
- Chronotype from 14-night average wake (bedtime_end): ${chronotype}
- Average bedtime (14d): ${avgBedtime}; average wake (14d): ${avgWake}
- Average sleep duration (14d): ${avgSleepHours != null ? `${avgSleepHours.toFixed(2)} h` : "unknown"}
- Timezone shift: ${offsetHours.toFixed(1)} h (${travelDirection} — offset > 0 means eastward for this engine)
- Origin TZ: ${originTz}; Destination TZ: ${destTz}
- Landing local date at destination: ${landingDateDest}
${commitmentLine}`;

  const jsonShape = `Return ONLY valid JSON (no markdown fences) with this exact top-level shape and populated strings/arrays:
{
  "executiveSummary": "2-4 sentences referencing the user's readiness number, HRV average, chronotype, and commitment if any",
  "performanceFraming": "1 paragraph working backwards from the commitment or peak cognitive need",
  "directionScience": { "direction": "${travelDirection}", "bullets": ["3-5 bullets: light, melatonin rule, first nights, plane sleep rule for this direction"] },
  "chronotypeAdvice": "2-4 sentences for ${chronotype} + ${travelDirection}",
  "sleepBanking": {
    "narrative": "cite their avg sleep hours vs target 8.5h banking",
    "targetSleepHours": 8.5,
    "hoursToBankTotal": number,
    "dailyChecklist": [{"dayLabel":"string","targetHours":8.5,"tip":"string"}]
  },
  "preDepartureDays": [
    {"dayLabel":"3 Days Before Departure","date":"optional","bedtime":"HH:MM with shift note","wake":"HH:MM","brightLight":"exact timing","avoidBrightLight":"exact timing","melatonin":"dose + time or none","exercise":"morning vs evening per direction","caffeineCutoff":"HH:MM"}
  ],
  "preDeparture": [{"day":-3,"advice":"string","sleepTarget":"string"}],
  "flightPlan": {
    "timesSummary": {"departOriginLocal":"string","landDestLocal":"string","destTimeAtBoarding":"string","destTimeAtLanding":"string"},
    "sleepWindows": [{"start":"HH:MM","end":"HH:MM","timezone":"origin|dest","note":"string"}],
    "awakeWindows": [{"start":"HH:MM","end":"HH:MM","note":"string"}],
    "melatoninOnFlight": "exact instruction with times",
    "mealStrategy": "eat vs fast with rationale",
    "hydrationMlPerHour": 200,
    "seatAndGear": ["window seat","compression socks","mask timing"],
    "screenPolicy": "when to avoid blue light"
  },
  "flightTimeline": {
    "segments": [{"startHourOfFlight":0,"endHourOfFlight":2,"phase":"awake|sleep|wind_down|caffeine|melatonin","label":"string","detail":"string"}],
    "narrative": "authoritative timing; mention alarms if sleep block"
  },
  "arrivalProtocol": {
    "hotelCheckIn": "string",
    "napRule": "only if offset >6h and max 20 min before 3pm local — else no nap",
    "firstMeal": "string",
    "brightLightWindow": "between X and Y local",
    "avoidList": ["blackout before local bedtime etc"],
    "exercise": "light walk only day 0"
  },
  "arrivalDay": {"immediateActions":"string","targetBedtime":"string","lightExposure":"string"},
  "dailyPlans": [
    {"dayNumber":1,"date":"string","targetSleep":"string","targetWake":"string","lightSeek":"string","lightAvoid":"string","exercise":"string","expectedReadiness":70,"expectedHrvPctOfBaseline":0.82,"expectedHRV":40,"notes":"string","highStakesWarning":"optional if commitment falls this day"}
  ],
  "predictedRecoveryCurve": [
    {"dayOffset":0,"expectedReadiness":62,"expectedHrvPctOfBaseline":0.88}
  ],
  "melatoninSchedule": [{"day":1,"time":"string","dose":"0.5mg typical"}],
  "caffeineStrategy": "paragraph for direction",
  "caffeineTimelineDays": [
    {"dayLabel":"Pre-trip -2","okWindows":["before 1pm origin"],"avoidWindows":["after 1pm origin"]}
  ]
}
Fill arrays for 3 preDepartureDays, 5 dailyPlans, predictedRecoveryCurve for dayOffset 0-7, caffeineTimelineDays for pre-trip + first 3 destination days + flight day as needed.`;

  const prompt = `You are a circadian performance physician for elite professionals. Tone: authoritative, specific, never vague. No "try to sleep if you can" — give exact windows and alarms where useful.

${userMetrics}

TRIP: ${origin} → ${destination}. Depart ${departureDate} ${departureTime} (${originTz}), ${flightDuration} h flight, airline ref: ${airline || "n/a"} ${flightNumber || ""}. Return: ${returnDate || "n/a"}.

${jsonShape}`;

  let raw: string;
  try {
    const res = await createClaudeMessage({
      system:
        "Reply with a single JSON object only. No markdown, no prose outside JSON. Numbers in dailyPlans.expectedReadiness must be integers 0-100. expectedHrvPctOfBaseline is 0-1 fraction of their baseline HRV from metrics.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 8192,
    });
    raw = res.content
      .map((chunk) => ("text" in chunk ? chunk.text : ""))
      .join("")
      .trim();
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let structured = extractJsonObject(raw);
  if (!structured) {
    structured = { raw, executiveSummary: raw.slice(0, 500) };
  }

  structured.serverMeta = {
    travelReadinessScore: travelReadiness.score,
    travelReadinessBand: travelReadiness.band,
    chronotype,
    travelDirection,
    baselineHrv7d: hrv7,
    readinessToday,
    avgSleepHours14d: avgSleepHours,
  };

  if (structured.sleepBanking && avgSleepHours != null) {
    structured.sleepBanking = {
      ...structured.sleepBanking,
      narrative: `${structured.sleepBanking.narrative} (Oura 14-night average in bed/sleep duration: ~${avgSleepHours.toFixed(2)} h.)`,
    };
  }

  const planMarkdown = structured.executiveSummary
    ? `# Trip plan\n\n${structured.executiveSummary}\n\n## Performance\n${structured.performanceFraming ?? ""}`
    : raw;

  const tripMeta = {
    origin,
    destination,
    departureDate,
    departureTime,
    flightDuration,
    returnDate,
    airline,
    flightNumber,
    firstCommitment,
    originTz,
    destTz,
    offsetHours,
    travelDirection,
    chronotype,
    travelReadinessScore: travelReadiness.score,
    travelReadinessBand: travelReadiness.band,
    landingDateDest,
    recoveryCheckIns: [] as Array<{ date: string; readiness?: number; hrv?: number; note?: string }>,
  };

  await db.insert(timezonePlans).values({
    userId: auth.userId,
    homeTz: originTz,
    currentTz: destTz,
    offsetHours,
    planMarkdown,
    tripMeta,
    structuredPlan: structured,
    lightExposureTimes: structured.dailyPlans ?? null,
  });

  return NextResponse.json({
    planMarkdown,
    structuredPlan: structured,
    tripMeta,
    offsetHours,
    travelReadiness,
  });
}

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const [row] = await db
    .select()
    .from(timezonePlans)
    .where(eq(timezonePlans.userId, auth.userId))
    .orderBy(desc(timezonePlans.generatedAt))
    .limit(1);
  return NextResponse.json(row ?? null);
}
