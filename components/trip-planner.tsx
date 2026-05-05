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
    flightPlan?: {
      sleepWindows?: Array<{ start: string; end: string; timezone: "origin" | "dest"; note: string }>;
      awakeWindows?: Array<{ start: string; end: string; note: string }>;
      melatoninOnFlight?: string;
      mealStrategy?: string;
    };
    preDeparture?: Array<{ day: -3 | -2 | -1; advice: string; sleepTarget: string }>;
    arrivalDay?: { immediateActions: string; targetBedtime: string; lightExposure: string };
    dailyPlans?: Array<{
      dayNumber: number;
      date: string;
      targetSleep: string;
      targetWake: string;
      lightSeek: string;
      lightAvoid: string;
      exercise: string;
      expectedReadiness: number;
      expectedHRV: number;
      notes: string;
    }>;
    melatoninSchedule?: Array<{ day: number; time: string; dose: string }>;
    caffeineStrategy?: string;
  };
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
          className="btn btn-primary mt-6 disabled:opacity-50"
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

      {s?.flightPlan ? (
        <section className="panel p-6 md:p-8">
          <h3 className="heading-font text-3xl text-white">IN-FLIGHT STRATEGY</h3>
          <div className="mt-4 rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="h-5 bg-yellow-400/40 flex">
              {(s.flightPlan.awakeWindows ?? []).map((w, i) => (
                <div key={`a-${i}`} className="h-full bg-yellow-400/70 flex-1" title={`${w.start}-${w.end}`} />
              ))}
              {(s.flightPlan.sleepWindows ?? []).map((w, i) => (
                <div key={`s-${i}`} className="h-full bg-emerald-400/80 flex-1" title={`${w.start}-${w.end}`} />
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            {(s.flightPlan.sleepWindows ?? []).map((w, i) => (
              <div key={i} className="text-[12px] text-[var(--text-secondary)]">
                🟢 Sleep {w.start}-{w.end} ({w.timezone}) - {w.note}
              </div>
            ))}
            {(s.flightPlan.awakeWindows ?? []).map((w, i) => (
              <div key={i} className="text-[12px] text-[var(--text-secondary)]">
                🟡 Awake {w.start}-{w.end} - {w.note}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-[var(--text-secondary)]">💊 {s.flightPlan.melatoninOnFlight}</p>
          <p className="text-[13px] text-[var(--text-secondary)]">🍽 {s.flightPlan.mealStrategy}</p>
        </section>
      ) : null}

      {s?.dailyPlans?.length ? (
        <section className="space-y-4">
          <h3 className="heading-font text-3xl text-white px-1">First days on the ground</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {s.dailyPlans.slice(0, 5).map((d) => (
              <div key={d.dayNumber} className="panel p-6">
                <p className="label-caps">Day {d.dayNumber}</p>
                <h4 className="mt-2 text-lg text-white">{d.date}</h4>
                <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{d.notes}</p>
                <div className="mt-4 space-y-1 text-[11px] text-[var(--text-muted)]">
                  <div>{d.targetSleep} {"->"} {d.targetWake}</div>
                  <div>Seek: {d.lightSeek}</div>
                  <div>Avoid: {d.lightAvoid}</div>
                  <div>Exercise: {d.exercise}</div>
                  <div>Readiness: {d.expectedReadiness}</div>
                  <div>HRV: {d.expectedHRV}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {s?.preDeparture?.length ? (
        <section className="panel p-6 md:p-8">
          <h3 className="heading-font text-3xl text-white">Pre-departure</h3>
          <ul className="mt-4 space-y-2">
            {s.preDeparture.map((row, i) => (
              <li key={i} className="flex gap-3 text-[13px] text-[var(--text-secondary)]">
                <span className="text-[var(--text-muted)] shrink-0">Day {row.day}</span>
                <span>{row.advice} · Sleep target {row.sleepTarget}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {s?.melatoninSchedule?.length ? (
        <section className="panel p-6 md:p-8">
          <h3 className="heading-font text-3xl text-white">Melatonin timing</h3>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">General guidance only — consult your clinician.</p>
          <ul className="mt-4 space-y-3">
            {s.melatoninSchedule.map((m, i) => (
              <li key={i} className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-4">
                <div className="text-white font-medium">Day {m.day} · {m.time}</div>
                <div className="text-[13px] text-[var(--text-secondary)]">{m.dose}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(s?.arrivalDay || s?.caffeineStrategy) && (
        <section className="grid gap-4 md:grid-cols-2">
          {s.arrivalDay ? (
            <div className="panel p-6 md:col-span-2">
              <p className="label-caps mb-2">Arrival day</p>
              <p className="text-[13px] text-[var(--text-secondary)]">{s.arrivalDay.immediateActions}</p>
              <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                Target bedtime: {s.arrivalDay.targetBedtime} · Light: {s.arrivalDay.lightExposure}
              </p>
            </div>
          ) : null}
          {s.caffeineStrategy ? (
            <div className="panel p-6">
              <p className="label-caps mb-2">Caffeine strategy</p>
              <p className="text-[13px] text-[var(--text-secondary)]">{s.caffeineStrategy}</p>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
