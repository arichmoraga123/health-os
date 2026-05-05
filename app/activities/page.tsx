export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { HorizontalBarChart } from "@/components/charts";
import { activityEmoji, intensityBadgeClass, workoutDurationMinutes } from "@/lib/activity-icons";
import { dateKeyInTimeZone } from "@/lib/dates";
import { getSnapshotsAsc, getUserById } from "@/lib/health";
import { loadWorkouts } from "@/lib/oura-workouts";
import { requireSession } from "@/lib/session";

function activityStreak(rows: { activityScore: number | null }[]) {
  let c = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if ((rows[i].activityScore ?? 0) > 70) c++;
    else break;
  }
  return c;
}

export default async function ActivitiesPage() {
  const session = await requireSession();
  const user = await getUserById(session.user!.id);
  const tz = user?.currentTimezone || user?.homeTimezone || "UTC";
  const snapshots = await getSnapshotsAsc(session.user!.id, 14, tz);
  const { data: workouts } = await loadWorkouts(user?.ouraToken, tz, 14);

  const thisWeek = snapshots.slice(-7);
  const lastWeek = snapshots.slice(0, 7);
  const thisWeekDays = new Set(thisWeek.map((s) => s.date));
  const lastWeekDays = new Set(lastWeek.map((s) => s.date));
  const thisWeekWorkouts = workouts.filter((w) => {
    if (!w.start_datetime) return false;
    const key = dateKeyInTimeZone(new Date(w.start_datetime), tz);
    return thisWeekDays.has(key);
  });
  const prevWeekWorkouts = workouts.filter((w) => {
    if (!w.start_datetime) return false;
    const key = dateKeyInTimeZone(new Date(w.start_datetime), tz);
    return lastWeekDays.has(key);
  });
  const totalMinutes =
    thisWeekWorkouts.length > 0
      ? thisWeekWorkouts.reduce((a, w) => a + workoutDurationMinutes(w.start_datetime, w.end_datetime), 0)
      : thisWeek.reduce((a, s) => a + (s.highActivityTime ? s.highActivityTime / 60 : (s.activityScore ?? 0) * 1.2), 0);
  const lastMinutes =
    prevWeekWorkouts.length > 0
      ? prevWeekWorkouts.reduce((a, w) => a + workoutDurationMinutes(w.start_datetime, w.end_datetime), 0)
      : lastWeek.reduce((a, s) => a + (s.highActivityTime ? s.highActivityTime / 60 : (s.activityScore ?? 0) * 1.2), 0);
  const streak = activityStreak(snapshots);
  const caloriesWeek = thisWeek.reduce((a, s) => a + (s.activeCalories ?? 0), 0);
  const caloriesLast = lastWeek.reduce((a, s) => a + (s.activeCalories ?? 0), 0);
  const fmt = (n: number | null | undefined, digits = 1) => (n == null ? "—" : Number(n).toFixed(digits).replace(/\.0$/, ""));

  const typeCount = new Map<string, number>();
  for (const w of workouts) {
    const k = w.activity || "other";
    typeCount.set(k, (typeCount.get(k) ?? 0) + 1);
  }
  const types = [...typeCount.entries()].sort((a, b) => b[1] - a[1]);
  const chartData =
    types.length > 0
      ? {
          labels: types.map(([k]) => k),
          datasets: [
            {
              label: "Sessions",
              data: types.map(([, v]) => v),
              backgroundColor: types.map((_, i) => ["#ff6b35", "#6c63ff", "#00e5b0", "#ff3d7f", "#a0a0b8"][i % 5]),
            },
          ],
        }
      : {
          labels: ["—"],
          datasets: [{ label: "Sessions", data: [0], backgroundColor: ["#4a4a6a"] }],
        };

  return (
    <AppShell title="Activities">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-6 md:p-8">
          <p className="label-caps">Workouts (7d)</p>
          <p className="heading-font mt-2 text-6xl text-white">{thisWeekWorkouts.length}</p>
        </div>
        <div className="panel p-6 md:p-8">
          <p className="label-caps">Active minutes</p>
          <p className="heading-font mt-2 text-6xl text-white">{Math.round(totalMinutes)}</p>
        </div>
        <div className="panel p-6 md:p-8">
          <p className="label-caps">Calories (7d)</p>
          <p className="heading-font mt-2 text-6xl text-[var(--active)]">{Math.round(caloriesWeek)}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="panel p-6 md:p-8">
          <h3 className="heading-font text-3xl text-white">This week vs last</h3>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-4">
              <p className="label-caps">This week</p>
              <p className="mt-2 text-2xl text-white">{Math.round(totalMinutes)} min</p>
              <p className="text-[12px] text-[var(--text-muted)]">{Math.round(caloriesWeek)} cal</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-4">
              <p className="label-caps">Last week</p>
              <p className="mt-2 text-2xl text-[var(--text-secondary)]">{Math.round(lastMinutes)} min</p>
              <p className="text-[12px] text-[var(--text-muted)]">{Math.round(caloriesLast)} cal</p>
            </div>
          </div>
        </div>
        <div className="panel p-6 md:p-8">
          <h3 className="heading-font text-3xl text-white">Streak</h3>
          <p className="mt-4 text-4xl">
            🔥 <span className="heading-font text-white">{streak}</span>
            <span className="ml-2 text-[14px] text-[var(--text-secondary)]">days over 70 activity</span>
          </p>
        </div>
      </section>

      <section className="mt-6 panel p-6 md:p-8">
        <h3 className="heading-font text-3xl text-white">Session mix</h3>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">Horizontal bars by workout type</p>
        <div className="mt-6 h-64">
          <HorizontalBarChart data={chartData} />
        </div>
      </section>

      <section className="mt-6 space-y-4">
        <h3 className="heading-font text-3xl text-white px-1">Sessions</h3>
        {workouts.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">No workouts in range — sync Oura or try a longer window.</p>
        ) : (
          workouts.map((w, i) => {
            const mins = workoutDurationMinutes(w.start_datetime, w.end_datetime);
            const badge = intensityBadgeClass(w.intensity);
            return (
              <div key={i} className="panel flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{activityEmoji(w.activity)}</span>
                  <div>
                    <p className="text-lg font-semibold capitalize text-white">{w.activity}</p>
                    <p className="text-[12px] text-[var(--text-muted)]">
                      {w.start_datetime
                        ? new Date(w.start_datetime).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }).replace(",", " ·")
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-[12px] text-[var(--text-secondary)]">
                  <span className="rounded-lg border border-[var(--border)] px-3 py-1">{mins} min</span>
                  <span className="rounded-lg border border-[var(--border)] px-3 py-1">
                    {w.average_heart_rate == null ? <span className="text-[var(--text-muted)]">—</span> : `Avg HR ${Math.round(w.average_heart_rate)}`}
                  </span>
                  <span className="rounded-lg border border-[var(--border)] px-3 py-1">
                    {w.max_heart_rate == null ? <span className="text-[var(--text-muted)]">—</span> : `Max ${Math.round(w.max_heart_rate)}`}
                  </span>
                  <span className="rounded-lg border border-[var(--border)] px-3 py-1">
                    {w.calories == null ? <span className="text-[var(--text-muted)]">—</span> : `${Math.round(w.calories)} cal`}
                  </span>
                  <span className="rounded-lg border border-[var(--border)] px-3 py-1">{fmt(w.distance)} km</span>
                  <span className={`rounded-lg border px-3 py-1 capitalize ${badge}`}>{w.intensity}</span>
                </div>
              </div>
            );
          })
        )}
      </section>
    </AppShell>
  );
}
