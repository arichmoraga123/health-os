"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { QuickLogModal } from "@/components/attention-tracker-widget";
import { CATEGORY_HEX, summarizeByCategory } from "@/lib/attention";

type ServerLog = {
  id: string;
  date: string;
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  location: string | null;
  timezone: string;
  withPerson: string | null;
  activity: string;
  category: string;
  notes: string | null;
  googleEventId: string | null;
};

type UnmatchedEvent = {
  id: string;
  title: string;
  description: string | null;
  startUtc: string;
  endUtc: string;
  location: string | null;
};

const TIMELINE_START_HOUR = 6;
const TIMELINE_END_HOUR = 24;
const TIMELINE_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function durationMinutes(startUtc: string, endUtc: string): number {
  return Math.max(0, Math.round((new Date(endUtc).getTime() - new Date(startUtc).getTime()) / 60000));
}

function formatHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function utcToLocalHHMM(iso: string): string {
  return formatHHMM(new Date(iso));
}

export function AttentionPageClient({
  defaultLocation,
  initialDate,
  initialLogs,
}: {
  defaultLocation?: string | null;
  initialDate: string;
  initialLogs: ServerLog[];
}) {
  const [date, setDate] = useState(initialDate);
  const [logs, setLogs] = useState<ServerLog[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ServerLog | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [unmatched, setUnmatched] = useState<UnmatchedEvent[] | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconnectRequired, setReconnectRequired] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [prefill, setPrefill] = useState<Partial<ServerLog> | null>(null);

  const refresh = useCallback(
    async (target = date) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/attention/logs?date=${target}&t=${Date.now()}`, {
          cache: "no-store",
        });
        const j = await res.json();
        if (res.ok && Array.isArray(j.logs)) setLogs(j.logs as ServerLog[]);
      } finally {
        setLoading(false);
      }
    },
    [date],
  );

  useEffect(() => {
    void refresh(date);
  }, [date, refresh]);

  function flash(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  }

  async function deleteLog(id: string) {
    if (!confirm("Delete this entry?")) return;
    const res = await fetch(`/api/attention/log/${id}`, { method: "DELETE" });
    if (res.ok) {
      flash("Deleted");
      await refresh();
    } else {
      flash("Delete failed");
    }
  }

  async function exportMd() {
    window.location.href = `/api/attention/export-md?date=${date}`;
  }

  async function exportMonth() {
    const month = date.slice(0, 7);
    window.location.href = `/api/attention/export-md?month=${month}`;
  }

  async function syncCalendar() {
    setCalendarBusy(true);
    try {
      const res = await fetch("/api/attention/sync-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        synced?: number;
        errors?: number;
        error?: string;
        reconnectRequired?: boolean;
      };
      if (!res.ok) {
        if (j.reconnectRequired) setReconnectRequired(true);
        throw new Error(j.error ?? "Sync failed");
      }
      flash(`Synced ${j.synced ?? 0} events${j.errors ? ` (${j.errors} errors)` : ""}`);
      await refresh();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setCalendarBusy(false);
    }
  }

  async function reconcile() {
    setReconciling(true);
    setReconnectRequired(false);
    try {
      const res = await fetch("/api/attention/reconcile-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        unmatched?: UnmatchedEvent[];
        error?: string;
        reconnectRequired?: boolean;
      };
      if (!res.ok) {
        if (j.reconnectRequired) setReconnectRequired(true);
        throw new Error(j.error ?? "Reconcile failed");
      }
      setUnmatched(j.unmatched ?? []);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Reconcile failed");
    } finally {
      setReconciling(false);
    }
  }

  async function deleteCalendarEvent(eventId: string) {
    if (!confirm("Delete this event from Google Calendar?")) return;
    const res = await fetch(`/api/attention/calendar-event/${eventId}`, { method: "DELETE" });
    if (res.ok) {
      setUnmatched((prev) => prev?.filter((e) => e.id !== eventId) ?? null);
      flash("Deleted from calendar");
    } else {
      flash("Delete failed");
    }
  }

  function adoptCalendarEvent(ev: UnmatchedEvent) {
    setPrefill({
      activity: ev.title,
      startLocal: utcToLocalHHMM(ev.startUtc),
      endLocal: utcToLocalHHMM(ev.endUtc),
      location: ev.location,
      notes: ev.description,
    });
    setCreating(true);
    setUnmatched((prev) => prev?.filter((e) => e.id !== ev.id) ?? null);
  }

  const summary = useMemo(() => summarizeByCategory(logs as never), [logs]);
  const totalMin = summary.reduce((acc, s) => acc + s.minutes, 0);

  return (
    <AppShell title="Attention Log">
      <div className="space-y-6">
        <section className="panel flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDate(shiftDate(date, -1))}
              className="btn btn-outline !min-w-0 !px-3 !py-2"
              aria-label="Previous day"
            >
              ←
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="!py-2"
            />
            <button
              type="button"
              onClick={() => setDate(shiftDate(date, 1))}
              className="btn btn-outline !min-w-0 !px-3 !py-2"
              aria-label="Next day"
            >
              →
            </button>
            <button
              type="button"
              onClick={() => setDate(todayKey())}
              className="btn btn-outline !min-w-0 !px-3 !py-2 !text-[11px]"
            >
              Today
            </button>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setPrefill(null);
                setCreating(true);
              }}
              className="btn btn-primary !px-4 !py-2 !text-[12px] uppercase"
            >
              + Log activity
            </button>
            <button
              type="button"
              onClick={exportMd}
              className="btn btn-outline !px-4 !py-2 !text-[12px]"
            >
              Export day MD
            </button>
            <button
              type="button"
              onClick={exportMonth}
              className="btn btn-outline !px-4 !py-2 !text-[12px]"
            >
              Export month MD
            </button>
            <button
              type="button"
              onClick={() => void syncCalendar()}
              disabled={calendarBusy}
              className="btn btn-outline !px-4 !py-2 !text-[12px] disabled:opacity-50"
            >
              {calendarBusy ? "Syncing…" : "Sync to Calendar"}
            </button>
          </div>
        </section>

        {toast ? (
          <section className="panel p-3 text-[12px] text-white">{toast}</section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="panel p-5 md:p-6">
            <p className="label-caps mb-4">Timeline · {date}</p>
            {loading ? (
              <p className="text-[12px] text-[var(--text-muted)]">Loading…</p>
            ) : logs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border)] bg-white/[0.02] px-4 py-6 text-center text-[12px] text-[var(--text-muted)]">
                No activities logged for this day.
              </p>
            ) : (
              <Timeline logs={logs} onEdit={setEditing} onDelete={deleteLog} />
            )}
          </div>

          <div className="panel p-5 md:p-6">
            <p className="label-caps mb-4">Time by category</p>
            {summary.length === 0 ? (
              <p className="text-[12px] text-[var(--text-muted)]">Nothing tracked yet.</p>
            ) : (
              <div className="space-y-3">
                {summary.map((s) => {
                  const pct = totalMin ? Math.round((s.minutes / totalMin) * 100) : 0;
                  const h = Math.floor(s.minutes / 60);
                  const m = s.minutes % 60;
                  return (
                    <div key={s.category}>
                      <div className="flex items-center justify-between text-[12px] text-white">
                        <span className="flex items-center gap-2">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.category}
                        </span>
                        <span className="text-[var(--text-secondary)]">
                          {h}h {m}m · {pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        <div
                          className="h-full"
                          style={{ width: `${pct}%`, backgroundColor: s.color }}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="pt-2 text-[11px] text-[var(--text-muted)]">
                  Total tracked: {Math.floor(totalMin / 60)}h {totalMin % 60}m
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="panel p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="label-caps text-[var(--text-muted)]">Reconcile calendar</p>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                Catch recurring events that didn&apos;t actually happen.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void reconcile()}
              disabled={reconciling}
              className="btn btn-outline !px-4 !py-2 !text-[12px] disabled:opacity-50"
            >
              {reconciling ? "Checking…" : "Check calendar for unmatched events"}
            </button>
          </div>

          {reconnectRequired ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--warn)]/40 bg-[var(--warn)]/5 p-3 text-[12px] text-[var(--text-secondary)]">
              <span>
                Google Calendar is missing the <code>calendar.events</code> scope (or your token was revoked).
                Reconnect to grant the right permissions.
              </span>
              <a href="/api/calendar/auth" className="btn btn-primary !px-4 !py-2 !text-[11px]">
                Reconnect Google Calendar
              </a>
            </div>
          ) : null}

          {unmatched ? (
            <div className="mt-4 space-y-2">
              {unmatched.length === 0 ? (
                <p className="text-[12px] text-[var(--text-muted)]">
                  All Google Calendar events for {date} are accounted for.
                </p>
              ) : (
                unmatched.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white/[0.03] p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-white">{ev.title}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {utcToLocalHHMM(ev.startUtc)} – {utcToLocalHHMM(ev.endUtc)}
                        {ev.location ? ` · ${ev.location}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => adoptCalendarEvent(ev)}
                        className="btn btn-primary !min-w-0 !px-3 !py-2 !text-[11px]"
                      >
                        ✓ It happened
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteCalendarEvent(ev.id)}
                        className="btn btn-outline !min-w-0 !px-3 !py-2 !text-[11px]"
                      >
                        ✗ Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </section>
      </div>

      {creating ? (
        <QuickLogModal
          dateKey={date}
          defaultLocation={defaultLocation ?? undefined}
          onClose={() => {
            setCreating(false);
            setPrefill(null);
          }}
          onSaved={async () => {
            setCreating(false);
            setPrefill(null);
            await refresh();
          }}
          initial={prefill ?? undefined}
        />
      ) : null}

      {editing ? (
        <EditLogModal
          log={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      ) : null}
    </AppShell>
  );
}

