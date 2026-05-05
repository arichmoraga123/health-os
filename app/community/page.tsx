import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/session";

export default async function CommunityPage() {
  await requireSession();
  return (
    <AppShell title="Community">
      <section className="grid md:grid-cols-2 gap-4">
        <form className="panel p-4 space-y-2" action="/api/community/create" method="post">
          <h3 className="heading-font text-2xl">Create Community</h3>
          <input name="name" placeholder="Name" className="w-full panel p-2 bg-[var(--surface2)]" />
          <textarea name="description" placeholder="Description" className="w-full panel p-2 bg-[var(--surface2)]" />
          <button className="panel px-3 py-2 bg-[var(--ready)] text-black">Create</button>
        </form>
        <form className="panel p-4 space-y-2" action="/api/community/join" method="post">
          <h3 className="heading-font text-2xl">Join with Invite Code</h3>
          <input name="inviteCode" placeholder="6-char code" className="w-full panel p-2 bg-[var(--surface2)]" />
          <button className="panel px-3 py-2">Join</button>
        </form>
      </section>
    </AppShell>
  );
}
