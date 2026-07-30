export const dynamic = "force-dynamic";

import { SleepPageClient } from "@/components/sleep-page-client";
import { getSnapshotsAsc, getUserById } from "@/lib/health";
import { requireSession } from "@/lib/session";

export default async function SleepPage() {
  const session = await requireSession();
  const uid = session.user!.id;
  const user = await getUserById(uid);
  const tz = user?.currentTimezone || user?.homeTimezone || "UTC";
  const snapshots = await getSnapshotsAsc(uid, 30, tz);

  return <SleepPageClient timeZone={tz} initialSnapshots={snapshots} />;
}
