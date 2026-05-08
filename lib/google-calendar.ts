import { formatInTimeZone } from "date-fns-tz";
import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { db } from "@/db/client";
import { attentionLogs, googleCalendarTokens } from "@/db/schema";
import { type AttentionLogRow, getCategoryColorId } from "@/lib/attention";
import { dateKeyInTimeZone } from "@/lib/dates";
import { pickTodayRow, prevRow, type DailySnapshotRow } from "@/lib/health";
import { getGoogleOAuthRedirectUri, getOAuthClient } from "@/lib/google";

const SLEEP_LOG_PRIVATE_KEY = "healthOsWakeDay";
const SLEEP_LOG_MARKER = "healthOsSleepLog";
const ATTENTION_LOG_MARKER = "healthOsAttention";
const ATTENTION_LOG_ID_KEY = "healthOsAttentionId";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Oura durations in snapshots are stored in seconds; John asked for minutes in calendar copy. */
function toMinutesRounded(sec: number | null | undefined): number | null {
  if (sec == null) return null;
  return Math.round(sec / 60);
}

function formatDurationMinutes(totalMin: number | null): string {
  if (totalMin == null || !Number.isFinite(totalMin)) return "—";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatClockLocal(d: Date | null, timeZone: string): string {
  if (!d || Number.isNaN(d.getTime())) return "—";
  return formatInTimeZone(d, timeZone, "h:mm a");
}

function avgHrvFromSleepDetail(sleepDetail: Record<string, unknown> | null | undefined): number | null {
  if (!sleepDetail) return null;
  const hrv = sleepDetail.hrv;
  if (!isRecord(hrv)) return null;
  const items = hrv.items;
  if (!Array.isArray(items)) return null;
  const vals = items.map((x) => num(x)).filter((x): x is number => x !== null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function restlessFromDetail(sleepDetail: Record<string, unknown> | null | undefined): number | null {
  if (!sleepDetail) return null;
  return num(sleepDetail.restless_periods);
}

function restlessFromRawSleep(raw: unknown): number | null {
  if (!isRecord(raw)) return null;
  return num(raw.restless_periods);
}

function formatEfficiencyPct(eff: unknown): string {
  const n = num(eff);
  if (n == null) return "—";
  const pct = n > 0 && n <= 1 ? Math.round(n * 100) : Math.round(n);
  return `${pct}%`;
}

export async function userHasGoogleCalendarTokens(userId: string): Promise<boolean> {
  const [row] = await db.select().from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId)).limit(1);
  return !!(row?.accessToken || row?.refreshToken);
}

export async function getCalendarClient(userId: string) {
  const [row] = await db.select().from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, userId)).limit(1);
  if (!row?.refreshToken && !row?.accessToken) return null;

  const redirectUri = getGoogleOAuthRedirectUri();
  const oauth = getOAuthClient(redirectUri);
  oauth.setCredentials({
    access_token: row.accessToken ?? undefined,
    refresh_token: row.refreshToken ?? undefined,
    expiry_date: row.expiry ? row.expiry.getTime() : undefined,
  });

  const expired = row.expiry ? row.expiry.getTime() < Date.now() + 120_000 : !row.accessToken;
  const needsRefresh = row.refreshToken && (!row.accessToken || expired);

  if (needsRefresh) {
    try {
      const { credentials } = await oauth.refreshAccessToken();
      const accessToken = credentials.access_token ?? row.accessToken;
      const expiry = credentials.expiry_date ? new Date(credentials.expiry_date) : row.expiry;
      await db
        .update(googleCalendarTokens)
        .set({
          accessToken: accessToken ?? row.accessToken,
          expiry: expiry ?? row.expiry,
        })
        .where(eq(googleCalendarTokens.id, row.id));
      oauth.setCredentials({
        access_token: accessToken ?? undefined,
        refresh_token: row.refreshToken ?? undefined,
        expiry_date: credentials.expiry_date,
      });
    } catch {
      return null;
    }
  }

  return google.calendar({ version: "v3", auth: oauth });
}

