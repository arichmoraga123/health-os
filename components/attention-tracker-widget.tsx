"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ATTENTION_CATEGORIES,
  type AttentionCategory,
  CATEGORY_HEX,
} from "@/lib/attention";

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

const ACTIVITY_SUGGESTIONS = [
  "Meeting",
  "Writing",
  "Workout",
  "Eating",
  "Walk",
  "Call",
  "Meditation",
  "Nap",
  "Reading",
  "Coding",
  "Family Time",
  "Cooking",
  "Travel",
];

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function addMinutesHHMM(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hh = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function localTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function durationMinutes(startUtc: string, endUtc: string): number {
  return Math.max(0, Math.round((new Date(endUtc).getTime() - new Date(startUtc).getTime()) / 60000));
}

export function AttentionTrackerWidget({ defaultLocation }: { defaultLocation?: string | null }) {
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(() => localTodayKey());
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attention/logs?date=${today}&t=${Date.now()}`, {
        cache: "no-store",
      });
      const j = await res.json();
      if (res.ok && Array.isArray(j.logs)) setLogs(j.logs);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    setToday(localTodayKey());
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const totalMinutes = useMemo(
    () => logs.reduce((acc, l) => acc + durationMinutes(l.startUtc, l.endUtc), 0),
    [logs],
  );

  return (
    <section className="panel p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps text-[var(--text-muted)]">Today&apos;s log</p>
          <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
            {today} ·{" "}
            <span className="text-white">
              {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
            </span>{" "}
            tracked
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn btn-primary !px-4 !py-2 !text-[12px] uppercase tracking-wide"
        >
          + Log activity
        </button>
      </div>

      <div className="mt-5 space-y-2">
        {loading ? (
          <p className="text-[12px] text-[var(--text-muted)]">Loading…</p>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-white/[0.02] px-4 py-6 text-center text-[12px] text-[var(--text-muted)]">
            No activities logged yet today. Tap{" "}
            <span className="text-white">+ Log activity</span> to start.
          </div>
        ) : (
          logs.map((log) => (
            <LogBlock key={log.id} log={log} />
          ))
        )}
      </div>

      <div className="mt-5 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
        <Link href="/attention" className="text-[var(--ready)] hover:underline">
          View full log →
        </Link>
        <button
          type="button"
          onClick={() => void refresh()}
          className="hover:text-white"
        >
          Refresh
        </button>
      </div>

      {open ? (
        <QuickLogModal
          dateKey={today}
          defaultLocation={defaultLocation ?? undefined}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await refresh();
          }}
        />
      ) : null}
    </section>
  );
}

function LogBlock({ log }: { log: ServerLog }) {
  const color = CATEGORY_HEX[log.category] ?? "#6b7280";
  const minutes = durationMinutes(log.startUtc, log.endUtc);
  return (
    <div
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
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
    </div>
  );
}

export function QuickLogModal({
  dateKey,
  defaultLocation,
  onClose,
  onSaved,
  initial,
}: {
  dateKey: string;
  defaultLocation?: string | null;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<ServerLog>;
}) {
  const seedStart = initial?.startLocal ?? nowHHMM();
  const seedEnd = initial?.endLocal ?? addMinutesHHMM(seedStart, 30);

  const [startLocal, setStartLocal] = useState(seedStart);
  const [endLocal, setEndLocal] = useState(seedEnd);
  const [activity, setActivity] = useState(initial?.activity ?? "");
  const [category, setCategory] = useState<AttentionCategory>(
    (initial?.category as AttentionCategory) ?? "Self-Development",
  );
  const [withPerson, setWithPerson] = useState(initial?.withPerson ?? "");
  const [location, setLocation] = useState(initial?.location ?? defaultLocation ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/attention/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateKey,
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
          <h2 className="heading-font text-2xl text-white">Log activity</h2>
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
            list="activity-suggestions"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="e.g. Writing, Meeting, Workout"
            className="w-full"
          />
          <datalist id="activity-suggestions">
            {ACTIVITY_SUGGESTIONS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>

        <Field label="Category" className="mt-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as AttentionCategory)}
            className="w-full"
          >
            {ATTENTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="With (optional)">
            <input
              value={withPerson ?? ""}
              onChange={(e) => setWithPerson(e.target.value)}
              placeholder="Alone / name"
              className="w-full"
            />
          </Field>
          <Field label="Location (optional)">
            <input
              value={location ?? ""}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City"
              className="w-full"
            />
          </Field>
        </div>

        <Field label="Notes (optional)" className="mt-3">
          <textarea
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full resize-none"
          />
        </Field>

        {err ? (
          <p className="mt-3 text-[12px] text-[var(--warn)]">{err}</p>
        ) : null}

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
