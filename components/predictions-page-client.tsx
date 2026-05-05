"use client";

import { useEffect, useMemo, useState } from "react";

type Snapshot = {
  hrv: number | null;
  sleepScore: number | null;
  readinessScore: number | null;
  activityScore?: number | null;
};

const FIVE_SECONDS = 5000;

export function PredictionsPageClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Snapshot[]>([]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FIVE_SECONDS);

    void (async () => {
      try {
        const res = await fetch("/api/health/snapshots?days=7", { signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(String(data.error ?? `HTTP ${res.status}`));
        if (!alive) return;
        setRows(Array.isArray(data.data) ? (data.data as Snapshot[]) : []);
      } catch (e) {
        if (!alive) return;
        const message =
          e instanceof Error && e.name === "AbortError"
            ? "Predictions load timed out after 5 seconds."
            : e instanceof Error
              ? e.message
              : "Predictions load failed.";
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

  const score = useMemo(() => {
    const last3 = rows.slice(-3);
    if (!last3.length) return null;
    const total = last3.reduce(
      (sum, s) => sum + (s.hrv ?? 0) * 0.4 + (s.sleepScore ?? 0) * 0.3 + (s.readinessScore ?? 0) * 0.3,
      0,
    );
    return Math.round(total / last3.length);
  }, [rows]);

  if (loading) {
    return <p className="mt-2 text-[13px] text-[var(--text-secondary)]">Loading...</p>;
  }
  if (error) {
    return <p className="mt-2 text-[13px] text-[var(--warn)]">Failed to load predictions: {error}</p>;
  }
  const forecast = Array.from({ length: 7 }).map((_, i) =>
    score == null ? null : Math.max(45, Math.min(96, score + ((i % 3) - 1) * 3)),
  );
  return (
    <div className="mt-4 space-y-4">
      <section className="panel p-5 bg-gradient-to-r from-[var(--ready)]/20 to-[var(--sleep)]/10">
        <p className="label-caps">Tomorrow Readiness</p>
        <p className="heading-font text-7xl text-[var(--ready)]">{score ?? "—"}</p>
        <p className="text-[13px] text-[var(--text-secondary)]">
          {score == null ? "Insufficient data" : score >= 75 ? "High output day" : "Prioritize recovery"}
        </p>
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        <div className="panel p-4"><p className="label-caps">Training Window</p><p className="text-white mt-2">{score != null && score > 75 ? "08:30 - 11:30" : "09:30 - 11:00"}</p></div>
        <div className="panel p-4"><p className="label-caps">Deep Work</p><p className="text-white mt-2">{score != null && score > 72 ? "09:30 - 13:30" : "10:30 - 12:30"}</p></div>
        <div className="panel p-4"><p className="label-caps">Optimal Bedtime</p><p className="text-white mt-2">{score != null && score > 75 ? "22:00" : "21:30"}</p></div>
      </section>
      <section className="panel p-5">
        <p className="label-caps mb-3">7-Day Forecast</p>
        <div className="grid grid-cols-7 gap-2">
          {forecast.map((v, i) => (
            <div key={i} className="rounded-lg border border-[var(--border)] p-2 text-center">
              <p className="text-[10px] text-[var(--text-muted)]">D{i + 1}</p>
              <p className="heading-font text-3xl text-white">{v ?? "—"}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
