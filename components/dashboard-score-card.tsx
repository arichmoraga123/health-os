"use client";

import { cn } from "@/lib/utils";

const GLOW: Record<string, string> = {
  sleep: "score-glow-sleep",
  ready: "score-glow-ready",
  active: "score-glow-active",
  hrv: "score-glow-hrv",
};

export function DashboardScoreCard({
  label,
  value,
  colorVar,
  trendKey,
  prev,
  cur,
}: {
  label: string;
  value: number | null | undefined;
  colorVar: string;
  trendKey: keyof typeof GLOW;
  prev?: number | null;
  cur?: number | null;
}) {
  const v = value ?? 0;
  const delta = prev != null && cur != null ? cur - prev : null;
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;

  return (
    <div className="panel group relative overflow-hidden p-6 md:p-8">
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 size-48 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-60",
        )}
        style={{ backgroundColor: colorVar }}
      />
      <p className="label-caps relative mb-3">{label}</p>
      <div
        className={cn(
          "relative mx-auto flex w-fit items-center justify-center rounded-2xl px-2 py-2",
          GLOW[trendKey],
        )}
      >
        <span className="heading-font text-[clamp(4rem,12vw,6.25rem)] leading-none" style={{ color: colorVar }}>
          {v}
        </span>
      </div>
      <div className="relative mt-3 flex items-center justify-center gap-2 text-[12px]">
        {delta != null ? (
          <span
            className={cn(
              "font-medium",
              up ? "text-[var(--trend-up)]" : down ? "text-[var(--trend-down)]" : "text-[var(--text-muted)]",
            )}
          >
            {up ? "↑" : down ? "↓" : "→"} {Math.abs(delta)} from yesterday
          </span>
        ) : (
          <span className="text-[var(--text-muted)]">No prior day</span>
        )}
      </div>
      <div className="relative mt-5 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, v)}%`, backgroundColor: colorVar }} />
      </div>
    </div>
  );
}
