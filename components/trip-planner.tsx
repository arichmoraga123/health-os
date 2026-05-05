"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDateTimeInZone } from "@/lib/dates";
import type { Phase5StructuredPlan, FlightTimelineSegment } from "@/lib/trip-plan-types";

type Baseline = {
  readinessToday: number | null;
  hrv7DayAverage: number | null;
  chronotype: string;
  avgBedtime14d: string;
  avgWake14d: string;
  avgSleepHours14d: number | null;
  travelReadiness: { score: number; band: string; interpretation: string };
};

type TripMeta = {
  origin?: string;
  destination?: string;
  originTz?: string;
  destTz?: string;
  departureDate?: string;
  departureTime?: string;
  flightDuration?: number;
  returnDate?: string;
  airline?: string;
  flightNumber?: string;
  firstCommitment?: { date?: string; time?: string; type?: string };
  travelDirection?: string;
  landingDateDest?: string;
};

type Plan = {
  planMarkdown?: string;
  offsetHours?: number;
  tripMeta?: TripMeta;
  structuredPlan?: Phase5StructuredPlan;
  travelReadiness?: Baseline["travelReadiness"];
};

type TabId = "preflight" | "inflight" | "arrival" | "recovery";

function RingGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 3.5 A8.5 8.5 0 0 1 19.2 8.2" />
    </svg>
  );
}

function chronotypeLabel(ct: string) {
  if (ct === "early_riser") return "Early riser (avg wake before ~6:30)";
  if (ct === "night_owl") return "Night owl (avg wake after ~8:00)";
  return "Intermediate chronotype";
}

function readinessBandStyle(band: string) {
  if (band === "optimal") return { bg: "from-emerald-500/25 to-emerald-600/10", ring: "text-emerald-400", label: "Optimal" };
  if (band === "good") return { bg: "from-amber-400/20 to-amber-600/10", ring: "text-amber-300", label: "Good" };
  return { bg: "from-rose-500/25 to-rose-900/20", ring: "text-rose-400", label: "At risk" };
}

function segmentColor(seg: FlightTimelineSegment) {
  switch (seg.phase) {
    case "sleep":
      return "bg-emerald-500/85";
    case "awake":
      return "bg-amber-400/80";
    case "wind_down":
      return "bg-sky-500/70";
    case "caffeine":
      return "bg-orange-400/90";
    case "melatonin":
      return "bg-violet-500/80";
    default:
      return "bg-white/20";
  }
}

function segmentIcon(seg: FlightTimelineSegment) {
  if (seg.phase === "caffeine") return "☕";
  if (seg.phase === "melatonin") return "💊";
  if (seg.phase === "sleep") return "🟢";
  if (seg.phase === "awake") return "🟡";
  if (seg.phase === "wind_down") return "🔵";
  return "";
}

