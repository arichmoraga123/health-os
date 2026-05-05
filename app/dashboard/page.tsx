import { LineChart, BarChart } from "@/components/charts";
import { getSnapshots, getTodayBrief } from "@/lib/health";
import { requireSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await requireSession();
  const snapshots = await getSnapshots(session.user!.id, 30);
  const brief = await getTodayBrief(session.user!.id);
  const today = snapshots[snapshots.length - 1];
  const warning = (today.hrv ?? 0) < 45 || (today.readinessScore ?? 0) < 65;

  const labels = snapshots.map((s: any) => s.date.slice(5));
  return (
    <>
      <section className="grid md:grid-cols-4 gap-3">
        {[
          ["Sleep", today.sleepScore, "var(--sleep)"],
          ["Readiness", today.readinessScore, "var(--ready)"],
          ["Activity", today.activityScore, "var(--active)"],
          ["HRV", today.hrv, "var(--body-color)"],
        ].map(([label, value, color]) => (
          <div key={label as string} className="panel p-4">
            <div className="text-xs text-[var(--muted2)]">{label as string}</div>
            <div className="heading-font text-6xl leading-none" style={{ color: color as string }}>
              {value as number}
            </div>
          </div>
        ))}
      </section>
      <section className={`panel p-4 mt-4 ${warning ? "border-[var(--warn)]" : ""}`}>
        {warning
          ? "Warning: recovery is constrained. Keep training low intensity, prioritize 90-minute wind-down."
          : "Cleared: recovery metrics look stable. Good day for focused work and moderate training."}
      </section>
      <section className="panel p-4 mt-4">
        <h2 className="heading-font text-3xl">Today&apos;s AI Brief</h2>
        <p className="text-sm text-[var(--muted2)] mt-2">{brief.briefMarkdown}</p>
      </section>
      <section className="grid md:grid-cols-2 gap-4 mt-4">
        <div className="panel p-4">
          <h3 className="heading-font text-2xl mb-2">Sleep Trend</h3>
          <LineChart
            data={{
              labels,
              datasets: [{ label: "Sleep", data: snapshots.map((s: any) => s.sleepScore), borderColor: "#6c63ff" }],
            }}
          />
        </div>
        <div className="panel p-4">
          <h3 className="heading-font text-2xl mb-2">Readiness Contributors</h3>
          <BarChart
            data={{
              labels: ["HRV", "Sleep", "Activity", "Temp"],
              datasets: [
                {
                  label: "Contributor",
                  data: [today.hrv, today.sleepScore, today.activityScore, 100 - Math.abs(today.bodyTempDeviation || 0) * 40],
                  backgroundColor: ["#ff3d7f", "#6c63ff", "#ff6b35", "#00e5b0"],
                },
              ],
            }}
          />
        </div>
      </section>
    </>
  );
}
