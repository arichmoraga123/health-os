"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type RecoveryPayload = {
  active: boolean;
  destination?: string;
  daysSinceLanding?: number;
  status?: string;
  message?: string;
  todayReadiness?: number | null;
  todayHrv?: number | null;
  predictedReadiness?: number | null;
  predictedHrvPct?: number | null;
  phase?: string;
};

function RingGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" opacity="0.35" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        d="M12 3.5 A8.5 8.5 0 0 1 19.2 8.2"
      />
    </svg>
  );
}

export function TripRecoveryWidget() {
  const [data, setData] = useState<RecoveryPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/timezone/recovery", { cache: "no-store" });
        const j = await res.json();
        if (!cancelled && res.ok) setData(j);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data?.active) return null;

  return (
    <div className="panel relative overflow-hidden p-5 md:p-6">
      <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-[var(--ready)]/10 blur-2xl" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-caps flex items-center gap-2 text-[var(--text-muted)]">
            <RingGlyph className="text-[var(--ready)]" />
            Recovery from {data.destination ?? "trip"}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-secondary)]">{data.message}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--text-muted)]">
            {data.todayReadiness != null ? (
              <span>
                Readiness today: <span className="text-white">{data.todayReadiness}</span>
              </span>
            ) : null}
            {data.todayHrv != null ? (
              <span>
                HRV: <span className="text-white">{data.todayHrv}</span>
              </span>
            ) : null}
            {data.predictedReadiness != null ? (
              <span>
                Model day {data.daysSinceLanding ?? "—"} readiness:{" "}
                <span className="text-white">{data.predictedReadiness}</span>
              </span>
            ) : null}
          </div>
        </div>
        <Link href="/timezone" className="btn btn-outline shrink-0 !px-3 !py-2 !text-[11px]">
          Trip plan
        </Link>
      </div>
    </div>
  );
}