export async function deleteSleepEvent(userId: string, wakeDayDateKey: string): Promise<void> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return;

  const res = await calendar.events.list({
    calendarId: "primary",
    singleEvents: true,
    privateExtendedProperty: [`${SLEEP_LOG_PRIVATE_KEY}=${wakeDayDateKey}`],
    maxResults: 50,
  });

  const items = res.data.items ?? [];
  for (const ev of items) {
    if (!ev.id) continue;
    const priv = ev.extendedProperties?.private;
    if (priv?.[SLEEP_LOG_MARKER] === "1" && priv?.[SLEEP_LOG_PRIVATE_KEY] === wakeDayDateKey) {
      await calendar.events.delete({ calendarId: "primary", eventId: ev.id });
    }
  }
}

export type CreateSleepEventOpts = {
  timeZone: string;
  sleepRow: DailySnapshotRow;
  readinessRow?: DailySnapshotRow | null;
  /** Optional Oura detailed sleep document (e.g. long_sleep row) for restless + HRV items. */
  sleepDetail?: Record<string, unknown> | null;
  /** Calendar day key for the wake morning (snapshot date / Oura wake day). */
  wakeDayDateKey: string;
};

export async function createSleepEvent(userId: string, opts: CreateSleepEventOpts): Promise<{ eventId: string } | null> {
  const { timeZone, sleepRow, readinessRow, sleepDetail, wakeDayDateKey } = opts;
  const detail = sleepDetail ?? (isRecord(sleepRow.rawSleep) ? sleepRow.rawSleep : null);
  const start = sleepRow.bedtimeStart ? new Date(sleepRow.bedtimeStart) : null;
  const end = sleepRow.bedtimeEnd ? new Date(sleepRow.bedtimeEnd) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const calendar = await getCalendarClient(userId);
  if (!calendar) return null;

  await deleteSleepEvent(userId, wakeDayDateKey);

  const deepMin = toMinutesRounded(sleepRow.deepSleep);
  const remMin = toMinutesRounded(sleepRow.remSleep);
  const lightMin = toMinutesRounded(sleepRow.lightSleep);
  const awakeMin = toMinutesRounded(sleepRow.awakeTime);
  const sleepScore = sleepRow.sleepScore ?? "—";
  const title = `Sleep — Score: ${sleepScore} | Deep: ${deepMin ?? "—"}min | REM: ${remMin ?? "—"}min | Light: ${lightMin ?? "—"}min`;

  const readiness = readinessRow?.readinessScore ?? sleepRow.readinessScore ?? "—";
  const hrvMain = sleepRow.hrv ?? avgHrvFromSleepDetail(detail) ?? "—";
  const timeInBedMin = toMinutesRounded(sleepRow.timeInBed);
  const totalSleepMin = toMinutesRounded(sleepRow.sleepDuration);
  const bedStr = formatClockLocal(start, timeZone);
  const wakeStr = formatClockLocal(end, timeZone);
  const efficiencyStr = formatEfficiencyPct(sleepRow.efficiency);
  const latencyMin = sleepRow.latency;
  const restless =
    restlessFromDetail(detail) ??
    restlessFromRawSleep(sleepRow.rawSleep) ??
    "—";
  const bodyTemp = readinessRow?.bodyTempDeviation ?? sleepRow.bodyTempDeviation;
  const bodyTempStr =
    bodyTemp != null && Number.isFinite(bodyTemp)
      ? `${bodyTemp >= 0 ? "+" : ""}${bodyTemp.toFixed(2)}°C from baseline`
      : "—";
  const restingHr = sleepRow.lowestHeartRate ?? sleepRow.averageHeartRate ?? "—";
  const avgHrvSleep = sleepRow.hrv ?? avgHrvFromSleepDetail(detail) ?? "—";

  const description = [
    `Sleep Score: ${typeof sleepScore === "number" ? `${sleepScore}/100` : sleepScore}`,
    `Readiness: ${typeof readiness === "number" ? `${readiness}/100` : readiness}`,
    `HRV: ${hrvMain}ms`,
    "",
    `Time in Bed: ${formatDurationMinutes(timeInBedMin)} (${bedStr} → ${wakeStr})`,
    `Total Sleep: ${formatDurationMinutes(totalSleepMin)}`,
    "",
    "Sleep Stages (5-min increments):",
    `Deep: ${deepMin ?? "—"} min`,
    `REM: ${remMin ?? "—"} min`,
    `Light: ${lightMin ?? "—"} min`,
    `Awake: ${awakeMin ?? "—"} min`,
    "",
    `Efficiency: ${efficiencyStr}`,
    `Latency: ${latencyMin ?? "—"} min to fall asleep`,
    `Restless periods: ${restless}`,
    "",
    `Body Temp: ${bodyTempStr}`,
    `Resting HR: ${restingHr} bpm`,
    `Avg HRV during sleep: ${avgHrvSleep}ms`,
  ].join("\n");

  const startLocal = formatInTimeZone(start, timeZone, "yyyy-MM-dd'T'HH:mm:ss");
  const endLocal = formatInTimeZone(end, timeZone, "yyyy-MM-dd'T'HH:mm:ss");

  const insert = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: title,
      description,
      start: { dateTime: startLocal, timeZone },
      end: { dateTime: endLocal, timeZone },
      colorId: "9",
      visibility: "private",
      extendedProperties: {
        private: {
          [SLEEP_LOG_MARKER]: "1",
          [SLEEP_LOG_PRIVATE_KEY]: wakeDayDateKey,
        },
      },
    },
  });

  const eventId = insert.data.id;
  return eventId ? { eventId } : null;
}

