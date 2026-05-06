"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function ExportMenuButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  function go(path: string) {
    setOpen(false);
    window.location.href = path;
  }

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn btn-outline !px-3 !py-2 !text-[11px]"
      >
        Export ▾
      </button>
      {open ? (
        <div className="absolute bottom-full left-0 z-50 mb-1 min-w-[220px] rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-[11px] text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
            onClick={() => go("/api/export/daily-md")}
          >
            Export today&apos;s data (Markdown)
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-[11px] text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
            onClick={() => go("/api/export/csv?days=7")}
          >
            Export last 7 days (CSV)
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-[11px] text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
            onClick={() => go("/api/export/csv?days=30")}
          >
            Export last 30 days (CSV)
          </button>
        </div>
      ) : null}
    </div>
  );
}
