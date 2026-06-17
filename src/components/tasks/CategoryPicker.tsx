"use client";

import { useEffect, useRef, useState } from "react";
import { TASK_CATEGORIES } from "@/lib/tasks/types";

/* Category / tag selector. Persists to tasks.tags (text[]). Offers the
   SwissWiper starter set as toggle chips and lets the user type a custom one.
   Two layouts: "inline" (chips in a form) and "popover" (compact button for
   the quick-add bar). Purely controlled — parent owns the selected values. */
export default function CategoryPicker({
  value,
  onChange,
  variant = "inline",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  variant?: "inline" | "popover";
}) {
  const [draft, setDraft] = useState("");

  function has(tag: string) {
    return value.some((v) => v.toLowerCase() === tag.toLowerCase());
  }
  function toggle(tag: string) {
    onChange(has(tag) ? value.filter((v) => v.toLowerCase() !== tag.toLowerCase()) : [...value, tag]);
  }
  function addDraft() {
    const t = draft.trim();
    if (!t) return;
    if (!has(t)) onChange([...value, t]);
    setDraft("");
  }

  // Starter chips + any custom values already chosen (so they can be removed).
  const customSelected = value.filter(
    (v) => !TASK_CATEGORIES.some((c) => c.toLowerCase() === v.toLowerCase()),
  );

  const chips = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {TASK_CATEGORIES.map((cat) => (
          <Chip key={cat} label={cat} active={has(cat)} onClick={() => toggle(cat)} />
        ))}
        {customSelected.map((cat) => (
          <Chip key={cat} label={cat} active onClick={() => toggle(cat)} removable />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addDraft();
            }
          }}
          placeholder="Add your own…"
          className="min-w-0 flex-1 rounded-[var(--radius-control)] bg-bg px-3 py-2 text-sm text-ink placeholder:text-hint focus:outline-none focus:ring-1 focus:ring-peri"
        />
        <button
          type="button"
          onClick={addDraft}
          disabled={!draft.trim()}
          className="rounded-[var(--radius-control)] border border-hairline px-3 py-2 text-sm font-medium text-muted hover:bg-bg hover:text-ink disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );

  if (variant === "inline") return chips;

  return <PopoverWrap count={value.length}>{chips}</PopoverWrap>;
}

function Chip({
  label,
  active,
  onClick,
  removable,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  removable?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium leading-none transition-colors",
        active
          ? "bg-peri-soft text-peri-deep ring-1 ring-peri"
          : "bg-bg text-muted ring-1 ring-hairline hover:text-ink",
      ].join(" ")}
    >
      {active && !removable && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
      {label}
      {removable && <span className="text-hint">×</span>}
    </button>
  );
}

function PopoverWrap({ count, children }: { count: number; children: React.ReactNode }) {
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-[var(--radius-control)] border border-hairline bg-surface px-2.5 py-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <span className="text-peri-deep">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.6 13.4 12 22l-8.6-8.6a4 4 0 0 1 0-5.7l3-3a4 4 0 0 1 5.7 0L20.6 13.4Z" />
            <circle cx="8.5" cy="8.5" r="1.2" />
          </svg>
        </span>
        {count > 0 ? `${count} tag${count === 1 ? "" : "s"}` : "Tags"}
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-72 rounded-[var(--radius-control)] border border-hairline bg-surface p-3 shadow-[var(--shadow-card)]">
          {children}
        </div>
      )}
    </div>
  );
}
