"use client";

import { AppShell } from "@/components/app-shell";

export default function TimezonePage() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <AppShell title="Timezone">
      <section className="panel p-4 space-y-2">
        <div>Current timezone: {tz}</div>
        <button
          className="panel px-3 py-2 bg-[var(--sleep)] text-black"
          onClick={() => fetch("/api/timezone/plan", { method: "POST", body: JSON.stringify({ currentTz: tz, homeTz: "UTC" }) })}
        >
          Re-generate jet lag plan
        </button>
      </section>
    </AppShell>
  );
}
