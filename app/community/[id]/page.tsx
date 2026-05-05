import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/session";

export default async function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  return (
    <AppShell title="Community hub">
      <div className="mb-6 flex flex-wrap gap-2">
        {["Leaderboard", "Board", "Nudges", "Challenges"].map((tab, i) => (
          <button
            key={tab}
            type="button"
            className={`btn ${i === 0 ? "btn-primary" : "btn-outline"} !px-4 !py-2 !text-[11px] uppercase tracking-wider`}
          >
            {tab}
          </button>
        ))}
      </div>
      <section className="panel p-6 md:p-8">
        <p className="label-caps mb-2">Community</p>
        <h2 className="heading-font text-4xl text-white">{id}</h2>
        <p className="mt-3 max-w-xl text-[13px] text-[var(--text-secondary)]">
          Connect leaderboard sorting, board posts, nudges, and challenges to your stored community id. API routes are
          ready under <span className="text-white">/api/community/*</span>.
        </p>
      </section>
    </AppShell>
  );
}
