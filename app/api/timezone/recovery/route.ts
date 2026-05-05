import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { timezonePlans } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { dateKeyInTimeZone } from "@/lib/dates";
import { landingDateKeyInDestination } from "@/lib/trip-dates";
import { getSnapshotsAsc, getUserById } from "@/lib/health";
import type { Phase5StructuredPlan } from "@/lib/trip-plan-types";

function calendarDaysBetween(earlierYmd: string, laterYmd: string): number {
  const a = new Date(`${earlierYmd}T12:00:00.000Z`).getTime();
  const b = new Date(`${laterYmd}T12:00:00.000Z`).getTime();
  return Math.round((b - a) / 86_400_000);
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

  if (!row?.tripMeta || !row.structuredPlan) {
    return NextResponse.json({ active: false, reason: "no_plan" });
  }

  const meta = row.tripMeta as Record<string, unknown>;
  const origin = String(meta.origin ?? "");
  const destination = String(meta.destination ?? "");
  const departureDate = String(meta.departureDate ?? "");
  const departureTime = String(meta.departureTime ?? "09:00");
  const flightDuration = Number(meta.flightDuration) || 0;
  const originTz = String(meta.originTz ?? "UTC");
  const destTz = String(meta.destTz ?? "UTC");
  const landingKeyMeta = meta.landingDateDest as string | undefined;

  const landingKey =
    landingKeyMeta ||
    (departureDate && flightDuration
      ? landingDateKeyInDestination(departureDate, departureTime, flightDuration, originTz, destTz)
      : "");

  if (!landingKey) {
    return NextResponse.json({ active: false, reason: "incomplete_meta" });
  }

  const user = await getUserById(auth.userId);
  const userTz = user?.currentTimezone || user?.homeTimezone || "UTC";
  const todayDest = dateKeyInTimeZone(new Date(), destTz);
  const daysSinceLanding = calendarDaysBetween(landingKey, todayDest);

  const userToday = dateKeyInTimeZone(new Date(), userTz);
  const snaps = await getSnapshotsAsc(auth.userId, 14, userTz);
  const todaySnap = snaps.find((s) => String(s.date) === userToday);

  const structured = row.structuredPlan as Phase5StructuredPlan;
  const curve = structured.predictedRecoveryCurve ?? [];
  let predictedReadiness: number | null = null;
  let predictedHrvPct: number | null = null;

  const fromCurve = curve.find((c) => c.dayOffset === daysSinceLanding);
  if (fromCurve) {
    predictedReadiness = fromCurve.expectedReadiness;
    predictedHrvPct = fromCurve.expectedHrvPctOfBaseline;
  } else if (daysSinceLanding >= 1 && structured.dailyPlans?.length) {
    const d = structured.dailyPlans.find((p) => p.dayNumber === Math.min(daysSinceLanding, 5));
    if (d) {
      predictedReadiness = d.expectedReadiness;
      predictedHrvPct =
        d.expectedHrvPctOfBaseline ??
        (d.expectedHRV != null && structured.serverMeta?.baselineHrv7d
          ? d.expectedHRV / structured.serverMeta.baselineHrv7d
          : null);
    }
  }

  const todayHrv = todaySnap?.hrv ?? null;
  const todayReadiness = todaySnap?.readinessScore ?? null;
  const baselineHrv = structured.serverMeta?.baselineHrv7d ?? null;

  let status: "on_track" | "behind" | "ahead" | "unknown" = "unknown";
  let message =
    daysSinceLanding < 0
      ? `Pre-arrival at ${destination || "destination"} — recovery tracking starts after landing (${landingKey} ${destTz}).`
      : `Recovery from ${destination || "trip"} — day ${daysSinceLanding} since landing.`;

  if (daysSinceLanding >= 0 && predictedHrvPct != null && baselineHrv && todayHrv != null) {
    const actualPct = todayHrv / baselineHrv;
    const delta = actualPct - predictedHrvPct;
    if (delta < -0.08) {
      status = "behind";
      message = `Your recovery is running behind the predicted curve (HRV ~${Math.round(actualPct * 100)}% of baseline vs ~${Math.round(predictedHrvPct * 100)}% expected). Add an extra easy day before high-intensity work or training.`;
    } else if (delta > 0.08) {
      status = "ahead";
      message = `Your body is ahead of the predicted adaptation (HRV ~${Math.round(actualPct * 100)}% of baseline vs ~${Math.round(predictedHrvPct * 100)}% expected). You can advance intensity if subjective energy matches.`;
    } else {
      status = "on_track";
      message = `Recovery on track at ${destination || "destination"} — today's HRV is close to the modeled curve for day ${daysSinceLanding}.`;
    }
  } else if (daysSinceLanding >= 0 && todayReadiness != null && predictedReadiness != null) {
    const deltaR = todayReadiness - predictedReadiness;
    if (deltaR < -8) {
      status = "behind";
      message = `Readiness (${todayReadiness}) is meaningfully below the modeled day ${daysSinceLanding} target (${predictedReadiness}). Prioritize sleep and light anchors tonight.`;
    } else if (deltaR > 8) {
      status = "ahead";
      message = `Readiness (${todayReadiness}) is above the modeled target (${predictedReadiness}) — adaptation may be faster than average.`;
    } else {
      status = "on_track";
      message = `Readiness (${todayReadiness}) aligns with the modeled recovery for day ${daysSinceLanding}.`;
    }
  }

  const active = daysSinceLanding >= 0 && daysSinceLanding <= 10;

  return NextResponse.json({
    active,
    phase: daysSinceLanding < 0 ? "pre_arrival" : daysSinceLanding <= 10 ? "recovery" : "complete",
    destination: destination || origin,
    destTz,
    landingDateDest: landingKey,
    daysSinceLanding,
    todayReadiness,
    todayHrv,
    predictedReadiness,
    predictedHrvPct,
    baselineHrv,
    status,
    message,
    checkIns: (meta.recoveryCheckIns as unknown[]) ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let body: { date?: string; readiness?: number; hrv?: number; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const user = await getUserById(auth.userId);
  const tz = user?.currentTimezone || user?.homeTimezone || "UTC";
  const date = body.date?.trim() || dateKeyInTimeZone(new Date(), tz);

  const [row] = await db
    .select()
    .from(timezonePlans)
    .where(eq(timezonePlans.userId, auth.userId))
    .orderBy(desc(timezonePlans.generatedAt))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "No trip plan found" }, { status: 404 });
  }

  const meta = { ...(typeof row.tripMeta === "object" && row.tripMeta ? row.tripMeta : {}) } as Record<
    string,
    unknown
  >;
  const prev = Array.isArray(meta.recoveryCheckIns) ? [...(meta.recoveryCheckIns as object[])] : [];
  prev.push({
    date,
    readiness: body.readiness,
    hrv: body.hrv,
    note: body.note,
    loggedAt: new Date().toISOString(),
  });
  meta.recoveryCheckIns = prev;

  await db
    .update(timezonePlans)
    .set({ tripMeta: meta })
    .where(eq(timezonePlans.id, row.id));

  return NextResponse.json({ ok: true, recoveryCheckIns: prev });
}
