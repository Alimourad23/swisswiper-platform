/* Best-practice posting cadence per channel, and an auto-scheduler that spreads a
   list of post titles across a month on each channel's recommended days. Pure +
   client-importable. These are sensible general defaults (not gospel) — easy to
   tune later or override per post. Weekday: 0=Sun … 6=Sat. */

export type Cadence = {
  days: number[]; // preferred weekdays
  time: string; // recommended time of day (HH:mm) — informational
  note: string; // human-readable rationale
};

export const CADENCE: Record<string, Cadence> = {
  linkedin: { days: [2, 3, 4], time: "10:00", note: "Tue–Thu mornings" },
  instagram: { days: [1, 2, 3, 4, 5], time: "11:00", note: "Weekdays, late morning" },
  tiktok: { days: [0, 1, 2, 3, 4, 5, 6], time: "19:00", note: "Most days, evenings" },
  youtube: { days: [4, 5, 6], time: "15:00", note: "Thu–Sat afternoons" },
  website: { days: [2, 3], time: "10:00", note: "Mid-week" },
};

export function cadenceFor(channel: string): Cadence {
  return CADENCE[channel] ?? CADENCE.linkedin;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/* All YYYY-MM-DD dates in a 'YYYY-MM' month whose weekday is in `days`. */
function candidateDates(monthKey: string, days: number[]): string[] {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d++) {
    const wd = new Date(y, m - 1, d).getDay();
    if (days.includes(wd)) out.push(`${monthKey}-${pad(d)}`);
  }
  return out;
}

/* Pick `k` dates from candidates, spread as evenly as possible across the month.
   If there are more items than slots, it wraps (allowing more than one per day). */
function pickEven(cands: string[], k: number): string[] {
  if (k <= 0 || cands.length === 0) return [];
  if (k >= cands.length) return Array.from({ length: k }, (_, i) => cands[i % cands.length]);
  return Array.from({ length: k }, (_, i) => cands[Math.round((i * (cands.length - 1)) / (k - 1 || 1))]);
}

export type PlanItem = { title: string; channel: string };
export type ScheduledItem = PlanItem & { date: string; time: string };

/* Assign each item a date within `monthKey`, per its channel's cadence. Items are
   grouped by channel, distributed across that channel's recommended days, then
   returned in the original order. */
export function autoSchedule(monthKey: string, items: PlanItem[]): ScheduledItem[] {
  const valid = items.filter((it) => it.title.trim());
  // Group indices by channel to preserve input order on the way out.
  const byChannel = new Map<string, number[]>();
  valid.forEach((it, i) => {
    const list = byChannel.get(it.channel) ?? [];
    list.push(i);
    byChannel.set(it.channel, list);
  });

  const dateByIndex = new Map<number, string>();
  for (const [channel, indices] of byChannel) {
    const cad = cadenceFor(channel);
    const dates = pickEven(candidateDates(monthKey, cad.days), indices.length);
    indices.forEach((idx, j) => dateByIndex.set(idx, dates[j] ?? `${monthKey}-15`));
  }

  return valid.map((it, i) => ({
    title: it.title.trim(),
    channel: it.channel,
    date: dateByIndex.get(i) ?? `${monthKey}-15`,
    time: cadenceFor(it.channel).time,
  }));
}
