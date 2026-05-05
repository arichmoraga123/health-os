import { AppShell } from "@/components/app-shell";
import { getSnapshots } from "@/lib/health";
import { requireSession } from "@/lib/session";

export default async function PredictionsPage() {
  const session = await requireSession();
  const snapshots = await getSnapshots(session.user!.id, 7);
  const last3 = snapshots.slice(-3);
  const score = Math.round(
    last3.reduce((sum: number, s: any) => sum + (s.hrv ?? 0) * 0.4 + (s.sleepScore ?? 0) * 0.3 + (s.readinessScore ?? 0) * 0.3, 0) /
      (last3.length || 1),
  );
  const forecast = Array.from({ length: 7 }).map((_, i) => Math.max(45, Math.min(96, score + ((i % 3) - 1) * 3)));

  return (
    <AppShell title="Predictions">
      <section className="panel p-5">
        <div className="text-sm text-[var(--muted2)]">Tomorrow readiness prediction</div>
        <div className="heading-font text-8xl text-[var(--ready)]">{score}</div>
        <p>{score > 75 ? "High output day. Schedule hard training before noon." : "Keep intensity moderate and prioritize recovery."}</p>
      </section>
      <section className="grid md:grid-cols-3 gap-3 mt-4">
        <div className="panel p-3">Training Window: 09:00 - 12:00</div>
        <div className="panel p-3">Deep Work: 10:00 - 14:00</div>
        <div className="panel p-3">Optimal Bedtime: 22:15</div>
      </section>
      <section className="panel p-4 mt-4">
        <div className="grid grid-cols-7 gap-2">
          {forecast.map((v, i) => (
            <div key={i} className="panel p-2 text-center">
              <div className="text-xs text-[var(--muted2)]">D{i + 1}</div>
              <div className="heading-font text-3xl">{v}</div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
