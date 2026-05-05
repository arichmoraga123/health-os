import { rangeStartEnd } from "@/lib/dates";
import { ouraFetch } from "@/lib/oura";

export type NormalizedWorkout = {
  activity: string;
  start_datetime: string | null;
  end_datetime: string | null;
  calories: number | null;
  distance: number | null;
  average_heart_rate: number | null;
  max_heart_rate: number | null;
  intensity: string;
};

export async function loadWorkouts(
  token: string | null | undefined,
  timeZone: string,
  days: number,
): Promise<{ data: NormalizedWorkout[]; range: { start: string; end: string } }> {
  const { start, end } = rangeStartEnd(days, timeZone);
  if (!token) return { data: [], range: { start, end } };
  const res = await ouraFetch("v2/usercollection/workout", token, {
    start_date: start,
    end_date: end,
  });
  const raw = Array.isArray(res?.data) ? res.data : [];
  const data: NormalizedWorkout[] = raw.map((w: Record<string, unknown>) => ({
    activity: String(w.activity ?? "workout"),
    start_datetime: w.start_datetime ? String(w.start_datetime) : null,
    end_datetime: w.end_datetime ? String(w.end_datetime) : null,
    calories: typeof w.calories === "number" ? w.calories : null,
    distance: typeof w.distance === "number" ? w.distance : null,
    average_heart_rate: typeof w.average_heart_rate === "number" ? w.average_heart_rate : null,
    max_heart_rate: typeof w.max_heart_rate === "number" ? w.max_heart_rate : null,
    intensity: String(w.intensity ?? "moderate").toLowerCase(),
  }));
  return { data, range: { start, end } };
}
