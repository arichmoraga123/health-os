import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/session";

export default async function CalendarPage() {
  await requireSession();
  return (
    <AppShell title="Calendar">
      <section className="panel p-4 space-y-3">
        <a href="/api/calendar/auth" className="inline-block panel px-3 py-2 bg-[var(--sleep)] text-black">
          Connect Google Calendar
        </a>
        <p className="text-sm text-[var(--muted2)]">
          Late evening events are automatically flagged and correlated with sleep and next-day readiness.
        </p>
      </section>
    </AppShell>
  );
}
