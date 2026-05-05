"use client";

import { useState } from "react";

type Brief = {
  briefMarkdown?: string | null;
  keyInsight?: string | null;
  actionItems?: string[] | null;
  moodPrompt?: string | null;
};

export function DailyBriefCard({
  dateKey,
  initial,
}: {
  dateKey: string;
  initial: Brief;
}) {
  const [brief, setBrief] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  async function regenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/daily-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setBrief({
        briefMarkdown: data.briefMarkdown ?? data.brief ?? brief.briefMarkdown,
        keyInsight: data.keyInsight,
        actionItems: data.actionItems,
        moodPrompt: data.moodPrompt,
      });
    } finally {
      setLoading(false);
    }
  }

  const items = brief.actionItems?.length ? brief.actionItems : ["—", "—", "—"];

  return (
    <section className="panel relative overflow-hidden p-6 md:p-8">
      <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-[var(--sleep)]/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="label-caps mb-2">Today&apos;s brief</p>
          <h2 className="heading-font text-4xl text-white md:text-5xl leading-none">Insight</h2>
        </div>
        <button
          type="button"
          onClick={regenerate}
          disabled={loading}
          className="shrink-0 rounded-xl border border-[var(--border)] bg-white/[0.06] px-4 py-2 text-[12px] font-medium text-white hover:bg-white/[0.1] disabled:opacity-50"
        >
          {loading ? "Generating…" : "Regenerate"}
        </button>
      </div>
      <p className="relative mt-5 max-w-3xl text-[14px] leading-relaxed text-[var(--text-secondary)]">
        {brief.keyInsight || brief.briefMarkdown || "Your coach brief will appear here after sync."}
      </p>
      {brief.briefMarkdown && brief.keyInsight ? (
        <p className="relative mt-3 text-[13px] text-[var(--text-muted)] whitespace-pre-wrap">{brief.briefMarkdown}</p>
      ) : null}
      <div className="relative mt-6 space-y-3">
        <p className="label-caps">Action items</p>
        {items.slice(0, 3).map((item, i) => (
          <label
            key={i}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-white/[0.03] p-3"
          >
            <input
              type="checkbox"
              checked={!!checked[i]}
              onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))}
              className="mt-1 size-4 rounded border-[var(--border)]"
            />
            <span className="text-[13px] text-[var(--text-secondary)]">{item}</span>
          </label>
        ))}
      </div>
      {brief.moodPrompt ? (
        <div className="relative mt-6 rounded-xl border border-dashed border-[var(--border)] bg-white/[0.02] p-4">
          <p className="label-caps mb-2">Journal prompt</p>
          <p className="text-[13px] text-white">{brief.moodPrompt}</p>
        </div>
      ) : null}
    </section>
  );
}
