/** YYYY-MM-DD in a specific IANA timezone */
export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Inclusive Oura range: last `days` calendar days ending today in `timeZone`.
 */
export function rangeStartEnd(days: number, timeZone: string): { start: string; end: string } {
  const end = dateKeyInTimeZone(new Date(), timeZone);
  const start = subtractCalendarDaysInZone(timeZone, new Date(), days - 1);
  return { start, end };
}

export function yesterdayKeyInZone(timeZone: string): string {
  return subtractCalendarDaysInZone(timeZone, new Date(), 1);
}

function subtractCalendarDaysInZone(
  timeZone: string,
  from: Date,
  daysBack: number,
): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(from);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value) - 1;
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const utcNoon = Date.UTC(y, m, d, 12, 0, 0);
  const shifted = utcNoon - daysBack * 24 * 60 * 60 * 1000;
  return dateKeyInTimeZone(new Date(shifted), timeZone);
}

export function formatDateTimeInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
