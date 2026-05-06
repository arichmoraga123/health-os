import { addDays, format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ouraFetch } from "@/lib/oura";

const ENDPOINTS = [
  "v2/usercollection/sleep",
  "v2/usercollection/daily_sleep",
  "v2/usercollection/daily_readiness",
  "v2/usercollection/daily_activity",
  "v2/usercollection/workout",
  "v2/usercollection/daily_stress",
  "v2/usercollection/heartrate",
  "v2/usercollection/sleep_time",
] as const;

export type OuraEndpointName = (typeof ENDPOINTS)[number];

export type EndpointFetch = {
  path: OuraEndpointName;
  params: Record<string, string>;
  data: Record<string, unknown>[];
  error?: string;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function mdEscapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 500);
}

function formatValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return mdEscapeCell(v);
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (isPlainObject(v)) return "[object]";
  return mdEscapeCell(String(v));
}

function dateKeyFromRow(row: Record<string, unknown>): string | null {
  const raw = row.day ?? row.date;
  if (raw == null || raw === "") return null;
  const s = String(raw);
  return s.includes("T") ? s.slice(0, 10) : s;
}

function timestampDay(ts: unknown): string | null {
  if (ts == null) return null;
  const s = String(ts);
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function bedtimeLocalDateKey(bedtimeStart: unknown, homeTimezone: string): string | null {
  if (typeof bedtimeStart !== "string" || bedtimeStart.length < 10) return null;
  const d = new Date(bedtimeStart);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return formatInTimeZone(d, homeTimezone, "yyyy-MM-dd");
  } catch {
    return null;
  }
}

function sleepMatchesDate(row: Record<string, unknown>, dateKey: string, homeTimezone: string): boolean {
  if (row.type !== "long_sleep") return false;

  const prevDateKey = format(addDays(parseISO(dateKey), -1), "yyyy-MM-dd");
  const bedtimeLocalDay = bedtimeLocalDateKey(row.bedtime_start, homeTimezone);
  if (bedtimeLocalDay === dateKey || bedtimeLocalDay === prevDateKey) return true;

  return false;
}

/**
 * Keep rows for this calendar day.
 * Sleep rows additionally use bedtime_start converted to home timezone and include previous local-day bedtimes.
 */
export function filterRowsForDate(
  rows: Record<string, unknown>[],
  dateKey: string,
  homeTimezone: string,
  path?: OuraEndpointName,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (path === "v2/usercollection/sleep" && sleepMatchesDate(row, dateKey, homeTimezone)) {
      out.push(row);
      continue;
    }

    const d = dateKeyFromRow(row);
    if (d === dateKey) {
      out.push(row);
      continue;
    }

    const ts =
      timestampDay(row.timestamp) ??
      timestampDay(row.start_datetime) ??
      timestampDay(row.interval_start) ??
      timestampDay(row.bedtime_start);
    if (ts === dateKey) out.push(row);
  }
  return out;
}

function rangeParams(dateKey: string): { narrow: Record<string, string>; wide: Record<string, string> } {
  const d = parseISO(dateKey);
  const prev = format(addDays(d, -2), "yyyy-MM-dd");
  const next = format(addDays(d, 2), "yyyy-MM-dd");
  return {
    narrow: { start_date: dateKey, end_date: dateKey },
    wide: { start_date: prev, end_date: next },
  };
}

async function fetchEndpoint(
  path: OuraEndpointName,
  token: string,
  params: Record<string, string>,
): Promise<{ params: Record<string, string>; data: Record<string, unknown>[]; error?: string }> {
  try {
    const res = await ouraFetch(path, token, params);
    const raw = Array.isArray((res as { data?: unknown })?.data)
      ? ((res as { data: unknown[] }).data ?? [])
      : [];
    const data = raw.filter((x): x is Record<string, unknown> => isPlainObject(x));
    return { params, data };
  } catch (e) {
    return {
      params,
      data: [],
      error: e instanceof Error ? e.message : "Request failed",
    };
  }
}

const USE_WIDE_RANGE: ReadonlySet<OuraEndpointName> = new Set([
  "v2/usercollection/sleep",
  "v2/usercollection/heartrate",
  "v2/usercollection/workout",
]);

export async function fetchOuraRawDayBundle(
  token: string,
  dateKey: string,
  homeTimezone: string,
): Promise<EndpointFetch[]> {
  const { narrow, wide } = rangeParams(dateKey);
  return Promise.all(
    ENDPOINTS.map(async (path) => {
      const params = USE_WIDE_RANGE.has(path) ? wide : narrow;
      const r = await fetchEndpoint(path, token, params);
      const rows = filterRowsForDate(r.data, dateKey, homeTimezone, path);
      return { ...r, path, params, data: rows };
    }),
  );
}

