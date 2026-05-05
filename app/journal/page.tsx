import { AppShell } from "@/components/app-shell";
import { getRecentJournal, getSnapshots } from "@/lib/health";
import { requireSession } from "@/lib/session";

export default async function JournalPage() {
  const session = await requireSession();
  const snapshots = await getSnapshots(session.user!.id, 1);
  const history = await getRecentJournal(session.user!.id);
  const s = snapshots[0];
  const prompt = `Your HRV is ${s.hrv}. What felt different yesterday that may have influenced recovery?`;
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
