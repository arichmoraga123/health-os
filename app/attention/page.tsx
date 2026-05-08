export const dynamic = "force-dynamic";

import { AttentionPageClient } from "@/components/attention-page-client";
import { getLogsForDate } from "@/lib/attention";
import { dateKeyInTimeZone } from "@/lib/dates";
import { getUserById } from "@/lib/health";
import { requireSession } from "@/lib/session";

export default async function AttentionPage() {
  const session = await requireSession();
  const uid = session.user!.id;
  const user = await getUserById(uid);
  const tz = user?.currentTimezone || user?.homeTimezone || "UTC";
  const today = dateKeyInTimeZone(new Date(), tz);
  const logs = await getLogsForDate(uid, today);

  return (
    <AttentionPageClient
      defaultLocation={user?.currentTimezone ?? user?.homeTimezone ?? null}
      initialDate={today}
      initialLogs={logs.map((log) => ({
        id: log.id,
        date: log.date,
        startUtc:
          log.startUtc instanceof Date
            ? log.startUtc.toISOString()
            : new Date(log.startUtc as unknown as string).toISOString(),
        endUtc:
          log.endUtc instanceof Date
            ? log.endUtc.toISOString()
            : new Date(log.endUtc as unknown as string).toISOString(),
        startLocal: log.startLocal,
        endLocal: log.endLocal,
        location: log.location,
        timezone: log.timezone,
        withPerson: log.withPerson,
        activity: log.activity,
        category: log.category,
        notes: log.notes,
        googleEventId: log.googleEventId,
      }))}
    />
  );
}
