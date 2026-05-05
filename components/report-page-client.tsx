"use client";

import { useEffect, useState } from "react";

type Snapshot = {
  date: string;
  sleepScore: number | null;
  readinessScore: number | null;
  activityScore: number | null;
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

  if (loading) {
    return <p className="mt-2 text-[13px] text-[var(--text-secondary)]">Loading...</p>;
  }
  if (error) {
    return <p className="mt-2 text-[13px] text-[var(--warn)]">Failed to load report: {error}</p>;
  }
  return (
    <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
      Loaded {rows.length} days of data.
    </p>
  );
}