function TimelineBlock({
  log,
  top,
  height,
  color,
  tooltipText,
  onClick,
}: {
  log: ServerLog;
  top: number;
  height: number;
  color: string;
  tooltipText: string;
  onClick: () => void;
}) {
  const isShort = height < 6;
  return (
    <div
      className="group absolute left-0 right-0 box-border max-w-full"
      style={{ top: `${top}%`, height: `${height}%` }}
    >
      <button
        type="button"
        onClick={onClick}
        title={tooltipText}
        aria-label={tooltipText}
        className="block h-full w-full max-w-full overflow-hidden rounded-md px-2 py-1 text-left text-[11px] text-white transition-opacity hover:opacity-90"
        style={{
          background: `${color}26`,
          borderLeft: `3px solid ${color}`,
        }}
      >
        <div className="block w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-medium">
          {log.activity}
        </div>
        {!isShort ? (
          <div className="block w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[10px] opacity-80">
            {log.startLocal}–{log.endLocal} · {log.category}
          </div>
        ) : null}
      </button>
      <div className="pointer-events-none invisible absolute left-1/2 top-full z-20 mt-1 w-max max-w-[280px] -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] leading-relaxed text-white shadow-xl group-hover:visible group-focus-within:visible">
        <div className="font-semibold">{log.activity}</div>
        <div className="mt-0.5 text-[var(--text-secondary)]">
          {log.startLocal}–{log.endLocal} · {log.category}
        </div>
        {log.withPerson ? (
          <div className="mt-0.5 text-[var(--text-muted)]">With: {log.withPerson}</div>
        ) : null}
        {log.location ? (
          <div className="mt-0.5 text-[var(--text-muted)]">Location: {log.location}</div>
        ) : null}
        {log.notes ? (
          <div className="mt-0.5 whitespace-pre-wrap text-[var(--text-muted)]">Notes: {log.notes}</div>
        ) : null}
      </div>
    </div>
  );
}

