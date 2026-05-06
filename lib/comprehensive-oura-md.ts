import { addDays, format, parseISO } from "date-fns";
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

/** Keep rows that belong to this calendar day (Oura `day` / `date` / timestamp prefix). */
export function filterRowsForDate(rows: Record<string, unknown>[], dateKey: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
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

/** Sleep / HR / workout often need ±1 day window then filter to wake day `dateKey`. */
function rangeParams(dateKey: string): { narrow: Record<string, string>; wide: Record<string, string> } {
  const d = parseISO(dateKey);
  const prev = format(addDays(d, -1), "yyyy-MM-dd");
  const next = format(addDays(d, 1), "yyyy-MM-dd");
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
    const data = raw.filter((x): x is Record<string, unknown> => x !== null && typeof x === "object") as Record<
      string,
      unknown
    >[];
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

/**
 * Fetches all requested Oura collections for a calendar day.
 * Uses narrow date for daily summaries; wide ±1 day for sleep / heartrate / workout then filters.
 */
export async function fetchOuraRawDayBundle(token: string, dateKey: string): Promise<EndpointFetch[]> {
  const { narrow, wide } = rangeParams(dateKey);

  return Promise.all(
    ENDPOINTS.map(async (path) => {
      const params = USE_WIDE_RANGE.has(path) ? wide : narrow;
      const r = await fetchEndpoint(path, token, params);
      const rows = filterRowsForDate(r.data as Record<string, unknown>[], dateKey);
      return { ...r, path, params, data: rows };
    }),
  );
}

function mdEscapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ").slice(0, 8000);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Flatten nested objects into markdown tables (limited depth). */
function renderKeyValues(obj: Record<string, unknown>, depth = 0, title?: string): string {
  if (depth > 4) return `\`${JSON.stringify(obj)}\`\n\n`;
  const lines: string[] = [];
  if (title) lines.push(`#### ${title}\n`);
  lines.push("| Field | Value |");
  lines.push("| --- | --- |");
  for (const [k, v] of Object.entries(obj)) {
    lines.push(`| ${mdEscapeCell(k)} | ${renderValueCell(v, depth)} |`);
  }
  return `${lines.join("\n")}\n\n`;
}

function renderValueCell(v: unknown, depth: number): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "string") {
    const s = v.length > 400 ? `${v.slice(0, 400)}… (${v.length} chars)` : v;
    return mdEscapeCell(s);
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return "`[]`";
    if (v.every((x) => typeof x === "number")) {
      return `${v.length} values → see **Arrays** section`;
    }
    return `\`${JSON.stringify(v).slice(0, 300)}${JSON.stringify(v).length > 300 ? "…" : ""}\``;
  }
  if (isPlainObject(v)) return `\`${JSON.stringify(v).slice(0, 240)}…\` _(object)_`;
  return mdEscapeCell(String(v));
}

function renderNumberArray(name: string, arr: number[], maxRows = 500): string {
  if (!arr.length) return "";
  const lines: string[] = [`### ${name} (${arr.length} samples)\n`];
  lines.push("| # | Value |");
  lines.push("| --- | --- |");
  const show = arr.slice(0, maxRows);
  show.forEach((n, i) => lines.push(`| ${i + 1} | ${n} |`));
  if (arr.length > maxRows) {
    lines.push(`\n_… ${arr.length - maxRows} more values omitted (total ${arr.length})_\n`);
  }
  lines.push("");
  return lines.join("\n");
}

function coerceNumberArray(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const nums = v.map((x) => (typeof x === "number" ? x : Number(x))).filter((x) => Number.isFinite(x));
  return nums.length === v.length ? nums : null;
}

/** Hypnogram / movement strings — full content in fenced block. */
function renderLongString(label: string, s: string): string {
  return `### ${label}\n\n\`\`\`text\n${s}\n\`\`\`\n\n`;
}

