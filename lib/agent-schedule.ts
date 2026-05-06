/** Returns true if local clock in `timeZone` is within `windowMins` of `hhmm` (24h "HH:MM"). */
export function isWithinLocalTimeWindow(
  utcNow: Date,
  timeZone: string,
  hhmm: string | null | undefined,
  windowMins = 14,
): boolean {
  const t = (hhmm || "10:00").trim();
  const [th, tm] = t.split(":").map((x) => parseInt(x, 10) || 0);
  const targetM = th * 60 + tm;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(utcNow);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const curM = h * 60 + m;

  let diff = Math.abs(curM - targetM);
  if (diff > 12 * 60) diff = 24 * 60 - diff;
  return diff <= windowMins;
}