/** Same sleep row selection as the dashboard (today’s row with stages, else yesterday, else latest). */
export function pickSleepRowForCalendarLog(
  snapshots: DailySnapshotRow[],
  timeZone: string,
): { sleepRow: DailySnapshotRow | null; readinessRow: DailySnapshotRow | null; wakeDayDateKey: string } {
  const todayKey = dateKeyInTimeZone(new Date(), timeZone);
  const { row: todayRow } = pickTodayRow(snapshots, timeZone);
  const yesterday = todayRow ? prevRow(snapshots, todayRow.date) : undefined;
  const hasSleep = (s: DailySnapshotRow | undefined) =>
    !!s && [s.deepSleep, s.remSleep, s.lightSleep].some((v) => v != null && v > 0);

  let sleepRow: DailySnapshotRow | undefined;
  if (hasSleep(todayRow)) sleepRow = todayRow;
  else if (hasSleep(yesterday)) sleepRow = yesterday;
  else sleepRow = [...snapshots].reverse().find(hasSleep);

  const readinessRow = snapshots.find((r) => r.date === todayKey) ?? todayRow ?? null;

  if (!sleepRow?.bedtimeStart || !sleepRow?.bedtimeEnd) {
    return { sleepRow: null, readinessRow, wakeDayDateKey: todayKey };
  }

  return {
    sleepRow,
    readinessRow,
    wakeDayDateKey: String(sleepRow.date),
  };
}

/** Create a Google Calendar event for an attention log entry. Returns the new googleEventId. */
export async function createAttentionEvent(
  userId: string,
  log: AttentionLogRow,
): Promise<string | null> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return null;

  const start = new Date(log.startUtc);
  const end = new Date(log.endUtc);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const description = [
    `Category: ${log.category}`,
    `With: ${log.withPerson || "Alone"}`,
    log.notes ? "" : null,
    log.notes ?? null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
    .trim();

  const insert = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: log.activity,
      description,
      start: { dateTime: start.toISOString(), timeZone: "UTC" },
      end: { dateTime: end.toISOString(), timeZone: "UTC" },
      colorId: getCategoryColorId(log.category),
      visibility: "private",
      extendedProperties: {
        private: {
          [ATTENTION_LOG_MARKER]: "1",
          [ATTENTION_LOG_ID_KEY]: log.id,
        },
      },
    },
  });

  return insert.data.id ?? null;
}

