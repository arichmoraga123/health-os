import { desc, eq } from "drizzle-orm";
import { getTimezoneOffset } from "date-fns-tz";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { timezonePlans } from "@/db/schema";
import { askClaude } from "@/lib/ai";
import { requireApiUser } from "@/lib/api-auth";
import { resolveCityTimeZone } from "@/lib/city-tz";

type StructuredPlan = {
  flightPlan: {
    sleepWindows: Array<{ start: string; end: string; timezone: "origin" | "dest"; note: string }>;
    awakeWindows: Array<{ start: string; end: string; note: string }>;
    melatoninOnFlight: string;
    mealStrategy: string;
  };
  preDeparture: Array<{ day: -3 | -2 | -1; advice: string; sleepTarget: string }>;
  arrivalDay: { immediateActions: string; targetBedtime: string; lightExposure: string };
  dailyPlans: Array<{
    dayNumber: number;
    date: string;
    targetSleep: string;
    targetWake: string;
    lightSeek: string;
    lightAvoid: string;
    exercise: string;
    expectedReadiness: number;
    expectedHRV: number;
    notes: string;
  }>;
  melatoninSchedule: Array<{ day: number; time: string; dose: string }>;
  caffeineStrategy: string;
};

function parsePlanJson(text: string): StructuredPlan | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as StructuredPlan;
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

  if (!origin || !destination || !departureDate) {
    return NextResponse.json({ error: "origin, destination, and departureDate are required" }, { status: 400 });
  }

  const originTz = resolveCityTimeZone(origin) ?? "UTC";
  const destTz = resolveCityTimeZone(destination) ?? "UTC";

  const pivot = new Date(`${departureDate}T12:00:00.000Z`);
  const offsetHours =
    (getTimezoneOffset(originTz, pivot) - getTimezoneOffset(destTz, pivot)) / 3_600_000;

  const prompt = `Generate a comprehensive jet lag plan with these exact sections:
1) FLIGHT PLAN with exact SLEEP and AWAKE windows on the flight (origin + destination time references), melatonin on flight, meal timing, eye mask/earplugs guidance.
2) PRE-DEPARTURE for day -3/-2/-1
3) ARRIVAL DAY immediate actions and target bedtime
4) DAYS 1-5 POST ARRIVAL with target sleep/wake, light windows, exercise, expected readiness and HRV
5) RETURN TRIP notes (if return date exists)

Return ONLY valid JSON with exactly this shape:
{
  "flightPlan": {
    "sleepWindows": [{"start":"HH:MM","end":"HH:MM","timezone":"origin|dest","note":"string"}],
    "awakeWindows": [{"start":"HH:MM","end":"HH:MM","note":"string"}],
    "melatoninOnFlight": "string",
    "mealStrategy": "string"
  },
  "preDeparture": [{"day":-3,"advice":"string","sleepTarget":"string"}],
  "arrivalDay": {"immediateActions":"string","targetBedtime":"string","lightExposure":"string"},
  "dailyPlans": [{
    "dayNumber":1,"date":"string","targetSleep":"string","targetWake":"string","lightSeek":"string","lightAvoid":"string","exercise":"string","expectedReadiness":70,"expectedHRV":40,"notes":"string"
  }],
  "melatoninSchedule": [{"day":1,"time":"string","dose":"string"}],
  "caffeineStrategy": "string"
}
Trip facts: depart ${departureDate} ${departureTime}, ${flightDuration}h flight, origin ${origin} (${originTz}), destination ${destination} (${destTz}), return ${returnDate || "n/a"}, offset ${offsetHours.toFixed(1)}h.`;

  let raw: string;
  try {
    raw = await askClaude(prompt);
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const structured = parsePlanJson(raw);
  const planMarkdown = structured
    ? `# Trip plan\n\n## In-flight\n${structured.flightPlan.melatoninOnFlight}\n\n## Arrival day\n${structured.arrivalDay.immediateActions}\n\n## Daily\n${structured.dailyPlans.map((d) => `Day ${d.dayNumber}: ${d.notes}`).join("\n")}`
    : raw;

  const tripMeta = {
    origin,
    destination,
    departureDate,
    departureTime,
    flightDuration,
    returnDate,
    originTz,
    destTz,
    offsetHours,
  };

  await db.insert(timezonePlans).values({
    userId: auth.userId,
    homeTz: originTz,
    currentTz: destTz,
    offsetHours,
    planMarkdown,
    tripMeta,
    structuredPlan: structured ?? { raw },
    lightExposureTimes: structured?.dailyPlans ?? null,
  });

  return NextResponse.json({
    planMarkdown,
    structuredPlan: structured ?? { raw },
    tripMeta,
    offsetHours,
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
