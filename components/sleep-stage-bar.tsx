"use client";

import { formatDurationSeconds } from "@/lib/health";

type Props = {
  deep: number | null | undefined;
  rem: number | null | undefined;
  light: number | null | undefined;
};

export function SleepStageBar({ deep, rem, light }: Props) {
  const d = deep ?? 0;
  const r = rem ?? 0;
  const l = light ?? 0;
  const total = d + r + l || 1;
  const pct = (x: number) => `${Math.round((x / total) * 100)}%`;

  return (
    <div className="space-y-3">
      <div className="flex h-4 min-h-[16px] w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full bg-[var(--sleep)] transition-all" style={{ width: pct(d) }} title="Deep" />
        <div className="h-full bg-[#8b7fff] transition-all" style={{ width: pct(r) }} title="REM" />
        <div className="h-full bg-[#3d3550] transition-all" style={{ width: pct(l) }} title="Light" />
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px] text-[var(--text-secondary)]">
        <div>
          <span className="text-[var(--sleep)] font-semibold">Deep</span> {pct(d)}
          <div className="text-[var(--text-muted)]">{formatDurationSeconds(d)}</div>
        </div>
        <div>
          <span className="text-[#a89fff] font-semibold">REM</span> {pct(r)}
          <div className="text-[var(--text-muted)]">{formatDurationSeconds(r)}</div>
        </div>
        <div>
          <span className="text-[var(--text-muted)] font-semibold">Light</span> {pct(l)}
          <div className="text-[var(--text-muted)]">{formatDurationSeconds(l)}</div>
        </div>
      </div>
    </div>
  );
}
