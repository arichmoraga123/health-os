import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { getSnapshotsAsc, getUserById } from "@/lib/health";

const COLS = [
  "date",
  "sleep_score",
  "readiness_score",
  "activity_score",
  "hrv",
  "sleep_duration_sec",
  "deep_sleep_sec",
  "rem_sleep_sec",
  "light_sleep_sec",
  "efficiency",
  "steps",
  "active_calories",
  "total_calories",
  "walking_distance_m",
  "body_temp_deviation",
] as const;

function escapeCsv(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const u = new URL(request.url);
  const daysRaw = u.searchParams.get("days");
  const days = daysRaw === "30" ? 30 : 7;

  const user = await getUserById(auth.userId);
  const tz = user?.homeTimezone || user?.currentTimezone || "UTC";

  const rows = await getSnapshotsAsc(auth.userId, days, tz);
  const lines = [COLS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        escapeCsv(String(r.date)),
        escapeCsv(r.sleepScore),
        escapeCsv(r.readinessScore),
        escapeCsv(r.activityScore),
        escapeCsv(r.hrv),
        escapeCsv(r.sleepDuration),
        escapeCsv(r.deepSleep),
        escapeCsv(r.remSleep),
        escapeCsv(r.lightSleep),
        escapeCsv(r.efficiency),
        escapeCsv(r.steps),
        escapeCsv(r.activeCalories),
        escapeCsv(r.totalCalories),
        escapeCsv(r.walkingDistance),
        escapeCsv(r.bodyTempDeviation),
      ].join(","),
    );
  }

  const csv = lines.join("\n");
  const filename = `health-os-${days}d-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
