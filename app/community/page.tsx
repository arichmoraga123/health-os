import { AppShell } from "@/components/app-shell";
import { CommunityActions } from "@/components/community-actions";
import { requireSession } from "@/lib/session";

const demoLeaderboard = [
  { rank: 1, name: "Alex M.", sleep: 89, readiness: 92, activity: 88, steps: 12400, streak: 12 },
  { rank: 2, name: "Jordan K.", sleep: 85, readiness: 87, activity: 91, steps: 14200, streak: 8 },
  { rank: 3, name: "Sam R.", sleep: 82, readiness: 84, activity: 79, steps: 9800, streak: 21 },
  { rank: 4, name: "You", sleep: 78, readiness: 81, activity: 85, steps: 11200, streak: 5 },
];

function scoreBadgeClass(v: number) {
  if (v >= 85) return "bg-[var(--ready)]/20 text-[var(--ready)] border-[var(--ready)]/35";
  if (v >= 70) return "bg-[var(--warn)]/15 text-[var(--warn)] border-[var(--warn)]/35";
  return "bg-[var(--hrv)]/15 text-[var(--hrv)] border-[var(--hrv)]/35";
}

export default async function CommunityPage() {
  await requireSession();

  return (
    <AppShell title="Community">
      <CommunityActions />

      <section className="mt-8 panel overflow-hidden p-0">
        <div className="border-b border-[var(--border)] px-6 py-4">
          <h3 className="heading-font text-3xl text-white">Leaderboard preview</h3>
          <p className="text-[12px] text-[var(--text-muted)]">Demo data — wire your community API for live ranks.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-white/[0.02] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Sleep</th>
                <th className="px-4 py-3">Readiness</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Steps</th>
                <th className="px-4 py-3">Streak</th>
              </tr>
            </thead>
            <tbody>
              {demoLeaderboard.map((row, i) => (
                <tr
                  key={row.rank}
                  className={`border-b border-[var(--border)] ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                >
                  <td className="px-4 py-3 text-white">
                    {row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : `#${row.rank}`}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--text-secondary)]">{row.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${scoreBadgeClass(row.sleep)}`}>
                      {row.sleep}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${scoreBadgeClass(row.readiness)}`}>
                      {row.readiness}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${scoreBadgeClass(row.activity)}`}>
                      {row.activity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{row.steps.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[var(--warn)]">
                    🔥 {row.streak}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="panel p-6 md:p-8">
          <h3 className="heading-font text-2xl text-white">Send a nudge</h3>
          <p className="mt-2 text-[12px] text-[var(--text-muted)]">Quick actions for your crew (API: /api/community/nudge).</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["🔔 Nudge", "💪 Cheer", "🎯 Challenge", "😴 Sleep"].map((label) => (
              <button
                key={label}
                type="button"
                className="rounded-full border border-[var(--border)] bg-[var(--sleep)]/20 px-4 py-2 text-[12px] font-semibold text-white hover:bg-[var(--sleep)]/30"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="panel relative overflow-hidden p-6 md:p-8">
          <div className="absolute right-4 top-4 size-3 animate-pulse rounded-full bg-[var(--ready)]" />
          <h3 className="heading-font text-2xl text-white">Nudge inbox</h3>
          <ul className="mt-4 space-y-3">
            {[
              { from: "Jordan", type: "💪 Cheer", time: "2h ago", msg: "Crushing the steps goal!" },
              { from: "Alex", type: "😴 Sleep", time: "Yesterday", msg: "Wind down early tonight?" },
            ].map((n, i) => (
              <li key={i} className="rounded-xl border border-[var(--border)] bg-white/[0.03] px-4 py-3">
                <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                  <span>
                    {n.type} · {n.from}
                  </span>
                  <span>{n.time}</span>
                </div>
                <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{n.msg}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </AppShell>
  );
}
