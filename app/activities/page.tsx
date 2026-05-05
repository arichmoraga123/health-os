import { AppShell } from "@/components/app-shell";
import { DoughnutChart } from "@/components/charts";
import { getSnapshots } from "@/lib/health";
import { requireSession } from "@/lib/session";

export default async function ActivitiesPage() {
  const session = await requireSession();
  const snapshots = await getSnapshots(session.user!.id, 14);
  const thisWeek = snapshots.slice(-7);
  const lastWeek = snapshots.slice(0, 7);
  const weekMinutes = Math.round(thisWeek.reduce((a: number, s: any) => a + (s.activityScore ?? 0), 0) * 1.2);
  const lastWeekMinutes = Math.round(lastWeek.reduce((a: number, s: any) => a + (s.activityScore ?? 0), 0) * 1.2);
  const streak = [...snapshots].reverse().findIndex((s: any) => (s.activityScore ?? 0) <= 70);

  return (
    <AppShell title="Activities">
      <section className="grid md:grid-cols-3 gap-4">
        <div className="panel p-4">Active minutes: {weekMinutes}</div>
        <div className="panel p-4">Workout count: {thisWeek.filter((s: any) => s.activityScore > 72).length}</div>
        <div className="panel p-4">Calories burned: {thisWeek.reduce((a: number, s: any) => a + (s.activeCalories ?? 0), 0)}</div>
      </section>
      <section className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="panel p-4">
          <h3 className="heading-font text-2xl mb-2">Activity Type Distribution</h3>
          <DoughnutChart
            data={{
              labels: ["Cardio", "Strength", "Mobility"],
              datasets: [{ data: [48, 34, 18], backgroundColor: ["#ff6b35", "#6c63ff", "#00e5b0"] }],
            }}
          />
        </div>
        <div className="panel p-4 space-y-2">
          <div>Streak: {streak === -1 ? snapshots.length : streak} days over activity 70</div>
          <div>This week: {weekMinutes} min</div>
          <div>Last week: {lastWeekMinutes} min</div>
          <div>{weekMinutes >= lastWeekMinutes ? "Up" : "Down"} vs last week</div>
        </div>
      </section>
    </AppShell>
  );
}
