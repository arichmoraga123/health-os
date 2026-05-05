"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  ["Dashboard", "/dashboard", "var(--sleep)"],
  ["Activities", "/activities", "var(--active)"],
  ["Report", "/report", "var(--ready)"],
  ["Predictions", "/predictions", "var(--warn)"],
  ["Calendar", "/calendar", "var(--hrv)"],
  ["Journal", "/journal", "var(--sleep)"],
  ["Timezone", "/timezone", "var(--ready)"],
  ["Community", "/community", "var(--active)"],
  ["AI Coach", "/ai-coach", "var(--hrv)"],
] as const;

const mobileMain = [
  ["/dashboard", "Home"],
  ["/activities", "Train"],
  ["/report", "Report"],
  ["/calendar", "Cal"],
  ["/community", "Crew"],
] as const;

export function AppShell({
  children,
  title,
  headerExtra,
}: {
  children: React.ReactNode;
  title: string;
  headerExtra?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data } = useSession();
  const email = data?.user?.email ?? "guest@healthos.app";
  const initials =
    (email
      .split("@")[0]
      ?.split(/[.\-_]/)
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "HO") || "HO";

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)] pb-20 md:pb-0">
      <aside className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] px-3 py-6">
        <div className="heading-font text-3xl tracking-wide text-white px-3 mb-8">HEALTH OS</div>
        <nav className="flex-1 space-y-1">
          {links.map(([label, href, color]) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-[var(--text-secondary)] transition-colors",
                  active
                    ? "bg-white/[0.06] text-white border-l-2 pl-[10px]"
                    : "border-l-2 border-transparent hover:bg-white/[0.04] hover:text-white",
                )}
                style={
                  active
                    ? { borderLeftColor: color as string }
                    : undefined
                }
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color as string }} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--sleep)] to-[var(--hrv)] text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] text-[var(--text-secondary)]">{email}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="btn btn-outline !px-3 !py-2 !text-[11px]"
                >
                  Sign out
                </button>
                <button
                  type="button"
                  className="btn btn-outline !px-3 !py-2 !text-[11px]"
                >
                  Export
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 flex flex-col">
        <header className="sticky top-0 z-30 px-4 pt-4 md:px-8 md:pt-6">
          <div className="topbar-glass flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="heading-font text-3xl md:text-4xl text-white leading-none">{title}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">{headerExtra}</div>
          </div>
        </header>
        <div className="flex-1 px-4 pb-8 pt-4 md:px-8 md:pt-2">{children}</div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-[var(--border)] bg-[var(--sidebar-bg)]/95 backdrop-blur-md md:hidden">
        {mobileMain.map(([href, short]) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 py-3 text-center text-[11px] font-medium",
                active ? "text-white" : "text-[var(--text-muted)]",
              )}
            >
              {short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
