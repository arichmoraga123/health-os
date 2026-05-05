"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BarChart, LineChart } from "@/components/charts";
import { DailyBriefCard } from "@/components/daily-brief-card";
import { DashboardScoreCard } from "@/components/dashboard-score-card";
import { SleepStageBar } from "@/components/sleep-stage-bar";
import { dateKeyInTimeZone } from "@/lib/dates";
import type { DailySnapshotRow } from "@/lib/health";
import { pickTodayRow, prevRow } from "@/lib/health";
import { ErrorBoundary } from "@/components/error-boundary";

const RANGES = [7, 14, 30, 90] as const;

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
      await loadRange(range);
      const ts = new Date().toISOString();
      localStorage.setItem("healthos_last_sync", ts);
      setLastSync(ts);
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  }

  const labels = snapshots.map((s) => s.date.slice(5));
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
                className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                  range === d
                    ? "bg-white text-black"
                    : "border border-[var(--border)] bg-white/[0.04] text-[var(--text-secondary)] hover:text-white"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={syncNow}
            disabled={syncing}
            className="rounded-full bg-[var(--ready)] px-5 py-2 text-[12px] font-bold uppercase tracking-wide text-black hover:opacity-90 disabled:opacity-50"
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
                  ["Latency", todayRow?.latency != null ? `${todayRow.latency}s` : "—"],
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
            </div>
          </section>
        </div>
      </ErrorBoundary>
    </AppShell>
  );
}
