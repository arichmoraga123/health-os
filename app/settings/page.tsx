export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { SettingsClient } from "@/components/settings-client";
import { requireSession } from "@/lib/session";

export default async function SettingsPage() {
  await requireSession();
  return (
    <AppShell title="Settings">
      <SettingsClient />
    </AppShell>
  );
}
