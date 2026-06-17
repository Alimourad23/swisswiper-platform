/* Pure, client-safe formatting helpers. Like the Calendar module, anything
   time-related is rendered on the CLIENT in the viewer's device timezone so
   "today"/"overdue" follow the person looking, not the server. */

import type { TaskPriority } from "@/lib/tasks/types";

function dayStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/* Relative, device-tz label for a due date. Returns null for no due date. */
export function dueLabel(
  due: string | null,
  now: number,
): { text: string; overdue: boolean; soon: boolean } | null {
  if (!due) return null;
  const ms = Date.parse(due);
  if (Number.isNaN(ms)) return null;

  const dayDiff = Math.round((dayStart(ms) - dayStart(now)) / 86_400_000);
  const overdue = ms < now && dayDiff <= 0;

  let text: string;
  if (dayDiff === 0) text = "Today";
  else if (dayDiff === 1) text = "Tomorrow";
  else if (dayDiff === -1) text = "Yesterday";
  else if (dayDiff > 1 && dayDiff <= 6) text = `in ${dayDiff} days`;
  else if (dayDiff < -1 && dayDiff >= -6) text = `${-dayDiff} days ago`;
  else {
    const sameYear = new Date(ms).getFullYear() === new Date(now).getFullYear();
    text = new Date(ms).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    });
  }

  return { text, overdue, soon: dayDiff >= 0 && dayDiff <= 1 };
}

/* Is this due date within today or already past (and not done)? */
export function isOverdue(due: string | null, now: number): boolean {
  if (!due) return false;
  return Date.parse(due) < now;
}

export function isDueToday(due: string | null, now: number): boolean {
  if (!due) return false;
  return dayStart(Date.parse(due)) === dayStart(now);
}

export function isDueThisWeek(due: string | null, now: number): boolean {
  if (!due) return false;
  const diff = Math.round((dayStart(Date.parse(due)) - dayStart(now)) / 86_400_000);
  return diff >= 0 && diff <= 6;
}

/* For the quick-add date input -> an ISO timestamp at 17:00 local (end of day
   feel) so a date-only pick reads as "due that day". */
export function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 17, 0, 0).toISOString();
}

/* ISO timestamp -> yyyy-mm-dd for a <input type="date"> value (device tz). */
export function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: "bg-red-500",
  normal: "bg-peri-deep",
  low: "bg-hint",
};

export function initialsOf(name: string | null, email: string | null): string {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function displayName(name: string | null, email: string | null): string {
  return name || email || "Unknown";
}
