import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { getSnapshotsAsc, getUserById } from "@/lib/health";
import {
  avgBedtimeWakeMinutes,
  computeTravelReadiness,
  currentReadiness,
  detectChronotype,
  hrv7DayAverage,
} from "@/lib/trip-metrics";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const user = await getUserById(auth.userId);
  const tz = user?.currentTimezone || user?.homeTimezone || "UTC";

  const chronological = await getSnapshotsAsc(auth.userId, 30, tz);
  const readiness = computeTravelReadiness(chronological);
  const chronotype = detectChronotype(chronological);
  const { avgBedtime, avgWake, avgSleepHours } = avgBedtimeWakeMinutes(chronological);
  const hrvAvg = hrv7DayAverage(chronological);
  const readinessToday = currentReadiness(chronological);

  return NextResponse.json({
    readinessToday,
    hrv7DayAverage: hrvAvg,
    chronotype,
    avgBedtime14d: avgBedtime,
    avgWake14d: avgWake,
    avgSleepHours14d: avgSleepHours,
    travelReadiness: readiness,
  });
}
