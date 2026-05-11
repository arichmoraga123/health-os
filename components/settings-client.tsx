"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const DIAL = [
  { v: "+1", l: "US +1" },
  { v: "+44", l: "UK +44" },
  { v: "+61", l: "AU +61" },
  { v: "+49", l: "DE +49" },
  { v: "+33", l: "FR +33" },
  { v: "+81", l: "JP +81" },
  { v: "+91", l: "IN +91" },
] as const;

type Row = {
  phoneNumber: string | null;
  phoneVerified: boolean | null;
  notificationEmail: string | null;
  morningMessageTime: string | null;
  eveningCallTime: string | null;
  smsEnabled: boolean | null;
  emailEnabled: boolean | null;
  eveningCallEnabled: boolean | null;
  nightlyEmailEnabled: boolean | null;
  email: string | null;
  homeTimezone?: string | null;
  currentTimezone?: string | null;
};

export function SettingsClient() {
  const [row, setRow] = useState<Row | null>(null);
  const [dial, setDial] = useState("+1");
  const [national, setNational] = useState("");
  const [saving, setSaving] = useState(false);
  const [smsBusy, setSmsBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState<boolean | null>(null);
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null);
  const [driveExpiry, setDriveExpiry] = useState<string | null>(null);
  const [driveRecent, setDriveRecent] = useState<
    Array<{
      fileName: string;
      status: string;
      processedAt: string | null;
      eventsCreated: number;
      error: string | null;
    }>
  >([]);
  const [driveBusy, setDriveBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (!res.ok) return;
    const j = (await res.json()) as Row;
    setRow(j);
    if (j.phoneNumber?.startsWith("+")) {
      const match = DIAL.find((d) => j.phoneNumber!.startsWith(d.v));
      if (match) {
        setDial(match.v);
        setNational(j.phoneNumber!.slice(match.v.length).replace(/\D/g, ""));
      } else {
        setNational(j.phoneNumber.replace(/\D/g, ""));
      }
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  const loadDrive = useCallback(async () => {
    const r = await fetch("/api/drive/setup", { cache: "no-store" });
    const j = (await r.json().catch(() => ({}))) as {
      connected?: boolean;
      channelExpiry?: string | null;
      recentFiles?: Array<{
        fileName: string;
        status: string;
        processedAt: string | null;
        eventsCreated: number;
        error: string | null;
      }>;
    };
    if (r.ok) {
      setDriveConnected(!!j.connected);
      setDriveExpiry(j.channelExpiry ?? null);
      setDriveRecent(j.recentFiles ?? []);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/calendar/status", { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { connected?: boolean };
      if (r.ok) setGoogleCalendarConnected(!!j.connected);
    })();
    void loadDrive();
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("calendar") === "connected") {
        setTimeout(() => setNote("Google Calendar connected."), 0);
      }
    }
  }, [loadDrive]);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    setNote(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setNote("Saved.");
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
      setTimeout(() => setNote(null), 2400);
    }
  };

  const saveAll = () => {
    if (!row) return;
    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const e164 =
      national.replace(/\D/g, "").length > 0 ? `${dial}${national.replace(/\D/g, "")}` : null;
    void patch({
      phoneNumber: e164,
      notificationEmail: row.notificationEmail || null,
      morningMessageTime: row.morningMessageTime,
      eveningCallTime: row.eveningCallTime,
      smsEnabled: row.smsEnabled,
      emailEnabled: row.emailEnabled,
      eveningCallEnabled: row.eveningCallEnabled,
      nightlyEmailEnabled: row.nightlyEmailEnabled,
      homeTimezone: detectedTz,
      currentTimezone: detectedTz,
    });
  };

  const sendTest = async () => {
    const e164 = `${dial}${national.replace(/\D/g, "")}`;
    setSmsBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/settings/test-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "SMS failed");
      setNote("Test SMS sent.");
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "SMS error");
    } finally {
      setSmsBusy(false);
    }
  };

  if (!row) {
    return <p className="text-[var(--text-secondary)]">Loading settings…</p>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {note ? <p className="text-[12px] text-[var(--ready)]">{note}</p> : null}

      <section className="panel space-y-4 p-5">
        <h2 className="text-[15px] font-semibold text-white">Google Calendar</h2>
        <p className="text-[12px] text-[var(--text-secondary)]">
          Connect your Google account so we can log each night&apos;s sleep as a private calendar block after the morning
          sync (and from the dashboard). Drive import uses the same connection; reconnect after enabling Drive if prompted.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/api/calendar/auth" className="btn btn-primary !px-5 !py-2 !text-[12px]">
            Connect Google Calendar
          </a>
          {googleCalendarConnected === true ? (
            <span className="text-[12px] text-[var(--ready)]">Connected</span>
          ) : googleCalendarConnected === false ? (
            <span className="text-[12px] text-[var(--text-muted)]">Not connected</span>
          ) : null}
        </div>
      </section>

      <section className="panel space-y-4 p-5">
        <h2 className="text-[15px] font-semibold text-white">Attention tracker — Google Drive</h2>
        <p className="text-[12px] text-[var(--text-secondary)]">
          Connect your Google Drive so we can watch the folder{" "}
          <span className="text-white">Google Drive / attention tracker / files</span> and import activity markdown
          automatically.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12px] text-[var(--text-muted)]">Status:</span>
          {driveConnected === true ? (
            <span className="text-[12px] text-[var(--ready)]">Connected</span>
          ) : driveConnected === false ? (
            <span className="text-[12px] text-[var(--text-muted)]">Not connected</span>
          ) : (
            <span className="text-[12px] text-[var(--text-muted)]">—</span>
          )}
          {driveExpiry ? (
            <span className="text-[11px] text-[var(--text-secondary)]">
              Channel renews before {new Date(driveExpiry).toLocaleString()}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          disabled={driveBusy || googleCalendarConnected === false}
          onClick={async () => {
            setDriveBusy(true);
            setNote(null);
            try {
              const res = await fetch("/api/drive/setup", { method: "POST" });
              const j = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(j.error ?? "Setup failed");
              setNote(j.message ?? "Drive watching enabled.");
              await loadDrive();
            } catch (e) {
              setNote(e instanceof Error ? e.message : "Drive setup error");
            } finally {
              setDriveBusy(false);
            }
          }}
          className="btn btn-primary !px-5 !py-2 !text-[12px] disabled:opacity-40"
        >
          {driveBusy ? "Working…" : "Setup Drive watching"}
        </button>
        {googleCalendarConnected === false ? (
          <p className="text-[11px] text-[var(--warn)]">Connect Google Calendar first (Drive uses the same OAuth tokens).</p>
        ) : null}
        <div className="text-[12px] text-[var(--text-secondary)]">
          <p className="font-medium text-white">How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Upload your daily markdown file to that folder.</li>
            <li>We detect changes within minutes via Google push notifications.</li>
            <li>Activities are saved and calendar events are created when possible.</li>
            <li>No manual import step on this site.</li>
          </ol>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Recent imports</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <th className="py-2 pr-2 font-medium">File</th>
                  <th className="py-2 pr-2 font-medium">Status</th>
                  <th className="py-2 pr-2 font-medium">Events</th>
                  <th className="py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {driveRecent.length ? (
                  driveRecent.map((r, i) => (
                    <tr key={`${r.fileName}-${i}`} className="border-b border-[var(--border)]/60 text-[var(--text-secondary)]">
                      <td className="py-2 pr-2 text-white">{r.fileName}</td>
                      <td className="py-2 pr-2">
                        <span
                          className={
                            r.status === "success"
                              ? "text-[var(--ready)]"
                              : r.status === "skipped"
                                ? "text-[var(--text-muted)]"
                                : "text-[var(--warn)]"
                          }
                        >
                          {r.status}
                        </span>
                        {r.error ? (
                          <span className="ml-1 text-[11px] text-[var(--warn)]" title={r.error}>
                            ({r.error.slice(0, 48)}
                            {r.error.length > 48 ? "…" : ""})
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2">{r.eventsCreated}</td>
                      <td className="py-2">
                        {r.processedAt ? new Date(r.processedAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-3 text-[var(--text-muted)]">
                      No imports yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel space-y-4 p-5">
        <h2 className="text-[15px] font-semibold text-white">Phone</h2>
        <p className="text-[12px] text-[var(--text-secondary)]">
          E.164 format with country code. Used for morning SMS and evening voice calls.
          {row.phoneVerified ? (
            <span className="ml-2 text-[var(--ready)]">Verified</span>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            value={dial}
            onChange={(e) => setDial(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-[13px] text-white"
          >
            {DIAL.map((d) => (
              <option key={d.v} value={d.v}>
                {d.l}
              </option>
            ))}
          </select>
          <input
            value={national}
            onChange={(e) => setNational(e.target.value)}
            placeholder="Mobile number"
            className="min-w-[200px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-white"
          />
          <button
            type="button"
            disabled={smsBusy || `${dial}${national.replace(/\D/g, "")}`.length < 10}
            onClick={() => void sendTest()}
            className="btn btn-outline !px-4 !py-2 !text-[11px] disabled:opacity-40"
          >
            {smsBusy ? "Sending…" : "Send test SMS"}
          </button>
        </div>
      </section>

      <section className="panel space-y-4 p-5">
        <h2 className="text-[15px] font-semibold text-white">Email</h2>
        <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
          Notification email (optional)
          <input
            type="email"
            value={row.notificationEmail ?? ""}
            onChange={(e) => setRow({ ...row, notificationEmail: e.target.value || null })}
            placeholder={row.email ?? "you@example.com"}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-white"
          />
        </label>
        <p className="text-[12px] text-[var(--text-secondary)]">
          Login email: <span className="text-white">{row.email ?? "—"}</span>
        </p>
      </section>

      <section className="panel space-y-4 p-5">
        <h2 className="text-[15px] font-semibold text-white">Schedule (your timezone)</h2>
        <p className="text-[12px] text-[var(--text-secondary)]">
          Uses your home/current timezone from Health OS. Cron runs hourly in UTC; we only message you
          during these local windows.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Morning message
            <input
              type="time"
              value={row.morningMessageTime ?? "10:00"}
              onChange={(e) => setRow({ ...row, morningMessageTime: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-white"
            />
          </label>
          <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Evening call
            <input
              type="time"
              value={row.eveningCallTime ?? "21:00"}
              onChange={(e) => setRow({ ...row, eveningCallTime: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-white"
            />
          </label>
        </div>
      </section>

      <section className="panel space-y-3 p-5">
        <h2 className="text-[15px] font-semibold text-white">Channels</h2>
        {(
          [
            ["smsEnabled", "Morning & evening SMS"],
            ["emailEnabled", "Morning email brief"],
            ["eveningCallEnabled", "Evening voice call"],
            ["nightlyEmailEnabled", "Nightly markdown report by email"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-3 text-[13px] text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={!!row[key]}
              onChange={(e) => setRow({ ...row, [key]: e.target.checked })}
              className="size-4 accent-[var(--ready)]"
            />
            {label}
          </label>
        ))}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveAll()}
          className="btn btn-primary !px-6 !py-2 !text-[12px] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        <Link href="/dashboard" className="btn btn-outline !px-6 !py-2 !text-[12px]">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
