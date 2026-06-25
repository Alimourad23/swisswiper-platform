"use client";

import { useState } from "react";
import { channels } from "@/lib/marketing/channels";
import type { ContentPost } from "@/lib/marketing/schedule";

/* A month calendar (Google-Calendar style) for the content plan. Posts show as
   colour-coded chips on their scheduled day; drag a chip to another day to
   reschedule, drag an idea up from the Unscheduled rail to give it a date, and
   click any chip to open it in the studio. Presentational — all state + saving
   live in the parent (ContentSchedule). */

// Tasteful, distinct channel colours (calm, not neon).
const CHANNEL_COLOR: Record<string, string> = {
  linkedin: "#5C66A6",
  instagram: "#C2548A",
  tiktok: "#0F766E",
  youtube: "#C0392B",
  website: "#4B5563",
};
function color(key: string): string {
  return CHANNEL_COLOR[key] ?? "#5C66A6";
}
function channelName(key: string): string {
  return channels.find((c) => c.key === key)?.name ?? key;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function MonthGrid({
  posts,
  month,
  onPrev,
  onNext,
  onToday,
  onMove,
  onOpen,
}: {
  posts: ContentPost[];
  month: Date; // first day of the displayed month
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onMove: (id: string, date: string) => void;
  onOpen: (id: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);

  const today = ymd(new Date());
  const monthLabel = month.toLocaleDateString([], { month: "long", year: "numeric" });

  // Grid starts on the Monday on/before the 1st; render 6 weeks (42 cells).
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - lead);
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const byDay = new Map<string, ContentPost[]>();
  for (const p of posts) {
    if (!p.scheduled_for) continue;
    const arr = byDay.get(p.scheduled_for) ?? [];
    arr.push(p);
    byDay.set(p.scheduled_for, arr);
  }
  const unscheduled = posts.filter((p) => !p.scheduled_for);

  function drop(dateStr: string) {
    if (dragId) onMove(dragId, dateStr);
    setDragId(null);
    setOverDay(null);
  }

  return (
    <div className="px-4 py-4">
      {/* Month header */}
      <div className="mb-3 flex items-center justify-between gap-3 px-2">
        <h4 className="text-sm font-medium text-ink">{monthLabel}</h4>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onToday} className="rounded-full bg-bg px-3 py-1 text-xs font-medium text-muted transition-colors hover:text-ink">
            Today
          </button>
          <button type="button" onClick={onPrev} aria-label="Previous month" className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-bg hover:text-ink">
            ‹
          </button>
          <button type="button" onClick={onNext} aria-label="Next month" className="grid h-7 w-7 place-items-center rounded-full text-muted transition-colors hover:bg-bg hover:text-ink">
            ›
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-hint">
            {w}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 overflow-hidden rounded-[var(--radius-control)] border border-hairline">
        {cells.map((d, i) => {
          const ds = ymd(d);
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = ds === today;
          const dayPosts = byDay.get(ds) ?? [];
          return (
            <div
              key={i}
              onDragOver={(e) => {
                e.preventDefault();
                if (overDay !== ds) setOverDay(ds);
              }}
              onDragLeave={() => setOverDay((c) => (c === ds ? null : c))}
              onDrop={() => drop(ds)}
              className={`min-h-[92px] border-b border-r border-hairline p-1.5 [&:nth-child(7n)]:border-r-0 ${
                inMonth ? "bg-surface" : "bg-bg/60"
              } ${overDay === ds ? "ring-2 ring-inset ring-peri-deep/40" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <span
                  className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] ${
                    isToday ? "bg-peri-deep font-medium text-white" : inMonth ? "text-muted" : "text-hint"
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {dayPosts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverDay(null);
                    }}
                    onClick={() => onOpen(p.id)}
                    title={`${p.title || "Untitled"} · ${channelName(p.channel)}`}
                    className="flex w-full items-center gap-1 truncate rounded px-1.5 py-1 text-left text-[11px] leading-tight transition-opacity hover:opacity-90"
                    style={{ backgroundColor: `${color(p.channel)}1A`, color: color(p.channel) }}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color(p.channel) }} />
                    <span className="truncate">{p.title || "Untitled"}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscheduled rail — drag onto a day to schedule */}
      <div className="mt-4">
        <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wide text-hint">
          Unscheduled — drag onto a day to plan it
        </p>
        {unscheduled.length === 0 ? (
          <p className="px-2 text-xs text-hint">Nothing waiting. Every idea has a date.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 px-2">
            {unscheduled.map((p) => (
              <button
                key={p.id}
                type="button"
                draggable
                onDragStart={() => setDragId(p.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverDay(null);
                }}
                onClick={() => onOpen(p.id)}
                title={`${p.title || "Untitled"} · ${channelName(p.channel)}`}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-opacity hover:opacity-90"
                style={{ backgroundColor: `${color(p.channel)}1A`, color: color(p.channel) }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color(p.channel) }} />
                <span className="max-w-[12rem] truncate">{p.title || "Untitled"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Channel legend */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 px-2">
        {channels.map((c) => (
          <span key={c.key} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color(c.key) }} />
            {c.name}
          </span>
        ))}
      </div>
    </div>
  );
}