function bundleData(bundle: EndpointFetch[], path: OuraEndpointName): Record<string, unknown>[] {
  const endpoint = bundle.find((b) => b.path === path);
  return endpoint?.data ?? [];
}

function endpointError(bundle: EndpointFetch[], path: OuraEndpointName): string | undefined {
  return bundle.find((b) => b.path === path)?.error;
}

function cleanRecord(rec: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (k === "producer_timestamp") continue;
    next[k] = v;
  }
  return next;
}

function compactTable(headers: string[], rows: string[][]): string {
  if (!rows.length) return "_No data available._\n\n";
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}\n\n`;
}

function pickFields(rec: Record<string, unknown>, keys: string[]): string[][] {
  return keys.map((key) => [mdEscapeCell(key), formatValue(rec[key])]);
}

function renderSleepSection(bundle: EndpointFetch[], dateKey: string, homeTimezone: string): string {
  const sleepRecords = bundleData(bundle, "v2/usercollection/sleep").map(cleanRecord);
  const dailySleep = bundleData(bundle, "v2/usercollection/daily_sleep").map(cleanRecord);
  const rec = selectMainSleepRecord(sleepRecords, dateKey, homeTimezone) ?? dailySleep[0];

  let out = "## Sleep\n\n";
  const err = endpointError(bundle, "v2/usercollection/sleep") ?? endpointError(bundle, "v2/usercollection/daily_sleep");
  if (err) out += `⚠️ ${mdEscapeCell(err)}\n\n`;
  if (!rec) return `${out}_No sleep data available._\n\n`;

  out += compactTable(
    ["Field", "Value"],
    pickFields(rec, [
      "day",
      "bedtime_start",
      "bedtime_end",
      "total_sleep_duration",
      "time_in_bed",
      "sleep_efficiency",
      "sleep_score",
      "deep_sleep_duration",
      "light_sleep_duration",
      "rem_sleep_duration",
      "awake_time",
      "latency",
      "restless_periods",
    ]),
  );

  const hypnogram = typeof rec.sleep_phase_5_min === "string" ? rec.sleep_phase_5_min : "";
  if (hypnogram) {
    out += "### Sleep phases\n\n";
    out += "Hypnogram (`sleep_phase_5_min`):\n\n";
    out += `\`${hypnogram}\`\n\n`;
    out += "Legend: 1=deep, 2=light, 3=REM, 4=awake.\n\n";
  }

  return out;
}

function selectMainSleepRecord(
  records: Record<string, unknown>[],
  dateKey: string,
  homeTimezone: string,
): Record<string, unknown> | null {
  const longSleep = records.filter((r) => r.type === "long_sleep");
  if (!longSleep.length) return records[0] ?? null;
  const prevDateKey = format(addDays(parseISO(dateKey), -1), "yyyy-MM-dd");

  const preferPreviousLocalDay = longSleep.filter(
    (r) => bedtimeLocalDateKey(r.bedtime_start, homeTimezone) === prevDateKey,
  );
  const sameLocalDay = longSleep.filter((r) => bedtimeLocalDateKey(r.bedtime_start, homeTimezone) === dateKey);
  const pool = preferPreviousLocalDay.length ? preferPreviousLocalDay : sameLocalDay.length ? sameLocalDay : longSleep;
  pool.sort((a, b) => (num(b.total_sleep_duration) ?? 0) - (num(a.total_sleep_duration) ?? 0));
  return pool[0] ?? null;
}

function renderReadinessSection(bundle: EndpointFetch[]): string {
  const rec = cleanRecord(bundleData(bundle, "v2/usercollection/daily_readiness")[0] ?? {});
  let out = "## Readiness\n\n";
  const err = endpointError(bundle, "v2/usercollection/daily_readiness");
  if (err) out += `⚠️ ${mdEscapeCell(err)}\n\n`;
  if (!Object.keys(rec).length) return `${out}_No readiness data available._\n\n`;

  const contributors = isPlainObject(rec.contributors) ? rec.contributors : {};
  out += compactTable(
    ["Contributor", "Value"],
    Object.entries(contributors)
      .filter(([k]) => k !== "producer_timestamp")
      .map(([k, v]) => [mdEscapeCell(k), formatValue(v)]),
  );
  return out;
}

