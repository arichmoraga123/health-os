export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/session";

export default async function CalendarPage() {
  await requireSession();
  return (
    <AppShell title="Calendar">
      <section className="panel p-4 space-y-3">
        <a href="/api/calendar/auth" className="btn btn-primary">
          Connect Google Calendar (sleep logging)
        </a>
        <p className="text-sm text-[var(--text-secondary)]">
          After connecting, sleep is logged to your primary calendar each morning. You can also use{" "}
          <strong>Log to Calendar</strong> on the dashboard. Late-evening events can still be synced from Google for
          timezone planning.
        </p>
      </section>
    </AppShell>
  );
}
