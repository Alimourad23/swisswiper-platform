"use client";

import { useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/tasks/types";
import { displayName } from "@/lib/tasks/format";
import Avatar from "@/components/tasks/Avatar";

/* A multi-select dropdown of teammates. Used both in quick-add and the detail
   panel. Purely controlled — parent owns the selected ids. */
export default function AssigneeSelect({
  profiles,
  selected,
  onToggle,
  compact = false,
}: {
  profiles: Profile[];
  selected: string[];
  onToggle: (id: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const label =
    selected.length === 0
      ? "Assign"
      : selected.length === 1
        ? displayName(
            profiles.find((p) => p.id === selected[0])?.full_name ?? null,
            profiles.find((p) => p.id === selected[0])?.email ?? null,
          ).split(" ")[0]
        : `${selected.length} people`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-2 rounded-[var(--radius-control)] border border-hairline bg-surface text-sm text-muted transition-colors hover:text-ink",
          compact ? "px-2.5 py-1.5" : "px-3 py-2",
        ].join(" ")}
      >
        <span className="text-peri-deep">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3.5 19a5.5 5.5 0 0 1 11 0M17 8h4M19 6v4" />
          </svg>
        </span>
        {label}
      </button>

      {open && (
        <div className="absolute z-30 mt-2 max-h-72 w-60 overflow-auto rounded-[var(--radius-control)] border border-hairline bg-surface p-1.5 shadow-[var(--shadow-card)]">
          {profiles.length === 0 && (
            <p className="px-3 py-2 text-sm text-hint">No teammates yet.</p>
          )}
          {profiles.map((p) => {
            const on = selected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onToggle(p.id)}
                className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left text-sm hover:bg-bg"
              >
                <Avatar profile={p} />
                <span className="flex-1 truncate text-ink">
                  {displayName(p.full_name, p.email)}
                </span>
                {on && (
                  <span className="text-peri-deep">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