function renderActivitySection(bundle: EndpointFetch[]): string {
  const rec = cleanRecord(bundleData(bundle, "v2/usercollection/daily_activity")[0] ?? {});
  let out = "## Activity\n\n";
  const err = endpointError(bundle, "v2/usercollection/daily_activity");
  if (err) out += `⚠️ ${mdEscapeCell(err)}\n\n`;
  if (!Object.keys(rec).length) return `${out}_No activity data available._\n\n`;

  out += compactTable(
    ["Field", "Value"],
    pickFields(rec, [
      "day",
      "score",
      "steps",
      "active_calories",
      "total_calories",
      "equivalent_walking_distance",
      "high_activity_met_minutes",
      "medium_activity_met_minutes",
      "low_activity_met_minutes",
      "inactive_time",
      "resting_time",
    ]),
  );
  return out;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function renderHeartRateSection(bundle: EndpointFetch[]): string {
  const rows = bundleData(bundle, "v2/usercollection/heartrate").map(cleanRecord);
  let out = "## Heart rate\n\n";
  const err = endpointError(bundle, "v2/usercollection/heartrate");
  if (err) out += `⚠️ ${mdEscapeCell(err)}\n\n`;
  if (!rows.length) return `${out}_No heart rate data available._\n\n`;

  const bpms = rows.map((r) => num(r.bpm)).filter((x): x is number => x !== null);
  if (!bpms.length) return `${out}_Heart rate rows present but no BPM values were found._\n\n`;

  const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
  const min = Math.min(...bpms);
  const max = Math.max(...bpms);
  out += `Avg: ${avg}bpm, Min: ${min}bpm, Max: ${max}bpm\n\n`;

  const maxRows = 20;
  out += compactTable(
    ["timestamp", "bpm", "source"],
    rows.slice(0, maxRows).map((r) => [
      formatValue(r.timestamp),
      formatValue(r.bpm),
      formatValue(r.source),
    ]),
  );
  if (rows.length > maxRows) {
    out += `... and ${rows.length - maxRows} more readings\n\n`;
  }
  return out;
}

function renderHrvSection(bundle: EndpointFetch[]): string {
  const sleepRecords = bundleData(bundle, "v2/usercollection/sleep").map(cleanRecord);
  let values: number[] = [];
  for (const rec of sleepRecords) {
    if (Array.isArray(rec.hrv_5_min)) {
      values = values.concat(rec.hrv_5_min.map(num).filter((x): x is number => x !== null));
    }
  }

  let out = "## HRV\n\n";
  if (!values.length) return `${out}_No HRV series available._\n\n`;

  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const min = Math.min(...values);
  const max = Math.max(...values);
  out += `Avg: ${avg}ms, Min: ${min}ms, Max: ${max}ms\n\n`;

  const maxRows = 20;
  out += compactTable(
    ["sample", "hrv_ms"],
    values.slice(0, maxRows).map((v, idx) => [String(idx + 1), String(v)]),
  );
  if (values.length > maxRows) {
    out += `... and ${values.length - maxRows} more samples\n\n`;
  }
  return out;
}

function renderOtherEndpoints(bundle: EndpointFetch[]): string {
  const others: OuraEndpointName[] = [
    "v2/usercollection/workout",
    "v2/usercollection/daily_stress",
    "v2/usercollection/sleep_time",
  ];
  let out = "";
  for (const path of others) {
    const rows = bundleData(bundle, path).map(cleanRecord);
    const err = endpointError(bundle, path);
    const title = path.replace("v2/usercollection/", "").replace(/_/g, " ");
    out += `## ${title}\n\n`;
    if (err) out += `⚠️ ${mdEscapeCell(err)}\n\n`;
    if (!rows.length) {
      out += "_No data available._\n\n";
      continue;
    }
    const rec = rows[0];
    const keys = Object.keys(rec)
      .filter((k) => k !== "contributors" && !Array.isArray(rec[k]) && !isPlainObject(rec[k]))
      .slice(0, 12);
    out += compactTable(["Field", "Value"], pickFields(rec, keys));
  }
  return out;
}

export function generateComprehensiveOuraMarkdown(opts: {
  dateKey: string;
  displayName: string;
  homeTimezone: string;
  bundle: EndpointFetch[];
}): string {
  const { dateKey, displayName, homeTimezone, bundle } = opts;
  const header = `# Oura health export — ${dateKey}

**User:** ${displayName}  
**Home timezone:** ${homeTimezone}  
**Generated at:** ${new Date().toISOString()}

This export is formatted for human readability and LLM ingestion.  
Sleep filtering uses local bedtime conversion and includes previous-day local bedtimes when relevant.

---

`;

  return [
    header,
    renderSleepSection(bundle, dateKey, homeTimezone),
    renderReadinessSection(bundle),
    renderActivitySection(bundle),
    renderHeartRateSection(bundle),
    renderHrvSection(bundle),
    renderOtherEndpoints(bundle),
  ].join("");
}

export async function buildComprehensiveDailyMarkdown(opts: {
  token: string;
  dateKey: string;
  userName?: string | null;
  homeTimezone?: string | null;
}): Promise<string> {
  const homeTimezone = opts.homeTimezone?.trim() || "UTC";
  const bundle = await fetchOuraRawDayBundle(opts.token, opts.dateKey, homeTimezone);
  return generateComprehensiveOuraMarkdown({
    dateKey: opts.dateKey,
    displayName: opts.userName?.trim() || "User",
    homeTimezone,
    bundle,
  });
}
