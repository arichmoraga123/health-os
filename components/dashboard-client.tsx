"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BarChart, LineChart } from "@/components/charts";
import { DailyBriefCard } from "@/components/daily-brief-card";
import { DashboardScoreCard } from "@/components/dashboard-score-card";
import { SleepStageBar } from "@/components/sleep-stage-bar";
import { dateKeyInTimeZone } from "@/lib/dates";
import type { DailySnapshotRow } from "@/lib/health";
import { formatBedtimeRange, pickTodayRow, prevRow } from "@/lib/health";
import { ErrorBoundary } from "@/components/error-boundary";

const RANGES = [7, 14, 30, 90] as const;

function formatSecs(sec: number | null | undefined) {
  if (sec == null) return "—";
  const mins = Math.round(sec / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function DashboardClient({
  timeZone: initialTz,
  initialSnapshots,
  initialBrief,
}: {
  timeZone: string;
  initialSnapshots: DailySnapshotRow[];
  initialBrief: Record<string, unknown>;
}) {
  const [tz] = useState(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return initialTz === "UTC" && detected ? detected : initialTz;
  });
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("healthos_last_sync") : null,
  );
  const [toast, setToast] = useState<string | null>(null);

  const loadRange = useCallback(
    async (days: (typeof RANGES)[number]) => {
      const res = await fetch(`/api/health/snapshots?days=${days}&timeZone=${encodeURIComponent(tz)}`);
      const json = await res.json();
      if (res.ok && json.data) setSnapshots(json.data);
    },
    [tz],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/health/snapshots?days=${range}&timeZone=${encodeURIComponent(tz)}`);
      const json = await res.json();
      if (!cancelled && res.ok && json.data) setSnapshots(json.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [range, tz]);

  const todayKey = useMemo(() => dateKeyInTimeZone(new Date(), tz), [tz]);
  const { row: todayRow, isFallback } = pickTodayRow(snapshots, tz);
  const yesterday = todayRow ? prevRow(snapshots, todayRow.date) : undefined;

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetch("/api/oura/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 7, timeZone: tz }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Sync failed");
      }
      const data = await res.json();
      await loadRange(range);
      const ts = new Date().toISOString();
      localStorage.setItem("healthos_last_sync", ts);
      setLastSync(ts);
      setToast(data.message ?? "Sync complete");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      console.error(msg);
      setToast(msg);
    } finally {
      setSyncing(false);
      setTimeout(() => setToast(null), 2800);
    }
  }

  const labels = snapshots.map((s) => s.date.slice(5));
  const phaseSeries = Array.isArray(todayRow?.sleepPhase5Min)
    ? (todayRow?.sleepPhase5Min as unknown[])
        .map((v) => (typeof v === "number" ? v : Number(v)))
        .filter((v) => Number.isFinite(v))
    : [];
  const hrvNightSeries = Array.isArray(todayRow?.hrv5Min)
    ? (todayRow?.hrv5Min as unknown[])
        .map((v) => (typeof v === "number" ? v : Number(v)))
        .filter((v) => Number.isFinite(v))
    : [];
  const readiness = todayRow?.readinessScore ?? 0;
  let recoveryMsg = "🔴 Recovery — Take it easy";
  if (readiness > 85) recoveryMsg = "🟢 Peak Performance — Push hard today";
  else if (readiness >= 70) recoveryMsg = "🟡 Good — Normal training";

  const hrvLow = (todayRow?.hrv ?? 0) < 45;
  const readinessLow = (todayRow?.readinessScore ?? 0) < 65;

  const briefProps = {
    briefMarkdown: initialBrief.briefMarkdown as string | undefined,
    keyInsight: initialBrief.keyInsight as string | undefined,
    actionItems: initialBrief.actionItems as string[] | undefined,
    moodPrompt: initialBrief.moodPrompt as string | undefined,
  };

  const syncLabel = lastSync
    ? `Last sync ${new Date(lastSync).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : "Not synced yet";

  return (
    <AppShell
      title="Dashboard"
      headerExtra={
        <>
          <div className="flex flex-wrap gap-2">
            {RANGES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setRange(d)}
                className={`btn ${range === d ? "btn-primary" : "btn-outline"} !px-4 !py-2 !text-[11px] uppercase tracking-wider`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing}
            className="btn btn-primary !px-5 !py-2 !text-[12px] uppercase tracking-wide disabled:opacity-50"
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
          <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/[0.04] px-3 py-2 text-[11px] text-[var(--text-secondary)]">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--ready)] opacity-40" />
              <span className="relative inline-flex size-2 rounded-full bg-[var(--ready)]" />
            </span>
            {syncLabel}
          </div>
        </>
      }
    >
      {snapshots.length === 0 && (
        <section className="panel p-6 text-[13px] text-[var(--text-secondary)]">
          No Oura data yet. Click <span className="text-white">Sync now</span> to import your latest metrics.
        </section>
      )}
      {toast && (
        <div className="mb-4 panel p-3 text-[12px] text-white">{toast}</div>
      )}
      {isFallback && todayRow ? (
        <p className="mb-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-white/[0.03] px-4 py-3 text-[12px] text-[var(--text-secondary)]">
          Today&apos;s ring data isn&apos;t available yet — showing <span className="text-white">{todayRow.date}</span>{" "}
          until your Oura syncs.
        </p>
      ) : null}

      <ErrorBoundary>
        <div className="space-y-6">
          <DailyBriefCard dateKey={todayKey} initial={briefProps} />

          <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-gradient-to-r from-[var(--ready)]/15 to-transparent px-6 py-4 text-[14px] text-white">
            {recoveryMsg}
          </section>

          {(hrvLow || readinessLow) && (
            <section className="panel border-[var(--warn)]/40 bg-[var(--warn)]/5 p-5 text-[13px] text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--warn)]">Alert: </span>
              {hrvLow ? "HRV is below your target band — prioritize sleep and reduce training load. " : null}
              {readinessLow ? "Readiness is under 65 — schedule easy movement and extra recovery." : null}
            </section>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardScoreCard
              label="Sleep"
              value={todayRow?.sleepScore}
              colorVar="var(--sleep)"
              trendKey="sleep"
              prev={yesterday?.sleepScore}
              cur={todayRow?.sleepScore}
            />
            <DashboardScoreCard
              label="Readiness"
              value={todayRow?.readinessScore}
              colorVar="var(--ready)"
              trendKey="ready"
              prev={yesterday?.readinessScore}
              cur={todayRow?.readinessScore}
            />
            <DashboardScoreCard
              label="Activity"
              value={todayRow?.activityScore}
              colorVar="var(--active)"
              trendKey="active"
              prev={yesterday?.activityScore}
              cur={todayRow?.activityScore}
            />
            <DashboardScoreCard
              label="HRV"
              value={todayRow?.hrv}
              colorVar="var(--hrv)"
              trendKey="hrv"
              prev={yesterday?.hrv}
              cur={todayRow?.hrv}
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="panel p-6 md:p-8">
              <p className="label-caps mb-4">Sleep stages</p>
              <SleepStageBar deep={todayRow?.deepSleep} rem={todayRow?.remSleep} light={todayRow?.lightSleep} />
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Efficiency", todayRow?.efficiency != null ? `${todayRow.efficiency}%` : "—"],
                  ["Latency", todayRow?.latency != null ? `${Math.round(todayRow.latency / 60)}m` : "—"],
                  ["Restfulness", todayRow?.restfulness ?? "—"],
                  ["Timing", todayRow?.timing ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-3">
                    <p className="label-caps">{k}</p>
                    <p className="mt-1 text-lg text-white">{v}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel p-6 md:p-8">
              <p className="label-caps mb-4">Sleep trend</p>
              <LineChart
                data={{
                  labels,
                  datasets: [{ label: "Sleep", data: snapshots.map((s) => s.sleepScore), borderColor: "#6c63ff", tension: 0.3 }],
                }}
              />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className="panel p-6 md:p-8">
              <p className="label-caps mb-2">Bedtime / Wake</p>
              <p className="text-[13px] text-[var(--text-secondary)]">
                {formatBedtimeRange(todayRow?.bedtimeStart, todayRow?.bedtimeEnd)}
              </p>
            </div>
            <div className="panel p-6 md:p-8">
              <p className="label-caps mb-2">Time in bed vs asleep</p>
              <p className="text-[13px] text-[var(--text-secondary)]">
                {formatSecs(todayRow?.timeInBed)} / {formatSecs(todayRow?.sleepDuration)}
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">Awake: {formatSecs(todayRow?.awakeTime)}</p>
            </div>
            <div className="panel p-6 md:p-8">
              <p className="label-caps mb-2">Body metrics</p>
              <p className="text-[13px] text-[var(--text-secondary)]">
                SpO₂ avg/min: {todayRow?.avgSpo2 ?? "—"} / {todayRow?.minSpo2 ?? "—"}
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                HR avg/max/min: {todayRow?.averageHeartRate ?? "—"} / {todayRow?.maxHeartRate ?? "—"} / {todayRow?.lowestHeartRate ?? "—"}
              </p>
              {todayRow?.avgSpo2 != null && todayRow.avgSpo2 < 95 ? (
                <p className="mt-2 text-[12px] text-[var(--warn)]">Warning: SpO₂ below 95%</p>
              ) : null}
            </div>
          </section>

          {(phaseSeries.length > 0 || hrvNightSeries.length > 0) && (
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="panel p-6 md:p-8">
                <p className="label-caps mb-4">Sleep hypnogram (5-min)</p>
                {phaseSeries.length > 0 ? (
                  <LineChart
                    data={{
                      labels: phaseSeries.map((_, i) => `${i * 5}m`),
                      datasets: [{ label: "Stage", data: phaseSeries, borderColor: "#6c63ff", tension: 0.2 }],
                    }}
                  />
                ) : (
                  <p className="text-[12px] text-[var(--text-muted)]">No detailed stage data yet.</p>
                )}
              </div>
              <div className="panel p-6 md:p-8">
                <p className="label-caps mb-4">HRV through night (5-min)</p>
                {hrvNightSeries.length > 0 ? (
                  <LineChart
                    data={{
                      labels: hrvNightSeries.map((_, i) => `${i * 5}m`),
                      datasets: [{ label: "HRV", data: hrvNightSeries, borderColor: "#ff3d7f", tension: 0.2 }],
                    }}
                  />
                ) : (
                  <p className="text-[12px] text-[var(--text-muted)]">No overnight HRV detail yet.</p>
                )}
              </div>
            </section>
          )}

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="panel p-6 md:p-8">
              <p className="label-caps mb-4">HRV trend (7d window)</p>
              <LineChart
                data={{
                  labels: labels.slice(-7),
                  datasets: [
                    {
                      label: "HRV",
                      data: snapshots.slice(-7).map((s) => s.hrv),
                      borderColor: "#ff3d7f",
                      tension: 0.3,
                    },
                  ],
                }}
              />
            </div>
            <div className="panel p-6 md:p-8">
              <p className="label-caps mb-4">Contributors</p>
              <BarChart
                data={{
                  labels: ["HRV", "Sleep score", "Activity", "Temp Δ"],
                  datasets: [
                    {
                      label: "Score",
                      data: [
                        todayRow?.hrv ?? 0,
                        todayRow?.sleepScore ?? 0,
                        todayRow?.activityScore ?? 0,
                        todayRow?.bodyTempDeviation != null
                          ? Math.max(0, 100 - Math.abs(todayRow.bodyTempDeviation) * 120)
                          : 50,
                      ],
                      backgroundColor: ["#ff3d7f", "#6c63ff", "#ff6b35", "#00e5b0"],
                    },
                  ],
                }}
              />
              <p className="mt-3 text-[12px] text-[var(--text-muted)]">
                Body temp deviation: {todayRow?.bodyTempDeviation ?? "—"}
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                Stress high/recovery: {todayRow?.stressHigh ?? "—"}m / {todayRow?.recoveryHigh ?? "—"}m ·{" "}
                {todayRow?.stressSummary ?? "—"}
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                Resilience: {todayRow?.resilienceLevel ?? "—"} (sleep {todayRow?.resilienceSleepRecovery ?? "—"}, day{" "}
                {todayRow?.resilienceDaytimeRecovery ?? "—"}, balance {todayRow?.resilienceStressBalance ?? "—"})
              </p>
              <div className="mt-3 space-y-1 text-[11px] text-[var(--text-muted)]">
                <div>Readiness contributors:</div>
                <div>
                  HRV balance {todayRow?.hrvBalance ?? "—"} · Recovery index {todayRow?.recoveryIndex ?? "—"} · RHR{" "}
                  {todayRow?.restingHeartRateScore ?? "—"} · Temp {todayRow?.bodyTemperatureScore ?? "—"}
                </div>
                <div>
                  Activity balance {todayRow?.activityBalance ?? "—"} · Sleep balance {todayRow?.sleepBalance ?? "—"} · Prev day{" "}
                  {todayRow?.previousDayActivity ?? "—"} · Prev night {todayRow?.previousNightScore ?? "—"}
                </div>
                <div>
                  Activity contributors: stay active {todayRow?.stayActiveScore ?? "—"} · move hourly{" "}
                  {todayRow?.moveEveryHourScore ?? "—"} · targets {todayRow?.meetDailyTargetsScore ?? "—"} · freq{" "}
                  {todayRow?.trainingFrequencyScore ?? "—"} · volume {todayRow?.trainingVolumeScore ?? "—"} · recovery{" "}
                  {todayRow?.recoveryTimeScore ?? "—"}
                </div>
              </div>
            </div>
          </section>
        </div>
      </ErrorBoundary>
    </AppShell>
  );
}