function extractArraysFromSleepRecord(rec: Record<string, unknown>): string {
  let out = "";
  const phase = rec.sleep_phase_5_min;
  if (typeof phase === "string" && phase.length > 0) {
    out += renderLongString("Sleep phase hypnogram (`sleep_phase_5_min`)", phase);
  }
  const hrv5 = rec.hrv_5_min ?? rec.hrv_samples;
  const nums = coerceNumberArray(hrv5);
  if (nums) out += renderNumberArray("HRV sample series (`hrv_5_min` / night)", nums);
  else if (hrv5 != null) out += `### HRV night data\n\n\`\`\`json\n${JSON.stringify(hrv5, null, 2).slice(0, 12000)}\n\`\`\`\n\n`;

  const movement = rec.movement_30_sec ?? rec.movement;
  if (typeof movement === "string" && movement.length > 0) {
    out += renderLongString("Movement (`movement_30_sec`)", movement.slice(0, 50000));
  }

  const hrDetail = rec.heart_rate;
  if (hrDetail != null) {
    out += `### Heart rate detail object\n\n${renderKeyValues(isPlainObject(hrDetail as object) ? (hrDetail as Record<string, unknown>) : { value: hrDetail as unknown })}\n`;
  }

  const intervals = rec.items ?? rec.samples;
  if (Array.isArray(intervals) && intervals.length) {
    out += `### Interval samples (first ${Math.min(50, intervals.length)})\n\n\`\`\`json\n${JSON.stringify(intervals.slice(0, 50), null, 2)}\n\`\`\`\n\n`;
  }

  return out;
}

function endpointTitle(path: OuraEndpointName): string {
  return path.replace("v2/usercollection/", "").replace(/_/g, " ");
}

function renderEndpointSection(fetch: EndpointFetch): string {
  const title = endpointTitle(fetch.path);
  let body = `## ${title}\n\n`;
  if (fetch.error) {
    body += `⚠️ **Fetch error:** ${mdEscapeCell(fetch.error)}\n\n`;
    return body;
  }
  if (!fetch.data.length) {
    body += `_No records for this date after filtering._\n\n`;
    return body;
  }

  fetch.data.forEach((rec, idx) => {
    body += `### Record ${idx + 1}\n\n`;
    const contributors = rec.contributors;
    const base: Record<string, unknown> = { ...rec };
    if (contributors != null) delete base.contributors;

    body += renderKeyValues(base, 0, "Scalars");

    if (isPlainObject(contributors)) {
      body += renderKeyValues(contributors, 1, "Contributors");
    }

    if (fetch.path === "v2/usercollection/sleep") {
      body += extractArraysFromSleepRecord(rec);
    }

    if (fetch.path === "v2/usercollection/heartrate") {
      for (const key of Object.keys(rec)) {
        const val = rec[key];
        const arr = coerceNumberArray(val);
        if (arr && arr.length > 5) {
          body += renderNumberArray(`Series \`${key}\``, arr, 400);
        }
      }
    }

    const rawJson = JSON.stringify(rec, null, 2);
    const maxJson =
      fetch.path === "v2/usercollection/sleep"
        ? 28000
        : fetch.path === "v2/usercollection/heartrate"
          ? 20000
          : 16000;
    body += `#### Complete record (JSON)\n\n\`\`\`json\n${
      rawJson.length > maxJson ? `${rawJson.slice(0, maxJson)}\n… _(truncated, ${rawJson.length} chars total)_` : rawJson
    }\n\`\`\`\n\n`;
  });

  return body;
}

/**
 * Builds a single downloadable markdown file with all raw Oura payloads for the day.
 */
export function generateComprehensiveOuraMarkdown(opts: {
  dateKey: string;
  displayName: string;
  bundle: EndpointFetch[];
}): string {
  const { dateKey, displayName, bundle } = opts;
  const header = `# Oura raw health export — ${dateKey}

**Generated by Health OS** · ${displayName}  
**Generated at:** ${new Date().toISOString()}

This report combines **unaltered API responses** from Oura Cloud (via your worker) for the calendar day **${dateKey}**.  
Daily summaries use \`start_date = end_date = ${dateKey}\`. Detailed sleep / heart rate / workouts use a ±1 day fetch window and are filtered to this day.

---

`;

  const sections = bundle.map(renderEndpointSection).join("\n");

  const footer = `
---

*Data sourced from Oura Ring API v2 collections.*  
*Endpoints: ${ENDPOINTS.join(", ")}*
`;

  return `${header}${sections}${footer}`;
}

export async function buildComprehensiveDailyMarkdown(opts: {
  token: string;
  dateKey: string;
  userName?: string | null;
}): Promise<string> {
  const bundle = await fetchOuraRawDayBundle(opts.token, opts.dateKey);
  return generateComprehensiveOuraMarkdown({
    dateKey: opts.dateKey,
    displayName: opts.userName?.trim() || "User",
    bundle,
  });
}
