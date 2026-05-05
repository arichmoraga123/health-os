"use client";

import { useEffect, useState } from "react";

type Snapshot = {
  date: string;
  sleepScore: number | null;
  readinessScore: number | null;
  activityScore: number | null;
  steps?: number | null;
  hrv?: number | null;
};

const FIVE_SECONDS = 5000;

export function ReportPageClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Snapshot[]>([]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FIVE_SECONDS);

    void (async () => {
      try {
        const res = await fetch("/api/health/snapshots?days=14", { signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(data.error ?? `HTTP ${res.status}`));
        if (!alive) return;
        setRows(Array.isArray(data.data) ? (data.data as Snapshot[]) : []);
      } catch (e) {
        if (!alive) return;
        const message =
          e instanceof Error && e.name === "AbortError"
            ? "Report load timed out after 5 seconds."
            : e instanceof Error
              ? e.message
              : "Report load failed.";
        setError(message);
      } finally {
        if (!alive) return;
        setLoading(false);
        clearTimeout(timeout);
      }
    })();

    return () => {
      alive = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  const avg = (vals: Array<number | null | undefined>) => {
    const present = vals.filter((v): v is number => v != null);
    if (!present.length) return "—";
    return Math.round(present.reduce((a, b) => a + b, 0) / present.length);
  };

  if (loading) {
    return <p className="mt-2 text-[13px] text-[var(--text-secondary)]">Loading...</p>;
  }
  if (error) {
    return <p className="mt-2 text-[13px] text-[var(--warn)]">Failed to load report: {error}</p>;
  }
  return (
    <div className="mt-4 space-y-4">
      <section className="panel p-5 bg-gradient-to-r from-[var(--sleep)]/20 to-[var(--ready)]/10">
        <p className="label-caps">Performance Score</p>
        <p className="heading-font text-7xl text-white">
          {avg(rows.map((r) => r.sleepScore))}
        </p>
      </section>
      <section className="grid gap-3 md:grid-cols-4">
        <div className="panel p-4"><p className="label-caps">Sleep Avg</p><p className="heading-font text-4xl text-[var(--sleep)]">{avg(rows.map((r) => r.sleepScore))}</p></div>
        <div className="panel p-4"><p className="label-caps">Readiness Avg</p><p className="heading-font text-4xl text-[var(--ready)]">{avg(rows.map((r) => r.readinessScore))}</p></div>
        <div className="panel p-4"><p className="label-caps">Activity Avg</p><p className="heading-font text-4xl text-[var(--active)]">{avg(rows.map((r) => r.activityScore))}</p></div>
        <div className="panel p-4"><p className="label-caps">HRV Avg</p><p className="heading-font text-4xl text-[var(--hrv)]">{avg(rows.map((r) => r.hrv))}</p></div>
      </section>
      <section className="panel p-5">
        <p className="label-caps mb-3">Recent trend</p>
        <div className="space-y-2">
          {rows.slice(-7).map((r) => (
            <div key={r.date} className="grid grid-cols-[88px_1fr_40px] items-center gap-2 text-[12px]">
              <span className="text-[var(--text-muted)]">{r.date.slice(5)}</span>
              <div className="h-2 rounded bg-white/10">
                <div className="h-2 rounded bg-[var(--sleep)]" style={{ width: `${Math.max(0, Math.min(100, r.sleepScore ?? 0))}%` }} />
              </div>
              <span className="text-white">{r.sleepScore ?? "—"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
