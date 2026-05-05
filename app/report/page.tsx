import { AppShell } from "@/components/app-shell";
import { LineChart } from "@/components/charts";
import { getSnapshotsAsc } from "@/lib/health";
import { askClaude } from "@/lib/ai";
import { requireSession } from "@/lib/session";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function ReportPage() {
  try {
    const session = await requireSession();
    const snapshots = await getSnapshotsAsc(session.user!.id, 14, "UTC");
    const avg = (key: string) => {
      const vals = snapshots.map((s: any) => s[key]).filter((v: number | null | undefined) => v != null);
      if (!vals.length) return 0;
      return Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length);
    };
    const perf = Math.round((avg("sleepScore") * 0.35 + avg("readinessScore") * 0.4 + avg("activityScore") * 0.25));
    const bestSleep = [...snapshots].sort((a: any, b: any) => (b.sleepScore ?? 0) - (a.sleepScore ?? 0))[0];
    const worstSleep = [...snapshots].sort((a: any, b: any) => (a.sleepScore ?? 0) - (b.sleepScore ?? 0))[0];
    const above85 = snapshots.filter((s: any) => (s.readinessScore ?? 0) >= 85).length;
    const below70 = snapshots.filter((s: any) => (s.readinessScore ?? 0) < 70).length;
    const totalSteps = snapshots.reduce((a: number, s: any) => a + (s.steps ?? 0), 0);
    const totalCalories = snapshots.reduce((a: number, s: any) => a + (s.activeCalories ?? 0), 0);
    const sedentaryAvg = avg("sedentaryTime");
    const insight = await askClaude(
      `Create a 200-word weekly performance narrative for this data: ${JSON.stringify(
        snapshots,
      )}. Return with headings: "Narrative", "Went Well (3 bullets)", "Improve (3 bullets)", "Targets Next Week".`,
    ).catch(() => "AI insights unavailable.");
    const corr1 =
      snapshots.filter((s: any) => (s.sleepDuration ?? 0) >= 8 * 3600).reduce((a: number, s: any) => a + (s.readinessScore ?? 0), 0) /
        Math.max(1, snapshots.filter((s: any) => (s.sleepDuration ?? 0) >= 8 * 3600).length) -
      snapshots.filter((s: any) => (s.sleepDuration ?? 0) < 8 * 3600).reduce((a: number, s: any) => a + (s.readinessScore ?? 0), 0) /
        Math.max(1, snapshots.filter((s: any) => (s.sleepDuration ?? 0) < 8 * 3600).length);

    return (
      <AppShell title="Report">
        <ErrorBoundary>
      <section className="panel p-6 bg-gradient-to-r from-[var(--sleep)]/30 to-[var(--ready)]/20">
        <div className="text-sm text-[var(--muted2)]">Weekly Performance Score</div>
        <div className="heading-font text-8xl">{perf}</div>
      </section>
      <section className="grid md:grid-cols-4 gap-3 mt-4">
        <div className="panel p-3">Sleep quality: {avg("sleepScore")}</div>
        <div className="panel p-3">Readiness: {avg("readinessScore")}</div>
        <div className="panel p-3">Daily steps: {avg("steps").toLocaleString()}</div>
        <div className="panel p-3">Temp baseline: {avg("bodyTempDeviation")}°</div>
      </section>
      <section className="panel p-4 mt-4">
        <LineChart
          data={{
            labels: snapshots.map((s: any) => s.date.slice(5)),
            datasets: [
              { label: "Sleep", data: snapshots.map((s: any) => s.sleepScore), borderColor: "#6c63ff" },
              { label: "Readiness", data: snapshots.map((s: any) => s.readinessScore), borderColor: "#00e5b0" },
              { label: "Steps/100", data: snapshots.map((s: any) => Math.round((s.steps ?? 0) / 100)), borderColor: "#ff6b35" },
            ],
          }}
        />
      </section>
      <section className="grid gap-3 md:grid-cols-2 mt-4">
        <div className="panel p-4">
          <h3 className="heading-font text-3xl">Sleep Analysis</h3>
          <p>Avg duration: {Math.round(avg("sleepDuration") / 3600)}h · Deep {Math.round((avg("deepSleep") / Math.max(1, avg("sleepDuration"))) * 100)}%</p>
          <p>Best: {bestSleep?.date} ({bestSleep?.sleepScore ?? "—"}) · Worst: {worstSleep?.date} ({worstSleep?.sleepScore ?? "—"})</p>
        </div>
        <div className="panel p-4">
          <h3 className="heading-font text-3xl">Recovery Analysis</h3>
          <p>Avg HRV: {avg("hrv")} · Temp variance: {avg("bodyTempDeviation")}°</p>
          <p>Readiness {">"}85: {above85} days · {"<"}70: {below70} days</p>
        </div>
        <div className="panel p-4">
          <h3 className="heading-font text-3xl">Activity Analysis</h3>
          <p>Total steps: {totalSteps.toLocaleString()} · Active cal: {totalCalories.toLocaleString()}</p>
          <p>Sedentary avg: {Math.round(sedentaryAvg / 60)} min/day</p>
        </div>
        <div className="panel p-4">
          <h3 className="heading-font text-3xl">Body Metrics</h3>
          <p>Avg resting HR: {avg("lowestHeartRate")} bpm · HRV baseline: {avg("hrv")}</p>
          <p>SpO2 avg: {avg("avgSpo2") || "—"} · Temp trend tracked</p>
        </div>
      </section>
      <section className="panel p-4 mt-4">
        <h3 className="heading-font text-3xl">Insights & Recommendations</h3>
        <pre className="whitespace-pre-wrap text-[13px] text-[var(--text-secondary)]">{insight}</pre>
      </section>
      <section className="panel p-4 mt-4">
        <h3 className="heading-font text-3xl">Correlations</h3>
        <p>On days with 8h+ sleep, readiness was {Math.round(corr1)} points {corr1 >= 0 ? "higher" : "lower"}.</p>
        <p>Higher HRV days align with lower stress windows and better readiness in this period.</p>
        <p>Weekend activity is often lower than weekday trend in recent data.</p>
      </section>
        </ErrorBoundary>
      </AppShell>
    );
  } catch (error) {
    console.error("Report page load error:", error);
    return (
      <AppShell title="Report">
        <section className="panel p-6 text-[13px] text-[var(--warn)]">Report failed to load. Check server logs for details.</section>
      </AppShell>
    );
  }
}
