import { Suspense } from "react";
import { DashboardClient } from "@/components/dashboard-client";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { dateKeyInTimeZone } from "@/lib/dates";
import { getBriefForDate, getSnapshotsAsc, getUserById } from "@/lib/health";
import { requireSession } from "@/lib/session";

async function DashboardData() {
  const session = await requireSession();
  const uid = session.user!.id;
  const user = await getUserById(uid);
  const tz = user?.currentTimezone || user?.homeTimezone || "UTC";
  const todayKey = dateKeyInTimeZone(new Date(), tz);
  const [snapshots, brief] = await Promise.all([
    getSnapshotsAsc(uid, 30, tz),
    getBriefForDate(uid, todayKey),
  ]);

  return (
    <DashboardClient
      timeZone={tz}
      initialSnapshots={snapshots}
      initialBrief={{
        briefMarkdown: (brief as { briefMarkdown?: string }).briefMarkdown ?? null,
        keyInsight: (brief as { keyInsight?: string }).keyInsight ?? null,
        actionItems: (brief as { actionItems?: string[] }).actionItems ?? null,
        moodPrompt: (brief as { moodPrompt?: string }).moodPrompt ?? null,
      }}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardData />
    </Suspense>
  );
}
