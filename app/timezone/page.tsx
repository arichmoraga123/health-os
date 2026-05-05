export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { TripPlanner } from "@/components/trip-planner";
import { requireSession } from "@/lib/session";

export default async function TimezonePage() {
  await requireSession();
  return (
    <AppShell title="Trip planner">
      <TripPlanner />
    </AppShell>
  );
}
