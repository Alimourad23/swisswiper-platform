/* Pure, timezone-aware helpers for rendering the calendar on the CLIENT.
   Native Date methods (getHours, toLocaleTimeString, etc.) operate in the
   browser's local timezone, which is exactly the viewer's device timezone —
   so "today", time labels, and free-time math automatically follow travel. */

import type { CalEventRaw } from "@/lib/google/calendar";

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "your timezone";
  } catch {
    return "your timezone";
  }
}

export function startMs(ev: CalEventRaw): number {
  if (ev.startDateTime) return Date.parse(ev.startDateTime);
  if (ev.allDayStart) {
    const [y, m, d] = ev.allDayStart.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  return 0;
}

export function endMs(ev: CalEventRaw): number {
  if (ev.endDateTime) return Date.parse(ev.endDateTime);
  if (ev.allDayEnd) {
    const [y, m, d] = ev.allDayEnd.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  return startMs(ev);
}

function dateKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/* All-day events use their literal date (no timezone shift); timed events use
   the device-local date of their instant. */
export function eventDayKey(ev: CalEventRaw): string {
  if (ev.allDayStart) return ev.allDayStart;
  return dateKey(startMs(ev));
}

export function todayKey(now: number): string {
  return dateKey(now);
}

export function weekKeys(now: number, offsetDays = 0): string[] {
  const base = new Date(now);
  base.setHours(12, 0, 0, 0);
  base.setDate(base.getDate() + offsetDays);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return dateKey(d.getTime());
  });
}

/* "Jun 30 – Jul 6" style label for a run of day-keys. */
export function rangeLabel(keys: string[]): string {
  if (keys.length === 0) return "";
  const fmt = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString([], { month: "short", day: "numeric" });
  };
  return `${fmt(keys[0])} – ${fmt(keys[keys.length - 1])}`;
}

export function dayLabel(key: string, tKey: string): string {
  if (key === tKey) return "Today";
  const [ty, tm, td] = tKey.split("-").map(Number);
  const tomorrow = new Date(ty, tm - 1, td);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (key === dateKey(tomorrow.getTime())) return "Tomorrow";

  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function timeLabel(ev: CalEventRaw): string {
  if (!ev.startDateTime) return "All day";
  return new Date(ev.startDateTime).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function countdownLabel(ms: number): string {
  if (ms <= 0) return "now";
  const min = Math.round(ms / 60000);
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  if (h < 24) return rem ? `in ${h}h ${rem}m` : `in ${h}h`;
  const days = Math.round(h / 24);
  return `in ${days} day${days > 1 ? "s" : ""}`;
}

export function purposeLine(ev: CalEventRaw): string {
  if (ev.purpose) return ev.purpose;
  if (ev.attendeesOthers.length) {
    const names = ev.attendeesOthers.slice(0, 3).join(", ");
    const more = ev.attendeesOthers.length > 3 ? ` +${ev.attendeesOthers.length - 3}` : "";
    return `With ${names}${more}`;
  }
  return ev.location || "";
}

export type DayLoad = {
  meetings: number;
  hours: number;
  freeStart: number | null;
  freeEnd: number | null;
};

/* Today's load: meeting count, hours booked, and the longest free block within
   an 8:00–20:00 local working window. */
export function todayLoad(todaysMeetings: CalEventRaw[], now: number): DayLoad {
  const timed = todaysMeetings.filter((e) => e.startDateTime && e.endDateTime);

  let bookedMs = 0;
  for (const e of timed) bookedMs += Math.max(0, endMs(e) - startMs(e));

  const dayStart = new Date(now);
  dayStart.setHours(8, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(20, 0, 0, 0);

  const intervals = timed
    .map((e) => [Math.max(startMs(e), dayStart.getTime()), Math.min(endMs(e), dayEnd.getTime())])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);

  const merged: number[][] = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (!last || iv[0] > last[1]) merged.push([...iv]);
    else last[1] = Math.max(last[1], iv[1]);
  }

  // Collect free gaps within the working window, then pick the longest.
  const gaps: [number, number][] = [];
  let cursor = dayStart.getTime();
  for (const [s, e] of merged) {
    if (s > cursor) gaps.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (dayEnd.getTime() > cursor) gaps.push([cursor, dayEnd.getTime()]);

  let best: { start: number; end: number; len: number } | null = null;
  for (const [s, e] of gaps) {
    const len = e - s;
    if (!best || len > best.len) best = { start: s, end: e, len };
  }

  const hasFree = best !== null && best.len >= 30 * 60000;
  return {
    meetings: todaysMeetings.length,
    hours: bookedMs / 3600000,
    freeStart: hasFree ? best!.start : null,
    freeEnd: hasFree ? best!.end : null,
  };
}

export function formatHours(h: number): string {
  if (h <= 0) return "0h";
  const rounded = Math.round(h * 2) / 2;
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded}h`;
}

export function clockLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function weekdayShort(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: "narrow" });
}

export type WeekLoad = {
  hours: number; // total meeting hours this week
  pct: number; // % of a ~40h working week
  busiestLabel: string;
  busiestHours: number;
  backToBack: number; // meeting transitions with < 10 min gap
  perDay: { key: string; hours: number }[];
};

/* Meeting-load insight for a week of day buckets (timed meetings only). */
export function weekLoad(
  days: { key: string; label: string; meetings: CalEventRaw[] }[],
): WeekLoad {
  let total = 0;
  let backToBack = 0;
  let busiest = { label: "", hours: 0 };

  const perDay = days.map((d) => {
    const timed = d.meetings
      .filter((m) => m.startDateTime && m.endDateTime)
      .sort((a, b) => startMs(a) - startMs(b));
    const hours = timed.reduce((n, m) => n + Math.max(0, endMs(m) - startMs(m)), 0) / 3600000;
    total += hours;
    if (hours > busiest.hours) busiest = { label: d.label, hours };
    for (let i = 1; i < timed.length; i++) {
      const gap = startMs(timed[i]) - endMs(timed[i - 1]);
      if (gap >= 0 && gap < 10 * 60000) backToBack++;
    }
    return { key: d.key, hours };
  });

  return {
    hours: total,
    pct: Math.round((total / 40) * 100),
    busiestLabel: busiest.label,
    busiestHours: busiest.hours,
    backToBack,
    perDay,
  };
}
