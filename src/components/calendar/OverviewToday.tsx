"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CalEventRaw } from "@/lib/google/calendar";
import {
  deviceTimeZone,
  startMs,
  eventDayKey,
  todayKey,
  timeLabel,
  countdownLabel,
} from "@/lib/calendar-view";

export default function OverviewToday({ events }: { events: CalEventRaw[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const tz = useMemo(() => deviceTimeZone(), []);

  const model = useMemo(() => {
    if (now === null) return null;
    const tKey = todayKey(now);
    const today = events.filter((e) => eventDayKey(e) === tKey);
    const meetings = today.filter((e) => e.isMeeting).sort((a, b) => startMs(a) - startMs(b));
    const reminders = today.filter((e) => !e.isMeeting).sort((a, b) => startMs(a) - startMs(b));
    const upNext =
      [...events]
        .filter((e) => e.isMeeting && startMs(e) > now)
        .sort((a, b) => startMs(a) - startMs(b))[0] ?? null;
    return { meetings, reminders, upNext };
  }, [events, now]);

  if (!model || now === null) {
    return <div className="py-10 text-center text-sm text-muted">Loading…</div>;
  }

  const nothing = model.meetings.length === 0 && model.reminders.length === 0;

  return (
    <div className="py-4">
      {model.upNext && (
        <p className="mb-3 text-sm text-muted">
          Up next: <span className="font-medium text-ink">{model.upNext.title}</span>{" "}
          <span className="text-peri-deep">{countdownLabel(startMs(model.upNext) - now)}</span>
        </p>
      )}

      {nothing ? (
        <div className="py-6 text-center">
          <p className="text-sm font-medium text-ink/70">Nothing scheduled today</p>
          <p className="mt-1 text-sm text-hint">Enjoy the clear day.</p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {model.meetings.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 border-t border-hairline py-2.5 first:border-t-0"
            >
              <span className="w-20 shrink-0 text-sm tabular-nums text-muted">{timeLabel(e)}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{e.title}</span>
              {e.overlaps && (
                <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium leading-none text-red-600">
                  Overlaps
                </span>
              )}
            </li>
          ))}
          {model.reminders.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 border-t border-hairline py-2.5 first:border-t-0"
            >
              <span className="w-20 shrink-0 text-sm tabular-nums text-hint">{timeLabel(e)}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted">{e.title}</span>
              <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-[11px] font-medium leading-none text-hint">
                Reminder
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between">
        <Link
          href="/dashboard/calendar"
          className="text-sm font-medium text-peri-deep hover:underline"
        >
          View full calendar →
        </Link>
        <span className="text-xs text-hint">{tz}</span>
      </div>
    </div>
  );
}
