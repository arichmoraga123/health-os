export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AppShell } from "@/components/app-shell";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email || !isAdminEmail(email)) {
    redirect("/dashboard");
  }

  return (
    <AppShell title="Admin">
      <AdminDashboard />
    </AppShell>
  );
}
