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
  ["Calendar", "/calendar", "var(--body-color)"],
  ["Journal", "/journal", "var(--sleep)"],
  ["Timezone", "/timezone", "var(--ready)"],
  ["Community", "/community", "var(--active)"],
  ["AI Coach", "/ai-coach", "var(--body-color)"],
] as const;

export function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const pathname = usePathname();
  const { data } = useSession();
  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex md:w-[220px] md:flex-col border-r border-[var(--border)] p-4 bg-[var(--surface)]">
        <div className="heading-font text-4xl mb-6">HEALTH OS</div>
        <nav className="space-y-2 flex-1">
          {links.map(([label, href, color]) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                pathname === href ? "bg-[var(--surface3)]" : "hover:bg-[var(--surface2)]",
              )}
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="panel p-3 text-xs">
          <div className="text-[var(--muted2)]">{data?.user?.email ?? "guest@healthos.app"}</div>
          <div className="mt-2 flex gap-2">
            <button onClick={() => signOut({ callbackUrl: "/" })} className="px-2 py-1 panel text-xs">
              Sign Out
            </button>
            <button className="px-2 py-1 panel text-xs">Export Data</button>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-6">
        <header className="flex items-center justify-between mb-4">
          <h1 className="heading-font text-4xl">{title}</h1>
          <div className="panel px-3 py-2 text-xs flex items-center gap-2">
            <span className="size-2 rounded-full bg-[var(--ready)] animate-pulse" /> Live sync
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
