import { desc, eq } from "drizzle-orm";
import { getTimezoneOffset } from "date-fns-tz";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { timezonePlans } from "@/db/schema";
import { askClaude } from "@/lib/ai";
import { requireApiUser } from "@/lib/api-auth";
import { resolveCityTimeZone } from "@/lib/city-tz";

type StructuredPlan = {
  direction: string;
  preflight_advice: string;
  inflight_schedule: Array<{ label: string; start: string; end: string; action: string }>;
  daily_plans: Array<{ day: number; title: string; body: string; expected_hrv: string; expected_readiness: string }>;
  light_schedule: Array<{ time: string; instruction: string; code: string }>;
  melatonin_schedule: Array<{ time: string; dose: string; note: string }>;
  exercise_timing: string;
  meal_timing: string;
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

  const prompt = `You are a circadian medicine specialist. Create a jet lag combat plan as ONLY valid JSON (no markdown fences) with this exact shape:
{
  "direction": "eastward or westward and why",
  "preflight_advice": "string, 2-3 days before departure",
  "inflight_schedule": [{"label":"string","start":"HH:mm","end":"HH:mm","action":"sleep|awake|light|caffeine"}],
  "daily_plans": [{"day":1,"title":"string","body":"string","expected_hrv":"string","expected_readiness":"string"}],
  "light_schedule": [{"time":"string","instruction":"string","code":"sleep|light|avoid|caffeine"}],
  "melatonin_schedule": [{"time":"string","dose":"string","note":"string"}],
  "exercise_timing": "string",
  "meal_timing": "string"
}
Trip facts: origin city="${origin}" (IANA ${originTz}), destination="${destination}" (IANA ${destTz}), departure local date ${departureDate} time ${departureTime}, flight hours ${flightDuration}, return ${returnDate || "n/a"}.
Approx clock offset origin vs destination at departure day: ${offsetHours.toFixed(1)} hours (destination minus origin).
Include melatonin only as general timing guidance, not medical prescription. Be specific with times relative to destination timezone after landing.`;

  let raw: string;
  try {
    raw = await askClaude(prompt);
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const structured = parsePlanJson(raw);
  const planMarkdown = structured
    ? `# Trip plan\n\n${structured.preflight_advice}\n\n${structured.daily_plans.map((d) => `## Day ${d.day}: ${d.title}\n${d.body}`).join("\n\n")}`
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
    lightExposureTimes: structured?.light_schedule ?? null,
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
