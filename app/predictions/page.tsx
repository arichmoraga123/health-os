import { AppShell } from "@/components/app-shell";
import { getSnapshots } from "@/lib/health";
import { askClaude } from "@/lib/ai";
import { requireSession } from "@/lib/session";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function PredictionsPage() {
  try {
    const session = await requireSession();
    const snapshots = await getSnapshots(session.user!.id, 7);
    const last3 = snapshots.slice(-3);
    const score = Math.round(
      last3.reduce((sum: number, s: any) => sum + (s.hrv ?? 0) * 0.4 + (s.sleepScore ?? 0) * 0.3 + (s.readinessScore ?? 0) * 0.3, 0) /
        (last3.length || 1),
    );
    const forecast = Array.from({ length: 7 }).map((_, i) => Math.max(45, Math.min(96, score + ((i % 3) - 1) * 3)));
    const sleepPrediction = Math.max(40, Math.min(95, Math.round(score * 0.7 + (last3.at(-1)?.sleepScore ?? 70) * 0.3)));
    const stressTrend = Math.round((last3.reduce((a: number, s: any) => a + (s.stressHigh ?? 0), 0) / Math.max(1, last3.length)) / 60);
    const acuteLoad = Math.round(last3.reduce((a: number, s: any) => a + (s.activityScore ?? 0), 0) / Math.max(1, last3.length));
    const chronicLoad = Math.round(snapshots.reduce((a: number, s: any) => a + (s.activityScore ?? 0), 0) / Math.max(1, snapshots.length));
    const loadRatio = Number((acuteLoad / Math.max(1, chronicLoad)).toFixed(2));
    const aiAdvice = await askClaude(
      `Generate concise life optimization advice for this week from: ${JSON.stringify(
        snapshots,
      )}. Include workouts, meetings, rest windows, and nutrition timing in under 120 words.`,
    ).catch(() => "AI life optimization unavailable.");

    return (
      <AppShell title="Predictions">
        <ErrorBoundary>
      <section className="panel p-5">
        <div className="text-sm text-[var(--muted2)]">Tomorrow readiness prediction</div>
        <div className="heading-font text-8xl text-[var(--ready)]">{score}</div>
        <p>{score > 75 ? "High output day. Schedule hard training before noon." : "Keep intensity moderate and prioritize recovery."}</p>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
          Sleep quality prediction: {sleepPrediction} · Energy: {score >= 78 ? "High" : score >= 65 ? "Medium" : "Low"} · Cognitive performance:{" "}
          {score >= 80 ? "Peak" : "Steady"}
        </p>
      </section>
      <section className="grid md:grid-cols-3 gap-3 mt-4">
        <div className="panel p-3">Training Window: {score > 75 ? "08:30 - 11:30 (Hard)" : "09:30 - 11:00 (Moderate)"}</div>
        <div className="panel p-3">Deep Work: {score > 72 ? "09:30 - 13:30" : "10:30 - 12:30"}</div>
        <div className="panel p-3">Optimal Bedtime: {score > 75 ? "22:00" : "21:30"} · Wake {score > 75 ? "06:30" : "07:00"}</div>
      </section>
      <section className="grid md:grid-cols-2 gap-3 mt-4">
        <div className="panel p-4">
          <h3 className="heading-font text-3xl">Training Load Analysis</h3>
          <p>Acute load: {acuteLoad} · Chronic load: {chronicLoad} · Ratio: {loadRatio}</p>
          <p>Recommended intensity: {loadRatio > 1.25 ? "easy/rest" : loadRatio < 0.8 ? "moderate/hard" : "moderate"}</p>
          <p>Recovery debt: {Math.max(0, Math.round((loadRatio - 1) * 3))} days</p>
        </div>
        <div className="panel p-4">
          <h3 className="heading-font text-3xl">Stress & Resilience Forecast</h3>
          <p>Current resilience: {last3.at(-1)?.resilienceLevel ?? "—"}</p>
          <p>Stress load trend: {stressTrend} min high stress/day</p>
          <p>Projected next week resilience: {stressTrend < 60 ? "stable to improving" : "at risk if unchanged"}</p>
        </div>
      </section>
      <section className="panel p-4 mt-4">
        <div className="grid grid-cols-7 gap-2">
          {forecast.map((v, i) => (
            <div key={i} className="panel p-2 text-center">
              <div className="text-xs text-[var(--muted2)]">D{i + 1}</div>
              <div className="heading-font text-3xl">{v}</div>
              <div className="text-[10px] text-[var(--text-muted)]">Sleep {Math.max(45, Math.min(95, v - 2))}</div>
              <div className="text-[10px] text-[var(--text-muted)]">{v < 68 ? "Recovery day" : "Trainable"}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel p-4 mt-4">
        <h3 className="heading-font text-3xl">Life Optimization Panel</h3>
        <p className="text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap">{aiAdvice}</p>
      </section>
        </ErrorBoundary>
      </AppShell>
    );
  } catch (error) {
    console.error("Predictions page load error:", error);
    return (
      <AppShell title="Predictions">
        <section className="panel p-6 text-[13px] text-[var(--warn)]">Predictions failed to load. Check server logs for details.</section>
      </AppShell>
    );
  }
}
