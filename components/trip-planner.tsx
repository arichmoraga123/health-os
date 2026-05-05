"use client";

import { useEffect, useState } from "react";
import { formatDateTimeInZone } from "@/lib/dates";

type Plan = {
  planMarkdown?: string;
  offsetHours?: number;
  tripMeta?: {
    originTz?: string;
    destTz?: string;
    origin?: string;
    destination?: string;
  };
  structuredPlan?: {
    direction?: string;
    preflight_advice?: string;
    inflight_schedule?: Array<{ label: string; start: string; end: string; action: string }>;
    daily_plans?: Array<{ day: number; title: string; body: string; expected_hrv: string; expected_readiness: string }>;
    light_schedule?: Array<{ time: string; instruction: string; code: string }>;
    melatonin_schedule?: Array<{ time: string; dose: string; note: string }>;
    exercise_timing?: string;
    meal_timing?: string;
  };
};

const codeEmoji: Record<string, string> = {
  sleep: "🟢",
  light: "🟡",
  avoid: "🔴",
  caffeine: "☕",
};

export function TripPlanner() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("09:00");
  const [flightDuration, setFlightDuration] = useState(8);
  const [returnDate, setReturnDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/timezone/plan")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.id && d.structuredPlan) {
          setPlan({
            structuredPlan: d.structuredPlan as Plan["structuredPlan"],
            tripMeta: d.tripMeta as Plan["tripMeta"],
            offsetHours: d.offsetHours as number,
            planMarkdown: d.planMarkdown as string,
          });
        }
      })
      .catch(() => {});
  }, []);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/timezone/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          departureDate,
          departureTime,
          flightDuration,
          returnDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate plan");
      setPlan(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const s = plan?.structuredPlan;
  const meta = plan?.tripMeta;
  const originTz = meta?.originTz ?? "UTC";
  const destTz = meta?.destTz ?? "UTC";
  const now = new Date();

  return (
    <div className="space-y-8">
      <section className="panel p-6 md:p-8">
        <h2 className="heading-font text-4xl text-white">Trip planner</h2>
        <p className="mt-2 max-w-2xl text-[13px] text-[var(--text-secondary)]">
          Enter your itinerary. We&apos;ll map timezones, then Claude builds a circadian plan with light, sleep windows,
          melatonin timing, and recovery expectations.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="label-caps">Origin city</span>
            <input
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g. New York"
            />
          </label>
          <label className="block space-y-2">
            <span className="label-caps">Destination city</span>
            <input
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Tokyo"
            />
          </label>
          <label className="block space-y-2">
            <span className="label-caps">Departure date</span>
            <input
              type="date"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
            />
          </label>
          <label className="block space-y-2">
            <span className="label-caps">Departure time</span>
            <input
              type="time"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
            />
          </label>
          <label className="block space-y-2">
            <span className="label-caps">Flight duration (hours)</span>
            <input
              type="number"
              min={1}
              max={24}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
              value={flightDuration}
              onChange={(e) => setFlightDuration(Number(e.target.value))}
            />
          </label>
          <label className="block space-y-2">
            <span className="label-caps">Return date (optional)</span>
            <input
              type="date"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </label>
        </div>
        {error ? <p className="mt-4 text-[13px] text-[var(--hrv)]">{error}</p> : null}
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="mt-6 rounded-full bg-[var(--sleep)] px-8 py-3 text-[13px] font-bold uppercase tracking-wide text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate plan"}
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="panel p-6">
          <p className="label-caps mb-2">Body clock (home)</p>
          <p className="text-2xl text-white">{formatDateTimeInZone(now, originTz)}</p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">{originTz}</p>
        </div>
        <div className="panel p-6">
          <p className="label-caps mb-2">Destination clock</p>
          <p className="text-2xl text-white">{formatDateTimeInZone(now, destTz)}</p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">{destTz}</p>
        </div>
      </section>

      {plan?.offsetHours != null ? (
        <p className="text-center text-[13px] text-[var(--text-secondary)]">
          Estimated zone shift: <span className="text-white font-semibold">{plan.offsetHours.toFixed(1)} h</span>
        </p>
      ) : null}

      {s?.inflight_schedule?.length ? (
        <section className="panel p-6 md:p-8">
          <h3 className="heading-font text-3xl text-white">Flight timeline</h3>
          <div className="mt-6 space-y-3">
            {s.inflight_schedule.map((seg, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-white/[0.03] px-4 py-3"
              >
                <span className="text-[12px] font-semibold text-white">{seg.label}</span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {seg.start} – {seg.end}
                </span>
                <span className="text-[12px] text-[var(--text-secondary)] capitalize">{seg.action}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {s?.daily_plans?.length ? (
        <section className="space-y-4">
          <h3 className="heading-font text-3xl text-white px-1">First days on the ground</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {s.daily_plans.slice(0, 5).map((d) => (
              <div key={d.day} className="panel p-6">
                <p className="label-caps">Day {d.day}</p>
                <h4 className="mt-2 text-lg text-white">{d.title}</h4>
                <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{d.body}</p>
                <div className="mt-4 space-y-1 text-[11px] text-[var(--text-muted)]">
                  <div>HRV: {d.expected_hrv}</div>
                  <div>Readiness: {d.expected_readiness}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {s?.light_schedule?.length ? (
        <section className="panel p-6 md:p-8">
          <h3 className="heading-font text-3xl text-white">Light & cues</h3>
          <ul className="mt-4 space-y-2">
            {s.light_schedule.map((row, i) => (
              <li key={i} className="flex gap-3 text-[13px] text-[var(--text-secondary)]">
                <span>{codeEmoji[row.code] ?? "•"}</span>
                <span className="text-[var(--text-muted)] shrink-0">{row.time}</span>
                <span>{row.instruction}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {s?.melatonin_schedule?.length ? (
        <section className="panel p-6 md:p-8">
          <h3 className="heading-font text-3xl text-white">Melatonin timing</h3>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">General guidance only — consult your clinician.</p>
          <ul className="mt-4 space-y-3">
            {s.melatonin_schedule.map((m, i) => (
              <li key={i} className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-4">
                <div className="text-white font-medium">{m.time}</div>
                <div className="text-[13px] text-[var(--text-secondary)]">{m.dose}</div>
                <div className="text-[12px] text-[var(--text-muted)]">{m.note}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(s?.exercise_timing || s?.meal_timing || s?.preflight_advice || s?.direction) && (
        <section className="grid gap-4 md:grid-cols-2">
          {s.direction ? (
            <div className="panel p-6">
              <p className="label-caps mb-2">Direction</p>
              <p className="text-[13px] text-[var(--text-secondary)]">{s.direction}</p>
            </div>
          ) : null}
          {s.preflight_advice ? (
            <div className="panel p-6 md:col-span-2">
              <p className="label-caps mb-2">Pre-departure</p>
              <p className="text-[13px] text-[var(--text-secondary)]">{s.preflight_advice}</p>
            </div>
          ) : null}
          {s.exercise_timing ? (
            <div className="panel p-6">
              <p className="label-caps mb-2">Exercise</p>
              <p className="text-[13px] text-[var(--text-secondary)]">{s.exercise_timing}</p>
            </div>
          ) : null}
          {s.meal_timing ? (
            <div className="panel p-6">
              <p className="label-caps mb-2">Meals</p>
              <p className="text-[13px] text-[var(--text-secondary)]">{s.meal_timing}</p>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
