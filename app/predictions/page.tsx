export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";

export default async function PredictionsPage() {
  return (
    <AppShell title="Predictions">
      <section className="panel p-6">
        <p className="heading-font text-4xl text-white">Predictions</p>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">Loading...</p>
      </section>
    </AppShell>
  );
}
