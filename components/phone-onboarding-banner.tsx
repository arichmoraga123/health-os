"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const DIAL = [
  { v: "+1", l: "US +1" },
  { v: "+44", l: "UK +44" },
  { v: "+61", l: "AU +61" },
  { v: "+49", l: "DE +49" },
  { v: "+33", l: "FR +33" },
  { v: "+81", l: "JP +81" },
  { v: "+91", l: "IN +91" },
] as const;

type SettingsShape = {
  phoneNumber: string | null;
};

export function PhoneOnboardingBanner() {
  const [settings, setSettings] = useState<SettingsShape | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [dial, setDial] = useState("+1");
  const [national, setNational] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("healthos_phone_prompt_skip") === "1") {
      setDismissed(true);
    }
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (!res.ok) return;
    const j = (await res.json()) as SettingsShape;
    setSettings(j);
    if (j.phoneNumber?.startsWith("+")) {
      const match = DIAL.find((d) => j.phoneNumber!.startsWith(d.v));
      if (match) {
        setDial(match.v);
        setNational(j.phoneNumber!.slice(match.v.length).replace(/\D/g, ""));
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const skip = () => {
    localStorage.setItem("healthos_phone_prompt_skip", "1");
    setDismissed(true);
  };

  const e164 = `${dial}${national.replace(/\D/g, "")}`;

  const sendTest = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/test-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "SMS failed");
      setMsg("Test SMS sent — check your phone.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (dismissed || !settings || settings.phoneNumber) return null;

  return (
    <section className="mb-4 rounded-[var(--radius-card)] border border-[var(--hrv)]/40 bg-[var(--hrv)]/10 p-4 text-[13px] text-[var(--text-secondary)]">
      <p className="font-medium text-white">
        Add your phone number to get morning health briefs and evening check-in calls.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
          Country
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
        </label>
        <label className="min-w-[160px] flex flex-1 flex-col gap-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
          Mobile
          <input
            value={national}
            onChange={(e) => setNational(e.target.value)}
            placeholder="5551234567"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-white"
          />
        </label>
        <button
          type="button"
          disabled={busy || e164.length < 10}
          onClick={() => void sendTest()}
          className="btn btn-primary !px-4 !py-2 !text-[11px] disabled:opacity-40"
        >
          {busy ? "Sending…" : "Send test message"}
        </button>
        <Link href="/settings" className="btn btn-outline !px-4 !py-2 !text-[11px]">
          All notification settings
        </Link>
        <button type="button" onClick={skip} className="btn btn-outline !px-4 !py-2 !text-[11px]">
          Skip for now
        </button>
      </div>
      {msg ? <p className="mt-2 text-[12px] text-white">{msg}</p> : null}
    </section>
  );
}
