import { format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { db } from "@/db/client";
import { attentionLogs } from "@/db/schema";

export type AttentionLogRow = InferSelectModel<typeof attentionLogs>;

export const ATTENTION_CATEGORIES = [
  "Family",
  "Self-Development",
  "Exercise",
  "Rest & Relaxation",
  "Book",
  "Amasia",
  "Friends",
  "Manual Admin",
  "Other",
] as const;

export type AttentionCategory = (typeof ATTENTION_CATEGORIES)[number];

export const CATEGORY_HEX: Record<string, string> = {
  Family: "#ff6b35",
  "Self-Development": "#6c63ff",
  Exercise: "#00e5b0",
  "Rest & Relaxation": "#4a9eff",
  Book: "#f5c842",
  Amasia: "#ff3d7f",
  Friends: "#a78bfa",
  "Manual Admin": "#7a7a9a",
  Other: "#6b7280",
};

/** Map category → Google Calendar colorId (1–11). */
export function getCategoryColorId(category: string): string {
  const map: Record<string, string> = {
    Family: "6",
    Exercise: "2",
    "Self-Development": "9",
    "Rest & Relaxation": "7",
    Book: "5",
    Amasia: "11",
    Work: "11",
    Friends: "3",
    "Manual Admin": "8",
  };
  return map[category] || "1";
}

/** Format a UTC offset (e.g. "+08:00") for the given IANA timezone at the given date. */
export function tzOffsetLabel(timeZone: string, at: Date = new Date()): string {
  try {
    const offset = formatInTimeZone(at, timeZone, "xxx");
    const compact = offset.replace(":00", "");
    return `UTC${compact === offset ? offset : compact}`;
  } catch {
    return timeZone;
  }
}

/** Convert "HH:MM" wall-clock on `dateKey` in `timeZone` to a UTC Date. */
export function localToUtc(dateKey: string, hhmm: string, timeZone: string): Date {
  const [y, mo, da] = dateKey.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  if (!y || !mo || !da || Number.isNaN(hh) || Number.isNaN(mm)) {
    return new Date(`${dateKey}T${hhmm || "00:00"}:00Z`);
  }
  const wall = new Date(y, mo - 1, da, hh, mm, 0, 0);
  return fromZonedTime(wall, timeZone);
}

/** Returns YYYY-MM-DD for a UTC Date in a given timezone. */
export function utcToDateKey(d: Date, timeZone: string): string {
  return formatInTimeZone(d, timeZone, "yyyy-MM-dd");
}

export function utcToHhmm(d: Date, timeZone: string): string {
  return formatInTimeZone(d, timeZone, "HH:mm");
}

/** Pull all attention logs for a user on a given local date. */
export async function getLogsForDate(
  userId: string,
  dateKey: string,
): Promise<AttentionLogRow[]> {
  return db
    .select()
    .from(attentionLogs)
    .where(and(eq(attentionLogs.userId, userId), eq(attentionLogs.date, dateKey)))
    .orderBy(asc(attentionLogs.startUtc));
}

/** Pull logs covering UTC range (inclusive). */
export async function getLogsInRange(
  userId: string,
  startUtc: Date,
  endUtc: Date,
): Promise<AttentionLogRow[]> {
  return db
    .select()
    .from(attentionLogs)
    .where(
      and(
        eq(attentionLogs.userId, userId),
        gte(attentionLogs.startUtc, startUtc),
        lte(attentionLogs.startUtc, endUtc),
      ),
    )
    .orderBy(asc(attentionLogs.startUtc));
}

/** Pull logs across a range of local dates (inclusive). */
export async function getLogsForDateRange(
  userId: string,
  startDateKey: string,
  endDateKey: string,
): Promise<AttentionLogRow[]> {
  return db
    .select()
    .from(attentionLogs)
    .where(
      and(
        eq(attentionLogs.userId, userId),
        gte(attentionLogs.date, startDateKey),
        lte(attentionLogs.date, endDateKey),
      ),
    )
    .orderBy(asc(attentionLogs.startUtc));
}

function escapeMd(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

/** Format John's Markdown table rows for a list of logs. */
function logsToTableRows(logs: AttentionLogRow[]): string[] {
  return logs.map((log) => {
    const startUtcDate = new Date(log.startUtc);
    const endUtcDate = new Date(log.endUtc);
    const dateUtc = format(startUtcDate, "yyyy-MM-dd");
    const localDate = log.date;
    const startUtc = format(startUtcDate, "HH:mm");
    const endUtc = format(endUtcDate, "HH:mm");
    return `| ${dateUtc} | ${localDate} | ${startUtc} | ${endUtc} | ${escapeMd(log.location) || "—"} | ${escapeMd(log.timezone)} | ${log.startLocal} | ${log.endLocal} | ${escapeMd(log.withPerson) || "—"} | ${escapeMd(log.activity)} | ${escapeMd(log.category)} | ${escapeMd(log.notes) || "—"} |`;
  });
}

const TABLE_HEADER = `| Date (UTC) | Local Date | Start (UTC) | End (UTC) | Location | TZ | Start (Local) | End (Local) | With | Activity | Category | Notes |
|------------|------------|-------------|-----------|----------|----|---------------|-------------|------|----------|----------|-------|`;

/** Generate the daily attention markdown using John's exact format. */
export function generateAttentionMarkdownDay(
  logs: AttentionLogRow[],
  dateKey: string,
): string {
  const [y, mo] = dateKey.split("-");
  const monthLabel = format(new Date(Number(y), Number(mo) - 1, 1), "MMMM yyyy");
  const rows = logs.length ? logsToTableRows(logs).join("\n") : "_No activities logged for this day._";
  return [
    `# Attention Tracker — ${monthLabel}`,
    "",
    "> **Schema:** UTC is ground truth. Local time is derived from location.",
    "",
    `**Day:** ${dateKey}`,
    "",
    TABLE_HEADER,
    rows,
    "",
  ].join("\n");
}

/** Generate the monthly attention markdown using John's exact format. */
export function generateAttentionMarkdownMonth(
  logs: AttentionLogRow[],
  monthKey: string,
): string {
  const [y, mo] = monthKey.split("-");
  const monthLabel = format(new Date(Number(y), Number(mo) - 1, 1), "MMMM yyyy");
  const rows = logs.length ? logsToTableRows(logs).join("\n") : "_No activities logged this month._";
  return [
    `# Attention Tracker — ${monthLabel}`,
    "",
    "> **Schema:** UTC is ground truth. Local time is derived from location.",
    "",
    TABLE_HEADER,
    rows,
    "",
  ].join("\n");
}

/** Aggregate total minutes per category for a list of logs. */
export function summarizeByCategory(
  logs: AttentionLogRow[],
): { category: string; minutes: number; color: string }[] {
  const totals = new Map<string, number>();
  for (const log of logs) {
    const start = new Date(log.startUtc).getTime();
    const end = new Date(log.endUtc).getTime();
    const minutes = Math.max(0, Math.round((end - start) / 60000));
    totals.set(log.category, (totals.get(log.category) ?? 0) + minutes);
  }
  return [...totals.entries()]
    .map(([category, minutes]) => ({
      category,
      minutes,
      color: CATEGORY_HEX[category] ?? "#6b7280",
    }))
    .sort((a, b) => b.minutes - a.minutes);
}
