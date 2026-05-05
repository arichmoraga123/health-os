import { AppShell } from "@/components/app-shell";
import { getRecentJournal, getSnapshots } from "@/lib/health";
import { requireSession } from "@/lib/session";

export default async function JournalPage() {
  const session = await requireSession();
  const snapshots = await getSnapshots(session.user!.id, 1);
  const history = await getRecentJournal(session.user!.id);
  const s = snapshots[0];
  const tags =
    Array.isArray(s?.tags) && s.tags.length
      ? s.tags
          .map((t) =>
            typeof t === "object" && t && "label" in (t as Record<string, unknown>)
              ? String((t as Record<string, unknown>).label)
              : typeof t === "object" && t && "tag_type_code" in (t as Record<string, unknown>)
                ? String((t as Record<string, unknown>).tag_type_code)
                : null,
          )
          .filter(Boolean)
      : [];
  const tagText = tags.length ? `Your tags today: ${tags.join(", ")}.` : "No Oura tags for today.";
  const prompt = `${tagText} Sleep ${s.sleepScore ?? "—"}, readiness ${
    s.readinessScore ?? "—"
  }, HRV ${s.hrv ?? "—"}, stress high ${s.stressHigh ?? "—"}m. What likely drove these patterns?`;
  return (
    <AppShell title="Journal">
      <section className="panel p-4">
        <div className="text-sm text-[var(--muted2)] mb-2">Prompt</div>
        <div>{prompt}</div>
        <form className="mt-3 space-y-2" action="/api/ai/journal" method="post">
          <textarea name="entry" className="w-full h-40 panel p-2 bg-[var(--surface2)]" />
          <button className="btn btn-primary">Save & Reflect</button>
        </form>
      </section>
      <section className="panel p-4 mt-4">Entries this month: {history.length}</section>
    </AppShell>
  );
}