export function TripPlanner() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("09:00");
  const [flightDuration, setFlightDuration] = useState(8);
  const [returnDate, setReturnDate] = useState("");
  const [airline, setAirline] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [commitmentDate, setCommitmentDate] = useState("");
  const [commitmentTime, setCommitmentTime] = useState("09:00");
  const [commitmentType, setCommitmentType] = useState("board_meeting");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("preflight");
  const [recovery, setRecovery] = useState<{
    active?: boolean;
    message?: string;
    status?: string;
    todayReadiness?: number | null;
    todayHrv?: number | null;
    predictedReadiness?: number | null;
    predictedHrvPct?: number | null;
    daysSinceLanding?: number;
  } | null>(null);
  const [checkInReadiness, setCheckInReadiness] = useState("");
  const [checkInHrv, setCheckInHrv] = useState("");
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [hintOriginTz, setHintOriginTz] = useState<string | null>(null);
  const [hintDestTz, setHintDestTz] = useState<string | null>(null);

  const loadBaseline = useCallback(() => {
    fetch("/api/timezone/baseline")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.travelReadiness?.score === "number") setBaseline(d as Baseline);
      })
      .catch(() => {});
  }, []);

  const loadRecovery = useCallback(() => {
    fetch("/api/timezone/recovery", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (r.ok) setRecovery(d);
        else setRecovery(null);
      })
      .catch(() => setRecovery(null));
  }, []);

  useEffect(() => {
    loadBaseline();
  }, [loadBaseline]);

  useEffect(() => {
    fetch("/api/timezone/plan")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.id && d.structuredPlan) {
          setPlan({
            structuredPlan: d.structuredPlan as Phase5StructuredPlan,
            tripMeta: d.tripMeta as TripMeta,
            offsetHours: d.offsetHours as number,
            planMarkdown: d.planMarkdown as string,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRecovery();
  }, [loadRecovery, plan?.tripMeta?.departureDate]);

  useEffect(() => {
    if (!origin.trim()) {
      setHintOriginTz(null);
      return;
    }
    const t = setTimeout(() => {
      void fetch(`/api/timezone/resolve?q=${encodeURIComponent(origin.trim())}`)
        .then((r) => r.json())
        .then((d: { timeZone?: string | null }) => setHintOriginTz(d.timeZone ?? null))
        .catch(() => setHintOriginTz(null));
    }, 350);
    return () => clearTimeout(t);
  }, [origin]);

  useEffect(() => {
    if (!destination.trim()) {
      setHintDestTz(null);
      return;
    }
    const t = setTimeout(() => {
      void fetch(`/api/timezone/resolve?q=${encodeURIComponent(destination.trim())}`)
        .then((r) => r.json())
        .then((d: { timeZone?: string | null }) => setHintDestTz(d.timeZone ?? null))
        .catch(() => setHintDestTz(null));
    }, 350);
    return () => clearTimeout(t);
  }, [destination]);

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
          airline,
          flightNumber,
          firstCommitment:
            commitmentDate && commitmentTime
              ? { date: commitmentDate, time: commitmentTime, type: commitmentType }
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate plan");
      setPlan(data);
      if (data.travelReadiness) {
        setBaseline((b) =>
          b
            ? { ...b, travelReadiness: data.travelReadiness }
            : ({
                readinessToday: null,
                hrv7DayAverage: null,
                chronotype: data.tripMeta?.chronotype ?? "intermediate",
                avgBedtime14d: "—",
                avgWake14d: "—",
                avgSleepHours14d: null,
                travelReadiness: data.travelReadiness,
              } as Baseline),
        );
      }
      loadBaseline();
      loadRecovery();
      setTab("preflight");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function submitCheckIn() {
    setCheckInBusy(true);
    try {
      const res = await fetch("/api/timezone/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readiness: checkInReadiness ? Number(checkInReadiness) : undefined,
          hrv: checkInHrv ? Number(checkInHrv) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Check-in failed");
      setCheckInReadiness("");
      setCheckInHrv("");
      loadRecovery();
    } catch {
      setError("Could not log recovery check-in.");
    } finally {
      setCheckInBusy(false);
    }
  }

  const s = plan?.structuredPlan;
  const meta = plan?.tripMeta;
  const originTz = hintOriginTz ?? meta?.originTz ?? "UTC";
  const destTz = hintDestTz ?? meta?.destTz ?? "UTC";
  const now = new Date();

  const readinessForCard = plan?.travelReadiness ?? baseline?.travelReadiness;
  const rs = readinessForCard?.score ?? baseline?.travelReadiness.score ?? 0;
  const rb = readinessForCard?.band ?? baseline?.travelReadiness.band ?? "good";
  const bandStyle = readinessBandStyle(rb);

  const chronotype = s?.serverMeta?.chronotype ?? baseline?.chronotype ?? "intermediate";
  const directionLabel = meta?.travelDirection ?? s?.serverMeta?.travelDirection ?? "—";

  const flightH = meta?.flightDuration ?? flightDuration;
  const segments = s?.flightTimeline?.segments ?? [];
  const segmentWidths = useMemo(() => {
    if (!segments.length || !flightH) return [];
    return segments.map((seg) => {
      const span = Math.max(0, seg.endHourOfFlight - seg.startHourOfFlight);
      return { seg, pct: (span / flightH) * 100 };
    });
  }, [segments, flightH]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "preflight", label: "Pre-flight" },
    { id: "inflight", label: "In-flight" },
    { id: "arrival", label: "Arrival" },
    { id: "recovery", label: "Recovery" },
  ];

  const headerSummary =
    meta?.origin && meta?.destination
      ? `${meta.origin} → ${meta.destination} · ${meta.departureDate ?? ""} · ${meta.flightDuration ?? flightH}h`
      : "Trip planner";

  return (
    <div className="space-y-8">
      <section className="panel p-6 md:p-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="heading-font text-4xl text-white">Trip planner</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--text-secondary)]">
              Circadian protocol built from your Oura baseline, trip direction, and your first high-stakes commitment.
              Every block below is designed to reference your real readiness and HRV numbers — not generic jet lag tips.
            </p>
          </div>
          <Link href="/" className="text-[12px] text-[var(--text-muted)] hover:text-white">
            ← Dashboard
          </Link>
        </div>

        {baseline ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-4">
              <p className="label-caps flex items-center gap-2 text-[var(--text-muted)]">
                <RingGlyph className="text-[var(--ready)]" />
                Readiness (latest)
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">{baseline.readinessToday ?? "—"}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-4">
              <p className="label-caps flex items-center gap-2 text-[var(--text-muted)]">
                <RingGlyph className="text-[var(--hrv)]" />
                HRV 7-day avg
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {baseline.hrv7DayAverage != null ? `${Math.round(baseline.hrv7DayAverage)} ms` : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-4">
              <p className="label-caps text-[var(--text-muted)]">Chronotype (14 nights)</p>
              <p className="mt-2 text-[15px] font-medium text-white">{chronotypeLabel(baseline.chronotype)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-4">
              <p className="label-caps text-[var(--text-muted)]">Avg sleep window</p>
              <p className="mt-2 text-[15px] text-white">
                {baseline.avgBedtime14d} → {baseline.avgWake14d}
              </p>
              {baseline.avgSleepHours14d != null ? (
                <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                  ~{baseline.avgSleepHours14d.toFixed(1)} h sleep/night (Oura)
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-[12px] text-[var(--text-muted)]">Loading Oura baseline…</p>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="label-caps">Origin city</span>
            <input
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g. New York"
            />
            {origin ? (
              <span className="text-[11px] text-[var(--text-muted)]">Detected TZ: {originTz}</span>
            ) : null}
          </label>
          <label className="block space-y-2">
            <span className="label-caps">Destination city</span>
            <input
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Singapore"
            />
            {destination ? (
              <span className="text-[11px] text-[var(--text-muted)]">Detected TZ: {destTz}</span>
            ) : null}
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
          <label className="block space-y-2 md:col-span-2">
            <span className="label-caps">Airline / flight number (optional)</span>
            <div className="flex gap-2">
              <input
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
                value={airline}
                onChange={(e) => setAirline(e.target.value)}
                placeholder="Airline"
              />
              <input
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value)}
                placeholder="UA 1"
              />
            </div>
          </label>
        </div>

        <div className="mt-8 rounded-2xl border border-[var(--border)] bg-white/[0.02] p-5 md:p-6">
          <p className="label-caps text-[var(--ready)]">First important commitment (destination)</p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            The model works backwards from this event — include date & time in destination-local terms.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="block space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Date</span>
              <input
                type="date"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
                value={commitmentDate}
                onChange={(e) => setCommitmentDate(e.target.value)}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Time</span>
              <input
                type="time"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
                value={commitmentTime}
                onChange={(e) => setCommitmentTime(e.target.value)}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Type</span>
              <select
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
                value={commitmentType}
                onChange={(e) => setCommitmentType(e.target.value)}
              >
                <option value="board_meeting">Board meeting</option>
                <option value="surgery">Surgery</option>
                <option value="keynote">Keynote</option>
                <option value="negotiation">Negotiation</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
        </div>

        {readinessForCard ? (
          <div
            className={`mt-8 overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br p-6 md:p-8 ${bandStyle.bg}`}
          >
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="label-caps text-white/80">Travel readiness score</p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-6xl font-semibold tracking-tight text-white">{rs}</span>
                  <span className={`text-sm font-medium uppercase tracking-widest ${bandStyle.ring}`}>
                    {bandStyle.label}
                  </span>
                </div>
                <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-white/90">
                  {readinessForCard.interpretation}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[12px] text-white/80">
                <p>Direction: {directionLabel}</p>
                {plan?.offsetHours != null ? (
                  <p className="mt-1">Zone shift ≈ {plan.offsetHours.toFixed(1)} h</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-4 text-[13px] text-[var(--hrv)]">{error}</p> : null}
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="btn btn-primary mt-6 disabled:opacity-50"
        >
          {loading ? "Generating…" : "Generate circadian plan"}
        </button>
      </section>

      {s ? (
        <>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-4 md:px-6">
            <p className="text-center text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Active itinerary
            </p>
            <p className="mt-1 text-center text-lg font-semibold text-white md:text-xl">{headerSummary}</p>
            {meta?.landingDateDest ? (
              <p className="mt-1 text-center text-[12px] text-[var(--text-muted)]">
                Landing date ({destTz}): {meta.landingDateDest}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-center gap-2 border-b border-[var(--border)] pb-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-wider transition ${
                  tab === t.id
                    ? "bg-white text-black"
                    : "text-[var(--text-muted)] hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "preflight" ? (
            <div className="space-y-8">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="panel p-6">
                  <p className="label-caps flex items-center gap-2">
                    <RingGlyph className="text-[var(--ready)]" />
                    Chronotype protocol
                  </p>
                  <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">
                    {s.chronotypeAdvice ?? `Detected chronotype: ${chronotypeLabel(chronotype)}. Generate a fresh plan for tailored copy.`}
                  </p>
                </div>
                <div className="panel p-6">
                  <p className="label-caps">Direction science</p>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-[13px] text-[var(--text-secondary)]">
                    {(s.directionScience?.bullets ?? []).map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {s.executiveSummary ? (
                <div className="panel p-6 md:p-8">
                  <h3 className="heading-font text-2xl text-white">Executive summary</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">{s.executiveSummary}</p>
                </div>
              ) : null}

              {s.sleepBanking ? (
                <div className="panel p-6 md:p-8">
                  <h3 className="heading-font text-2xl text-white">Sleep banking</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">{s.sleepBanking.narrative}</p>
                  <div className="mt-4 flex flex-wrap gap-4 text-[13px] text-white">
                    <div className="rounded-xl border border-[var(--border)] bg-white/[0.04] px-4 py-3">
                      Target in-bed hours: <strong>{s.sleepBanking.targetSleepHours} h</strong>
                    </div>
                    <div className="rounded-xl border border-[var(--border)] bg-white/[0.04] px-4 py-3">
                      Reserve to build: <strong>~{s.sleepBanking.hoursToBankTotal} h</strong> (cap benefit ~5 h)
                    </div>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {(s.sleepBanking.dailyChecklist ?? []).map((c, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-white/[0.03] p-4 text-[13px] text-[var(--text-secondary)]"
                      >
                        <span className="mt-0.5 text-[var(--text-muted)]">□</span>
                        <span>
                          <span className="font-medium text-white">{c.dayLabel}</span> — target {c.targetHours} h.{" "}
                          {c.tip}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-4">
                <h3 className="heading-font px-1 text-2xl text-white">Pre-departure shift (-3 to -1)</h3>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {(s.preDepartureDays ?? []).map((d, i) => (
                    <div
                      key={i}
                      className="min-w-[280px] shrink-0 rounded-2xl border border-[var(--border)] bg-white/[0.03] p-5"
                    >
                      <p className="text-[11px] uppercase tracking-wider text-[var(--ready)]">{d.dayLabel}</p>
                      {d.date ? <p className="text-[12px] text-[var(--text-muted)]">{d.date}</p> : null}
                      <p className="mt-3 text-white">
                        <span className="text-[var(--text-muted)]">Bed → wake:</span> {d.bedtime} · {d.wake}
                      </p>
                      <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
                        Bright light: {d.brightLight}
                        <br />
                        Avoid bright: {d.avoidBrightLight}
                        <br />
                        Melatonin: {d.melatonin ?? "—"}
                        <br />
                        Exercise: {d.exercise}
                        <br />
                        Caffeine cutoff: {d.caffeineCutoff}
                      </p>
                    </div>
                  ))}
                  {(s.preDeparture ?? []).map((row, i) => (
                    <div key={`legacy-${i}`} className="min-w-[240px] shrink-0 rounded-2xl border border-dashed border-[var(--border)] p-4 text-[12px] text-[var(--text-secondary)]">
                      Day {row.day}: {row.advice} · Sleep {row.sleepTarget}
                    </div>
                  ))}
                </div>
              </div>

              {s.caffeineTimelineDays?.length ? (
                <div className="panel p-6 md:p-8">
                  <h3 className="heading-font text-2xl text-white">Caffeine windows</h3>
                  <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                    Green = permitted windows; red = hard avoid (delays phase shift if violated).
                  </p>
                  <div className="mt-6 space-y-4">
                    {s.caffeineTimelineDays.map((day, i) => (
                      <div key={i} className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-4">
                        <p className="text-[13px] font-medium text-white">{day.dayLabel}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(day.okWindows ?? []).map((w, j) => (
                            <span
                              key={`ok-${j}`}
                              className="rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-200"
                            >
                              OK: {w}
                            </span>
                          ))}
                          {(day.avoidWindows ?? []).map((w, j) => (
                            <span
                              key={`no-${j}`}
                              className="rounded-lg bg-rose-500/20 px-2 py-1 text-[11px] text-rose-200"
                            >
                              Avoid: {w}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {s.caffeineStrategy ? (
                    <p className="mt-4 text-[13px] text-[var(--text-secondary)]">{s.caffeineStrategy}</p>
                  ) : null}
                </div>
              ) : s.caffeineStrategy ? (
                <div className="panel p-6">
                  <h3 className="heading-font text-2xl text-white">Caffeine</h3>
                  <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{s.caffeineStrategy}</p>
                </div>
              ) : null}

              {s.melatoninSchedule?.length ? (
                <div className="panel p-6">
                  <h3 className="heading-font text-2xl text-white">Melatonin</h3>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">Educational only — confirm with your clinician.</p>
                  <ul className="mt-4 space-y-2">
                    {s.melatoninSchedule.map((m, i) => (
                      <li key={i} className="text-[13px] text-[var(--text-secondary)]">
                        Day {m.day} · {m.time} · {m.dose}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "inflight" ? (
            <div className="space-y-8">
              {s.performanceFraming ? (
                <div className="panel border-[var(--ready)]/30 bg-[var(--ready)]/5 p-6 md:p-8">
                  <h3 className="heading-font text-2xl text-white">Performance framing</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-secondary)]">{s.performanceFraming}</p>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="panel p-6">
                  <p className="label-caps">Body clock (origin)</p>
                  <p className="mt-2 text-2xl text-white">{formatDateTimeInZone(now, originTz)}</p>
                  <p className="text-[12px] text-[var(--text-muted)]">{originTz}</p>
                </div>
                <div className="panel p-6">
                  <p className="label-caps">Destination clock (now)</p>
                  <p className="mt-2 text-2xl text-white">{formatDateTimeInZone(now, destTz)}</p>
                  <p className="text-[12px] text-[var(--text-muted)]">{destTz}</p>
                </div>
              </div>

              {s.flightPlan?.timesSummary ? (
                <div className="panel grid gap-3 p-6 text-[13px] text-[var(--text-secondary)] md:grid-cols-2">
                  <div>Depart (origin local): {s.flightPlan.timesSummary.departOriginLocal}</div>
                  <div>Land (dest local): {s.flightPlan.timesSummary.landDestLocal}</div>
                  <div>Dest time at boarding: {s.flightPlan.timesSummary.destTimeAtBoarding}</div>
                  <div>Dest time at landing: {s.flightPlan.timesSummary.destTimeAtLanding}</div>
                </div>
              ) : null}

              {segmentWidths.length ? (
                <div className="panel p-6 md:p-8">
                  <h3 className="heading-font text-2xl text-white">Flight timeline</h3>
                  <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                    Bar = full flight ({flightH} h). Green sleep, yellow awake, blue wind-down, ☕ caffeine, 💊 melatonin.
                  </p>
                  <div className="mt-6 flex h-14 w-full overflow-hidden rounded-xl border border-[var(--border)]">
                    {segmentWidths.map(({ seg, pct }, i) => (
                      <div
                        key={i}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                        className={`relative flex min-w-0 items-center justify-center border-r border-black/20 ${segmentColor(seg)}`}
                        title={`${seg.label} (${seg.startHourOfFlight}–${seg.endHourOfFlight}h)`}
                      >
                        <span className="text-[10px] font-bold text-black/80">{segmentIcon(seg)}</span>
                      </div>
                    ))}
                  </div>
                  <ul className="mt-4 space-y-2">
                    {segments.map((seg, i) => (
                      <li key={i} className="text-[12px] text-[var(--text-secondary)]">
                        <span className="text-white">{segmentIcon(seg)}</span> h{seg.startHourOfFlight}–{seg.endHourOfFlight}:{" "}
                        {seg.label}
                        {seg.detail ? ` — ${seg.detail}` : ""}
                      </li>
                    ))}
                  </ul>
                  {s.flightTimeline?.narrative ? (
                    <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-secondary)]">{s.flightTimeline.narrative}</p>
                  ) : null}
                </div>
              ) : null}

              {s.flightPlan ? (
                <div className="panel space-y-4 p-6 md:p-8">
                  <h3 className="heading-font text-2xl text-white">In-flight execution</h3>
                  <div className="grid gap-2 text-[13px] text-[var(--text-secondary)]">
                    {(s.flightPlan.sleepWindows ?? []).map((w, i) => (
                      <div key={`s-${i}`}>
                        🟢 Sleep {w.start}–{w.end} ({w.timezone}) — {w.note}
                      </div>
                    ))}
                    {(s.flightPlan.awakeWindows ?? []).map((w, i) => (
                      <div key={`a-${i}`}>
                        🟡 Awake {w.start}–{w.end} — {w.note}
                      </div>
                    ))}
                  </div>
                  <p className="text-[13px] text-[var(--text-secondary)]">💊 {s.flightPlan.melatoninOnFlight}</p>
                  <p className="text-[13px] text-[var(--text-secondary)]">🍽 {s.flightPlan.mealStrategy}</p>
                  {s.flightPlan.hydrationMlPerHour ? (
                    <p className="text-[13px] text-[var(--text-secondary)]">
                      Hydration target: ~{s.flightPlan.hydrationMlPerHour} ml per flight hour (adjust for medical advice).
                    </p>
                  ) : null}
                  <ul className="list-disc space-y-1 pl-5 text-[12px] text-[var(--text-muted)]">
                    {(s.flightPlan.seatAndGear ?? []).map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                  {s.flightPlan.screenPolicy ? (
                    <p className="text-[12px] text-[var(--text-secondary)]">Screens: {s.flightPlan.screenPolicy}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "arrival" ? (
            <div className="space-y-6">
              {s.arrivalProtocol ? (
                <div className="panel p-6 md:p-8">
                  <h3 className="heading-font text-2xl text-white">Arrival protocol</h3>
                  <ul className="mt-4 space-y-3 text-[14px] text-[var(--text-secondary)]">
                    <li>
                      <span className="text-white">Hotel / check-in:</span> {s.arrivalProtocol.hotelCheckIn}
                    </li>
                    <li>
                      <span className="text-white">Nap rule:</span> {s.arrivalProtocol.napRule}
                    </li>
                    <li>
                      <span className="text-white">First meal:</span> {s.arrivalProtocol.firstMeal}
                    </li>
                    <li>
                      <span className="text-white">Bright light:</span> {s.arrivalProtocol.brightLightWindow}
                    </li>
                    <li>
                      <span className="text-white">Exercise:</span> {s.arrivalProtocol.exercise}
                    </li>
                  </ul>
                  <p className="mt-4 text-[12px] font-medium text-rose-200/90">Avoid</p>
                  <ul className="list-disc pl-5 text-[13px] text-[var(--text-secondary)]">
                    {(s.arrivalProtocol.avoidList ?? []).map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {s.arrivalDay ? (
                <div className="panel p-6">
                  <h3 className="heading-font text-xl text-white">Arrival day (condensed)</h3>
                  <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{s.arrivalDay.immediateActions}</p>
                  <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                    Target bedtime: {s.arrivalDay.targetBedtime} · Light: {s.arrivalDay.lightExposure}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "recovery" ? (
            <div className="space-y-6">
              <div className="panel p-6">
                <h3 className="heading-font text-2xl text-white">Real-time recovery</h3>
                <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
                  {recovery?.message ??
                    "After landing, open this tab to compare modeled recovery vs your live Oura readiness and HRV."}
                </p>
                {recovery?.daysSinceLanding != null && recovery.daysSinceLanding >= 0 ? (
                  <div className="mt-4">
                    <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                      Adaptation progress (model)
                    </p>
                    <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[var(--ready)]"
                        style={{ width: `${Math.min(100, (recovery.daysSinceLanding / 5) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">Target: stable performance by day ~5.</p>
                  </div>
                ) : null}
              </div>

              <div className="panel p-6">
                <p className="label-caps">Log check-in</p>
                <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                  Optional manual entry (defaults to today in your profile timezone on the server).
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <input
                    type="number"
                    placeholder="Readiness"
                    className="w-32 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-white"
                    value={checkInReadiness}
                    onChange={(e) => setCheckInReadiness(e.target.value)}
                  />
                  <input
                    type="number"
                    placeholder="HRV"
                    className="w-32 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-white"
                    value={checkInHrv}
                    onChange={(e) => setCheckInHrv(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={checkInBusy}
                    onClick={submitCheckIn}
                    className="btn btn-outline disabled:opacity-50"
                  >
                    {checkInBusy ? "Saving…" : "Save check-in"}
                  </button>
                </div>
              </div>

              {s.dailyPlans?.length ? (
                <div>
                  <h3 className="heading-font mb-4 px-1 text-2xl text-white">First 5 days on the ground</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {s.dailyPlans.slice(0, 5).map((d) => (
                      <div key={d.dayNumber} className="panel p-6">
                        <p className="label-caps">Day {d.dayNumber}</p>
                        <h4 className="mt-2 text-lg text-white">{d.date}</h4>
                        {d.highStakesWarning ? (
                          <p className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-[12px] text-amber-100">
                            {d.highStakesWarning}
                          </p>
                        ) : null}
                        <p className="mt-3 text-[13px] text-[var(--text-secondary)]">{d.notes}</p>
                        <div className="mt-4 space-y-1 text-[11px] text-[var(--text-muted)]">
                          <div className="flex items-center gap-2 text-white">
                            <RingGlyph className="text-[var(--text-muted)]" />
                            Sleep {d.targetSleep} → wake {d.targetWake}
                          </div>
                          <div>Light seek: {d.lightSeek}</div>
                          <div>Light avoid: {d.lightAvoid}</div>
                          <div>Exercise: {d.exercise}</div>
                          <div>
                            Expected readiness: <span className="text-white">{d.expectedReadiness}</span>
                          </div>
                          <div>
                            Expected HRV:{" "}
                            <span className="text-white">
                              {d.expectedHrvPctOfBaseline != null
                                ? `${Math.round(d.expectedHrvPctOfBaseline * 100)}% of baseline`
                                : d.expectedHRV ?? "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
