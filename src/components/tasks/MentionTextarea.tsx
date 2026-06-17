"use client";

import { useRef, useState } from "react";
import type { Profile } from "@/lib/tasks/types";
import { displayName, mentionHandle } from "@/lib/tasks/format";
import Avatar from "@/components/tasks/Avatar";

/* A notes textarea with @mention autocomplete. Typing "@" (optionally followed
   by letters) opens a dropdown of teammates; picking one inserts a handle that
   the mention parser resolves back to that exact person. */
export default function MentionTextarea({
  value,
  onChange,
  profiles,
  rows = 4,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  profiles: Profile[];
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null); // text typed after "@"
  const [anchor, setAnchor] = useState(0); // index of the "@"
  const [highlight, setHighlight] = useState(0);

  // Find an active "@token" immediately before the caret.
  function detect(text: string, caret: number) {
    const upto = text.slice(0, caret);
    const m = upto.match(/(^|\s)@([a-zA-Z0-9._-]*)$/);
    if (m) {
      setQuery(m[2]);
      setAnchor(caret - m[2].length - 1); // position of "@"
      setHighlight(0);
    } else {
      setQuery(null);
    }
  }

  const matches =
    query === null
      ? []
      : profiles
          .filter((p) => {
            if (!query) return true;
            const name = displayName(p.full_name, p.email).toLowerCase();
            return name.includes(query.toLowerCase());
          })
          .slice(0, 6);

  function pick(p: Profile) {
    const handle = mentionHandle(p, profiles);
    const caret = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, anchor);
    const after = value.slice(caret);
    const inserted = `@${handle} `;
    const next = before + inserted + after;
    onChange(next);
    setQuery(null);
    // Restore the caret just after the inserted handle.
    const pos = before.length + inserted.length;
    requestAnimationFrame(() => {
      const el = ref.current;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  }

  const open = query !== null && matches.length > 0;

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onClick={(e) => detect(value, e.currentTarget.selectionStart ?? 0)}
        onKeyUp={(e) => {
          // Re-detect on caret moves that aren't handled below.
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            detect(value, e.currentTarget.selectionStart ?? 0);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + matches.length) % matches.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            pick(matches[highlight]);
          } else if (e.key === "Escape") {
            setQuery(null);
          }
        }}
        className="w-full resize-y rounded-[var(--radius-control)] bg-bg px-3 py-2.5 text-sm text-ink placeholder:text-hint focus:outline-none focus:ring-1 focus:ring-peri"
      />

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-[var(--radius-control)] border border-hairline bg-surface shadow-[var(--shadow-card)]">
          {matches.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // keep textarea focus
                pick(p);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={[
                "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm",
                i === highlight ? "bg-peri-soft" : "hover:bg-bg",
              ].join(" ")}
            >
              <Avatar profile={p} />
              <span className="flex-1 truncate text-ink">{displayName(p.full_name, p.email)}</span>
              <span className="text-xs text-hint">@{mentionHandle(p, profiles)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
