export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { PredictionsPageClient } from "@/components/predictions-page-client";

export default async function PredictionsPage() {
  return (
    <AppShell title="Predictions">
      <section className="panel p-6">
        <p className="heading-font text-4xl text-white">Predictions</p>
        <PredictionsPageClient />
      </section>
    </AppShell>
  );
}
