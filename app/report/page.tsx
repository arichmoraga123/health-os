import { AppShell } from "@/components/app-shell";
import { LineChart } from "@/components/charts";
import { getSnapshots } from "@/lib/health";
import { requireSession } from "@/lib/session";

export default async function ReportPage() {
  const session = await requireSession();
  const snapshots = await getSnapshots(session.user!.id, 7);
  const avg = (key: string) =>
    Math.round(snapshots.reduce((a: number, s: any) => a + (s[key] ?? 0), 0) / snapshots.length);
  const perf = Math.round((avg("sleepScore") * 0.35 + avg("readinessScore") * 0.4 + avg("activityScore") * 0.25));

  return (
    <AppShell title="Report">
      <section className="panel p-6 bg-gradient-to-r from-[var(--sleep)]/30 to-[var(--ready)]/20">
        <div className="text-sm text-[var(--muted2)]">Weekly Performance Score</div>
        <div className="heading-font text-8xl">{perf}</div>
      </section>
      <section className="grid md:grid-cols-4 gap-3 mt-4">
        <div className="panel p-3">Sleep quality: {avg("sleepScore")}</div>
        <div className="panel p-3">Readiness: {avg("readinessScore")}</div>
        <div className="panel p-3">Daily steps: {avg("steps")}</div>
        <div className="panel p-3">Temp baseline: {avg("bodyTempDeviation")}</div>
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
    </AppShell>
  );
}
