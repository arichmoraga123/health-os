"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import { AppShell } from "@/components/app-shell";
import { BarChart, LineChart } from "@/components/charts";
import { SleepStageBar } from "@/components/sleep-stage-bar";
import type { DailySnapshotRow } from "@/lib/health";
import { formatDurationSeconds, pickTodayRow, prevRow } from "@/lib/health";

const RANGES = [7, 14, 30] as const;

function toMinutes(sec: number | null | undefined): number | null {
  if (sec == null || !Number.isFinite(sec)) return null;
  return Math.round(sec / 60);
}

function formatBedWake(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): string {
  if (!start || !end) return "—";
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${s.toLocaleTimeString([], opts)} → ${e.toLocaleTimeString([], opts)}`;
}

function extractPhaseSeries(row: DailySnapshotRow | undefined): number[] {
  if (!row) return [];
  let raw: unknown = null;
  if (row.rawSleep && typeof row.rawSleep === "object" && !Array.isArray(row.rawSleep)) {
    raw = (row.rawSleep as Record<string, unknown>).sleep_phase_5_min;
  }
  if (raw == null) raw = row.sleepPhase5Min;
  if (typeof raw === "string") {
    return raw
      .split("")
      .map((c) => Number(c))
      .filter((n) => n >= 1 && n <= 4);
  }
  if (Array.isArray(raw)) {
    return raw
      .map((v) => (typeof v === "number" ? v : Number(v)))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 4);
  }
  return [];
}

function avgPct(
  rows: DailySnapshotRow[],
  pick: (r: DailySnapshotRow) => number | null | undefined,
): number | null {
  let part = 0;
  let total = 0;
  for (const r of rows) {
    const v = pick(r);
    const dur = r.sleepDuration ?? (r.deepSleep ?? 0) + (r.remSleep ?? 0) + (r.lightSleep ?? 0);
    if (v != null && dur > 0) {
      part += v;
      total += dur;
    }
  }
  if (total <= 0) return null;
  return Math.round((part / total) * 100);
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-4">
      <p className="label-caps">{label}</p>
      <p className="heading-font mt-2 text-3xl text-white md:text-4xl">{value}</p>
    </div>
  );
}

export function SleepPageClient({
  timeZone: initialTz,
  initialSnapshots,
}: {
  timeZone: string;
  initialSnapshots: DailySnapshotRow[];
}) {
  const [tz] = useState(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return initialTz === "UTC" && detected ? detected : initialTz;
  });
  const [range, setRange] = useState<(typeof RANGES)[number]>(7);
  const [snapshots, setSnapshots] = useState(initialSnapshots);

  const loadRange = useCallback(
    async (days: (typeof RANGES)[number]) => {
      const res = await fetch(
        `/api/health/snapshots?days=${days}&timeZone=${encodeURIComponent(tz)}&t=${Date.now()}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (res.ok && json.data) setSnapshots(json.data);
    },
    [tz],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch(
        `/api/health/snapshots?days=${range}&timeZone=${encodeURIComponent(tz)}&t=${Date.now()}`,
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!cancelled && res.ok && json.data) setSnapshots(json.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [range, tz]);

  const { row: todayRow } = pickTodayRow(snapshots, tz);
  const yesterday = todayRow ? prevRow(snapshots, todayRow.date) : undefined;
  const sleepRow = useMemo(() => {
    const hasSleep = (s: DailySnapshotRow | undefined) =>
      !!s && [s.deepSleep, s.remSleep, s.lightSleep, s.sleepDuration, s.sleepScore].some((v) => v != null && v > 0);
    if (hasSleep(todayRow)) return todayRow;
    if (hasSleep(yesterday)) return yesterday;
    return [...snapshots].reverse().find((s) => hasSleep(s));
  }, [todayRow, yesterday, snapshots]);

  const phaseSeries = useMemo(() => extractPhaseSeries(sleepRow), [sleepRow]);
  const last7 = snapshots.slice(-7);
  const trendLabels = snapshots.map((s) => String(s.date).slice(5));
  const deepAvg = avgPct(last7, (r) => r.deepSleep);
  const remAvg = avgPct(last7, (r) => r.remSleep);

  const deepMin = toMinutes(sleepRow?.deepSleep);
  const remMin = toMinutes(sleepRow?.remSleep);
  const lightMin = toMinutes(sleepRow?.lightSleep);
  const awakeMin = toMinutes(sleepRow?.awakeTime);
  const sleepBalance = sleepRow?.sleepBalance ?? todayRow?.sleepBalance;
  const previousNight = sleepRow?.previousNightScore ?? todayRow?.previousNightScore;

  return (
    <AppShell
      title="Sleep"
      headerExtra={
        <div className="flex flex-wrap gap-2">
          {RANGES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setRange(d);
                void loadRange(d);
              }}
              className={`btn ${range === d ? "btn-primary" : "btn-outline"} !px-4 !py-2 !text-[11px] uppercase tracking-wider`}
            >
              {d}D
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-6">
        <section className="panel overflow-hidden p-6 md:p-8" style={{ boxShadow: "var(--shadow-glow-sleep)" }}>
          <p className="label-caps mb-4">Last night</p>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p
                className="heading-font text-[clamp(5rem,18vw,9rem)] leading-none text-[var(--sleep)]"
                style={{ textShadow: "0 0 80px rgba(108, 99, 255, 0.35)" }}
              >
                {sleepRow?.sleepScore ?? "—"}
              </p>
              <p className="label-caps mt-2">Sleep score</p>
            </div>
            <div className="min-w-0 flex-1 space-y-3 lg:max-w-md lg:text-right">
              <p className="heading-font text-5xl text-white md:text-6xl">
                {formatDurationSeconds(sleepRow?.sleepDuration)}
              </p>
              <p className="text-[13px] text-[var(--text-secondary)]">
                {formatBedWake(sleepRow?.bedtimeStart, sleepRow?.bedtimeEnd)}
              </p>
              {sleepRow?.date && sleepRow.date !== todayRow?.date ? (
                <p className="text-[11px] text-[var(--text-muted)]">From {sleepRow.date}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricTile label="Deep" value={deepMin != null ? `${deepMin}m` : "—"} />
            <MetricTile label="REM" value={remMin != null ? `${remMin}m` : "—"} />
            <MetricTile label="Light" value={lightMin != null ? `${lightMin}m` : "—"} />
            <MetricTile label="Awake" value={awakeMin != null ? `${awakeMin}m` : "—"} />
            <MetricTile
              label="Efficiency"
              value={sleepRow?.efficiency != null ? `${sleepRow.efficiency}%` : "—"}
            />
            <MetricTile
              label="Latency"
              value={sleepRow?.latency != null ? `${Math.round(sleepRow.latency)}m` : "—"}
            />
            <MetricTile label="HRV" value={sleepRow?.hrv != null ? `${sleepRow.hrv}` : "—"} />
            <MetricTile
              label="Resting HR"
              value={
                sleepRow?.lowestHeartRate != null
                  ? `${sleepRow.lowestHeartRate}`
                  : sleepRow?.averageHeartRate != null
                    ? `${sleepRow.averageHeartRate}`
                    : "—"
              }
            />
            <MetricTile
              label="Breathing"
              value={
                sleepRow?.averageBreath != null
                  ? `${Number(sleepRow.averageBreath).toFixed(1)}`
                  : "—"
              }
            />
            <MetricTile
              label="Body temp Δ"
              value={
                sleepRow?.bodyTempDeviation != null
                  ? `${sleepRow.bodyTempDeviation > 0 ? "+" : ""}${Number(sleepRow.bodyTempDeviation).toFixed(2)}°`
                  : "—"
              }
            />
          </div>
        </section>

        <section className="panel p-6 md:p-8">
          <p className="label-caps mb-6">Sleep stages</p>
          <SleepStageBar
            deep={sleepRow?.deepSleep}
            rem={sleepRow?.remSleep}
            light={sleepRow?.lightSleep}
            size="lg"
            showExactMinutes
          />
        </section>

        {phaseSeries.length > 0 ? (
          <section className="panel p-6 md:p-8">
            <p className="label-caps mb-2">Hypnogram</p>
            <p className="mb-6 text-[12px] text-[var(--text-muted)]">
              5-min stages · 1 deep · 2 light · 3 REM · 4 awake
            </p>
            <div className="h-64 md:h-80">
              <Line
                data={{
                  labels: phaseSeries.map((_, i) => `${i * 5}m`),
                  datasets: [
                    {
                      label: "Stage",
                      data: phaseSeries,
                      borderColor: "#6c63ff",
                      backgroundColor: "rgba(108, 99, 255, 0.12)",
                      borderWidth: 2,
                      pointRadius: 0,
                      stepped: true,
                      fill: true,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => {
                          const map: Record<number, string> = {
                            1: "Deep",
                            2: "Light",
                            3: "REM",
                            4: "Awake",
                          };
                          const v = Number(ctx.raw);
                          return map[v] ?? String(v);
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      ticks: {
                        color: "#4a4a6a",
                        maxTicksLimit: 12,
                        font: { family: "IBM Plex Mono", size: 10 },
                      },
                      grid: { color: "rgba(255,255,255,0.06)" },
                    },
                    y: {
                      min: 0.5,
                      max: 4.5,
                      reverse: true,
                      ticks: {
                        color: "#a0a0b8",
                        stepSize: 1,
                        font: { family: "IBM Plex Mono", size: 11 },
                        callback: (v) => {
                          const map: Record<number, string> = {
                            1: "Deep",
                            2: "Light",
                            3: "REM",
                            4: "Awake",
                          };
                          return map[Number(v)] ?? "";
                        },
                      },
                      grid: { color: "rgba(255,255,255,0.06)" },
                    },
                  },
                }}
              />
            </div>
          </section>
        ) : null}

        <section className="space-y-4">
          <h2 className="heading-font px-1 text-3xl text-white">7-day trend</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="panel p-6 md:p-8">
              <p className="label-caps mb-4">Sleep score</p>
              <LineChart
                data={{
                  labels: trendLabels,
                  datasets: [
                    {
                      label: "Sleep",
                      data: snapshots.map((s) => s.sleepScore),
                      borderColor: "#6c63ff",
                      tension: 0.3,
                      fill: false,
                    },
                  ],
                }}
              />
            </div>
            <div className="panel p-6 md:p-8">
              <p className="label-caps mb-4">HRV</p>
              <LineChart
                data={{
                  labels: trendLabels,
                  datasets: [
                    {
                      label: "HRV",
                      data: snapshots.map((s) => s.hrv),
                      borderColor: "#ff3d7f",
                      tension: 0.3,
                      fill: false,
                    },
                  ],
                }}
              />
            </div>
          </div>
          <div className="panel p-6 md:p-8">
            <p className="label-caps mb-4">Sleep duration (hours)</p>
            <BarChart
              data={{
                labels: trendLabels,
                datasets: [
                  {
                    label: "Hours",
                    data: snapshots.map((s) =>
                      s.sleepDuration != null ? Math.round((s.sleepDuration / 3600) * 10) / 10 : null,
                    ),
                    backgroundColor: "#6c63ff",
                  },
                ],
              }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="panel p-6 md:p-8">
              <p className="label-caps">Avg deep sleep (7d)</p>
              <p className="heading-font mt-3 text-6xl text-[var(--sleep)]">
                {deepAvg != null ? `${deepAvg}%` : "—"}
              </p>
            </div>
            <div className="panel p-6 md:p-8">
              <p className="label-caps">Avg REM (7d)</p>
              <p className="heading-font mt-3 text-6xl text-[#a89fff]">
                {remAvg != null ? `${remAvg}%` : "—"}
              </p>
            </div>
          </div>
        </section>

        <section className="panel p-6 md:p-8">
          <p className="label-caps mb-6">Sleep contributors</p>
          <div className="space-y-6">
            {(
              [
                ["Sleep balance", sleepBalance, "var(--sleep)"],
                ["Previous night", previousNight, "#8b7fff"],
              ] as const
            ).map(([label, score, color]) => {
              const v = score ?? 0;
              return (
                <div key={label}>
                  <div className="mb-2 flex items-end justify-between gap-3">
                    <p className="label-caps">{label}</p>
                    <p className="heading-font text-4xl text-white">{score ?? "—"}</p>
                  </div>
                  <div className="h-4 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, v))}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
