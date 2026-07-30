"use client";

import { formatDurationSeconds } from "@/lib/health";
import { cn } from "@/lib/utils";

type Props = {
  deep: number | null | undefined;
  rem: number | null | undefined;
  light: number | null | undefined;
  size?: "default" | "lg";
  showExactMinutes?: boolean;
};

function toMinutesLabel(sec: number): string {
  return `${Math.round(sec / 60)}m`;
}

export function SleepStageBar({ deep, rem, light, size = "default", showExactMinutes = false }: Props) {
  const d = deep ?? 0;
  const r = rem ?? 0;
  const l = light ?? 0;
  const total = d + r + l || 1;
  const pct = (x: number) => `${Math.round((x / total) * 100)}%`;
  const large = size === "lg";

  return (
    <div className={cn("space-y-3", large && "space-y-5")}>
      <div
        className={cn(
          "flex w-full overflow-hidden rounded-full bg-white/[0.06]",
          large ? "h-8 min-h-[32px]" : "h-4 min-h-[16px]",
        )}
      >
        <div className="h-full bg-[var(--sleep)] transition-all" style={{ width: pct(d) }} title="Deep" />
        <div className="h-full bg-[#8b7fff] transition-all" style={{ width: pct(r) }} title="REM" />
        <div className="h-full bg-[#3d3550] transition-all" style={{ width: pct(l) }} title="Light" />
      </div>
      <div
        className={cn(
          "grid grid-cols-3 gap-2 text-[var(--text-secondary)]",
          large ? "gap-4 text-[12px]" : "text-[11px]",
        )}
      >
        <div>
          <span className="font-semibold text-[var(--sleep)]">Deep</span> {pct(d)}
          <div className={cn("text-[var(--text-muted)]", large && "mt-1 heading-font text-2xl text-white")}>
            {showExactMinutes ? toMinutesLabel(d) : formatDurationSeconds(d)}
          </div>
        </div>
        <div>
          <span className="font-semibold text-[#a89fff]">REM</span> {pct(r)}
          <div className={cn("text-[var(--text-muted)]", large && "mt-1 heading-font text-2xl text-white")}>
            {showExactMinutes ? toMinutesLabel(r) : formatDurationSeconds(r)}
          </div>
        </div>
        <div>
          <span className="font-semibold text-[var(--text-muted)]">Light</span> {pct(l)}
          <div className={cn("text-[var(--text-muted)]", large && "mt-1 heading-font text-2xl text-white")}>
            {showExactMinutes ? toMinutesLabel(l) : formatDurationSeconds(l)}
          </div>
        </div>
      </div>
    </div>
  );
}