function Timeline({
  logs,
  onEdit,
  onDelete,
}: {
  logs: ServerLog[];
  onEdit: (log: ServerLog) => void;
  onDelete: (id: string) => void;
}) {
  const totalMinutes = TIMELINE_HOURS * 60;
  return (
    <div className="space-y-3">
      <div className="relative h-[420px] overflow-hidden rounded-xl border border-[var(--border)] bg-white/[0.02]">
        {Array.from({ length: TIMELINE_HOURS + 1 }).map((_, i) => {
          const top = (i / TIMELINE_HOURS) * 100;
          const hour = TIMELINE_START_HOUR + i;
          return (
            <div
              key={i}
              className="pointer-events-none absolute left-0 right-0 flex items-center gap-2 text-[10px] text-[var(--text-muted)]"
              style={{ top: `${top}%` }}
            >
              <span className="w-10 shrink-0 pl-1">
                {hour === 24 ? "24:00" : `${String(hour).padStart(2, "0")}:00`}
              </span>
              <div className="h-px flex-1 bg-white/[0.05]" />
            </div>
          );
        })}
        <div className="absolute inset-y-0 left-12 right-2 overflow-hidden">
          {logs.map((log) => {
            const startMin = hhmmToMinutes(log.startLocal) - TIMELINE_START_HOUR * 60;
            const endMinRaw = hhmmToMinutes(log.endLocal) - TIMELINE_START_HOUR * 60;
            const endMin = endMinRaw <= startMin ? totalMinutes : endMinRaw;
            const top = Math.max(0, (startMin / totalMinutes) * 100);
            const height = Math.max(2, ((endMin - startMin) / totalMinutes) * 100);
            const color = CATEGORY_HEX[log.category] ?? "#6b7280";
            const tooltipParts = [
              `${log.activity}`,
              `${log.startLocal}–${log.endLocal} · ${log.category}`,
              log.withPerson ? `With: ${log.withPerson}` : null,
              log.location ? `Location: ${log.location}` : null,
              log.notes ? `Notes: ${log.notes}` : null,
            ].filter((s): s is string => !!s);
            return (
              <TimelineBlock
                key={log.id}
                log={log}
                top={top}
                height={height}
                color={color}
                tooltipText={tooltipParts.join("\n")}
                onClick={() => onEdit(log)}
              />
            );
          })}
        </div>
      </div>

      <ul className="space-y-2">
        {logs.map((log) => {
          const color = CATEGORY_HEX[log.category] ?? "#6b7280";
          const minutes = durationMinutes(log.startUtc, log.endUtc);
          return (
            <li
              key={log.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white/[0.03] px-3 py-2.5"
              style={{ borderLeft: `3px solid ${color}` }}
            >
              <div className="min-w-[88px] text-[12px] text-white">
                {log.startLocal} – {log.endLocal}
                <div className="text-[10px] text-[var(--text-muted)]">{minutes}m</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-white">{log.activity}</div>
                <div className="truncate text-[11px] text-[var(--text-muted)]">
                  {log.category}
                  {log.withPerson ? ` · ${log.withPerson}` : ""}
                  {log.location ? ` · ${log.location}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(log)}
                  className="btn btn-outline !min-w-0 !px-2.5 !py-1.5 !text-[10px]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(log.id)}
                  className="btn btn-outline !min-w-0 !px-2.5 !py-1.5 !text-[10px]"
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EditLogModal({
  log,
  onClose,
  onSaved,
}: {
  log: ServerLog;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [startLocal, setStartLocal] = useState(log.startLocal);
  const [endLocal, setEndLocal] = useState(log.endLocal);
  const [activity, setActivity] = useState(log.activity);
  const [category, setCategory] = useState(log.category);
  const [withPerson, setWithPerson] = useState(log.withPerson ?? "");
  const [location, setLocation] = useState(log.location ?? "");
  const [notes, setNotes] = useState(log.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/attention/log/${log.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: log.date,
          startLocal,
          endLocal,
          activity,
          category,
          withPerson: withPerson || null,
          location: location || null,
          notes: notes || null,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="heading-font text-2xl text-white">Edit activity</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[var(--text-muted)] hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Start">
            <input
              type="time"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className="w-full"
            />
          </Field>
          <Field label="End">
            <input
              type="time"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              className="w-full"
            />
          </Field>
        </div>
        <Field label="Activity" className="mt-3">
          <input
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            className="w-full"
          />
        </Field>
        <Field label="Category" className="mt-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full"
          >
            {Object.keys(CATEGORY_HEX).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="With">
            <input
              value={withPerson}
              onChange={(e) => setWithPerson(e.target.value)}
              className="w-full"
            />
          </Field>
          <Field label="Location">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full"
            />
          </Field>
        </div>
        <Field label="Notes" className="mt-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full resize-none"
          />
        </Field>
        {err ? <p className="mt-3 text-[12px] text-[var(--warn)]">{err}</p> : null}
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-outline !px-4 !py-2">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !activity.trim()}
            className="btn btn-primary !px-5 !py-2 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label-caps text-[var(--text-muted)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
