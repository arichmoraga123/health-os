import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/session";

export default async function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  return (
    <AppShell title="Community Hub">
      <div className="grid grid-cols-4 gap-2 text-sm mb-4">
        {["LEADERBOARD", "BOARD", "NUDGES", "CHALLENGES"].map((tab) => (
          <div key={tab} className="panel p-2 text-center">
            {tab}
          </div>
        ))}
      </div>
      <section className="panel p-4">Community ID: {id}. Use API routes to power tab interactions and updates.</section>
    </AppShell>
  );
}
