/* Monthly content planning — types + pure helpers (importable by client code).
   The Alfred generation lives in `monthly-generate.ts`; the server actions in
   `monthly-actions.ts`. */

export type MonthSuggestion = {
  channel: string; // linkedin | instagram | website
  title: string; // short hook / working title
  idea: string; // one-line description of the post
  day: number; // 1–28, day of the target month (fallback)
  date?: string; // engine-assigned YYYY-MM-DD (preferred over day)
  goal?: string; // secondary goal: awareness | followers | inquiries | community
};

export type MonthPlanStatus = "suggested" | "applied" | "dismissed";

export type MonthPlan = {
  id: string;
  month: string; // 'YYYY-MM'
  status: MonthPlanStatus;
  suggestions: MonthSuggestion[];
  created_at: string;
  updated_at: string;
};

// When a month is "thin" enough to prompt a plan.
export const MIN_PLANNED_PER_MONTH = 4;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/* 'YYYY-MM' for the month that is `offset` months from `base` (default: next). */
export function monthKey(base = new Date(), offset = 1): string {
  const d = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/* A readable label like "January 2026" from a 'YYYY-MM' key. */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/* A concrete YYYY-MM-DD date for a given day within a 'YYYY-MM' month
   (clamped to the month's length). */
export function dateForDay(key: string, day: number): string {
  const [y, m] = key.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const d = Math.min(Math.max(1, Math.round(day || 1)), lastDay);
  return `${key}-${pad(d)}`;
}

/* Today as YYYY-MM-DD. */
export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* Earliest date the planner may use for a month: today when planning the current
   month (so mid-month plans start from now), otherwise the 1st (undefined floor). */
export function floorForMonth(key: string): string | undefined {
  const t = todayStr();
  return key === t.slice(0, 7) ? t : undefined;
}

/* The next `n` plannable month keys starting from the current month. */
export function horizonMonths(n = 6): string[] {
  return Array.from({ length: n }, (_, i) => monthKey(new Date(), i));
}
