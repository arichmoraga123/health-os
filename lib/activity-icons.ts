export function activityEmoji(activity: string): string {
  const a = activity.toLowerCase();
  if (a.includes("run") || a.includes("walk")) return "🏃";
  if (a.includes("cycle") || a.includes("bike")) return "🚴";
  if (a.includes("swim")) return "🏊";
  if (a.includes("yoga") || a.includes("stretch") || a.includes("meditat")) return "🧘";
  if (a.includes("strength") || a.includes("weight") || a.includes("gym")) return "🏋️";
  return "🔥";
}

export function intensityBadgeClass(intensity: string): string {
  const i = intensity.toLowerCase();
  if (i === "easy" || i === "low") return "bg-[var(--ready)]/20 text-[var(--ready)] border-[var(--ready)]/40";
  if (i === "hard" || i === "high") return "bg-[var(--hrv)]/20 text-[var(--hrv)] border-[var(--hrv)]/40";
  return "bg-[var(--warn)]/15 text-[var(--warn)] border-[var(--warn)]/40";
}

export function workoutDurationMinutes(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / 60000));
}