/** Update an existing Google Calendar attention event. */
export async function updateAttentionEvent(
  userId: string,
  log: AttentionLogRow,
): Promise<string | null> {
  if (!log.googleEventId) return createAttentionEvent(userId, log);
  const calendar = await getCalendarClient(userId);
  if (!calendar) return null;

  const start = new Date(log.startUtc);
  const end = new Date(log.endUtc);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const description = [
    `Category: ${log.category}`,
    `With: ${log.withPerson || "Alone"}`,
    log.notes ? "" : null,
    log.notes ?? null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
    .trim();

  try {
    const res = await calendar.events.update({
      calendarId: "primary",
      eventId: log.googleEventId,
      requestBody: {
        summary: log.activity,
        description,
        start: { dateTime: start.toISOString(), timeZone: "UTC" },
        end: { dateTime: end.toISOString(), timeZone: "UTC" },
        colorId: getCategoryColorId(log.category),
        visibility: "private",
        extendedProperties: {
          private: {
            [ATTENTION_LOG_MARKER]: "1",
            [ATTENTION_LOG_ID_KEY]: log.id,
          },
        },
      },
    });
    return res.data.id ?? log.googleEventId;
  } catch {
    return createAttentionEvent(userId, log);
  }
}

/** Best-effort delete of a Google Calendar event. */
export async function deleteCalendarEvent(userId: string, eventId: string): Promise<boolean> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return false;
  try {
    await calendar.events.delete({ calendarId: "primary", eventId });
    return true;
  } catch {
    return false;
  }
}

export type ExternalCalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  startUtc: string;
  endUtc: string;
  location: string | null;
};

/** Fetch primary-calendar events that aren't already synced from Health OS attention logs. */
export async function listUnmatchedCalendarEvents(
  userId: string,
  rangeStartUtc: Date,
  rangeEndUtc: Date,
): Promise<ExternalCalendarEvent[]> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return [];

  const knownIds = new Set<string>();
  const known = await db
    .select({ googleEventId: attentionLogs.googleEventId })
    .from(attentionLogs)
    .where(eq(attentionLogs.userId, userId));
  for (const row of known) {
    if (row.googleEventId) knownIds.add(row.googleEventId);
  }

  const res = await calendar.events.list({
    calendarId: "primary",
    singleEvents: true,
    orderBy: "startTime",
    timeMin: rangeStartUtc.toISOString(),
    timeMax: rangeEndUtc.toISOString(),
    maxResults: 250,
  });

  const events = res.data.items ?? [];
  const unmatched: ExternalCalendarEvent[] = [];

  for (const ev of events) {
    if (!ev.id) continue;
    const priv = ev.extendedProperties?.private;
    // Skip Health OS-managed events (sleep + already-synced attention)
    if (priv?.[SLEEP_LOG_MARKER] === "1") continue;
    if (priv?.[ATTENTION_LOG_MARKER] === "1") continue;
    if (knownIds.has(ev.id)) continue;

    const startStr = ev.start?.dateTime ?? ev.start?.date;
    const endStr = ev.end?.dateTime ?? ev.end?.date;
    if (!startStr || !endStr) continue;

    unmatched.push({
      id: ev.id,
      title: ev.summary ?? "(no title)",
      description: ev.description ?? null,
      startUtc: new Date(startStr).toISOString(),
      endUtc: new Date(endStr).toISOString(),
      location: ev.location ?? null,
    });
  }

  return unmatched;
}
