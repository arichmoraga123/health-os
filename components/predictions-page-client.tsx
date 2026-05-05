"use client";

import { useEffect, useMemo, useState } from "react";

type Snapshot = {
  hrv: number | null;
  sleepScore: number | null;
  readinessScore: number | null;
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
  return (
    <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
      Loaded {rows.length} days. Tomorrow readiness estimate: {score ?? "—"}.
    </p>
  );
}
