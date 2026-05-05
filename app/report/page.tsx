export const dynamic = "force-dynamic";

import { AppShell } from "@/components/app-shell";
import { ReportPageClient } from "@/components/report-page-client";

export default async function ReportPage() {
  return (
    <AppShell title="Report">
      <section className="panel p-6">
        <p className="heading-font text-4xl text-white">Report</p>
        <ReportPageClient />
      </section>
    </AppShell>
  );
}
