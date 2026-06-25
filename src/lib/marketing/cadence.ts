/* Best-practice posting cadence per channel, and an auto-scheduler that spreads a
   list of post titles across a month on each channel's recommended days. Pure +
   client-importable. These are sensible general defaults (not gospel) — easy to
   tune later or override per post. Weekday: 0=Sun … 6=Sat. */

export type Cadence = {
  days: number[]; // preferred weekdays
  time: string; // recommended time of day (HH:mm) — informational
  perMonth: number; // recommended posts per month
  note: string; // human-readable rationale
};

export const CADENCE: Record<string, Cadence> = {
  linkedin: { days: [2, 3, 4], time: "10:00", perMonth: 12, note: "Tue–Thu mornings · ~3/week" },
  instagram: { days: [1, 2, 3, 4, 5], time: "11:00", perMonth: 16, note: "Weekdays · ~4/week" },
  tiktok: { days: [0, 1, 2, 3, 4, 5, 6], time: "19:00", perMonth: 20, note: "Most days, evenings · ~5/week" },
  youtube: { days: [4, 5, 6], time: "15:00", perMonth: 4, note: "Thu–Sat afternoons · ~1/week" },
  website: { days: [2, 3], time: "10:00", perMonth: 2, note: "Mid-week · ~2/month" },
};

export function cadenceFor(channel: string): Cadence {
  return CADENCE[channel] ?? CADENCE.linkedin;
}

export function recommendedCount(channel: string): number {
  return cadenceFor(channel).perMonth;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/* All YYYY-MM-DD dates in a 'YYYY-MM' month whose weekday is in `days`. */
export function candidateDates(monthKey: string, days: number[]): string[] {
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

export type AssignOpts = {
  /** Earliest allowed date (YYYY-MM-DD) — e.g. today for the current month. */
  floor?: string;
  /** Dates already used per channel, so we don't double-book a slot. */
  takenByChannel?: Record<string, string[]>;
};

/* Assign each item an OPEN best-practice date within `monthKey`: on the channel's
   recommended weekdays, on/after `floor`, skipping dates already taken for that
   channel (and de-duplicating within the batch). Returns dates aligned to input.
   Falls back to wrapping when there are more items than open slots. */
export function assignOpenDates(monthKey: string, items: { channel: string }[], opts: AssignOpts = {}): string[] {
  const taken: Record<string, Set<string>> = {};
  for (const [ch, ds] of Object.entries(opts.takenByChannel ?? {})) taken[ch] = new Set(ds);

  const byChannel = new Map<string, number[]>();
  items.forEach((it, i) => {
    const list = byChannel.get(it.channel) ?? [];
    list.push(i);
    byChannel.set(it.channel, list);
  });

  const out: string[] = new Array(items.length).fill("");
  for (const [channel, indices] of byChannel) {
    const cad = cadenceFor(channel);
    const used = taken[channel] ?? new Set<string>();
    const open = candidateDates(monthKey, cad.days).filter((d) => (!opts.floor || d >= opts.floor) && !used.has(d));
    const fallback =
      open[0] ?? candidateDates(monthKey, cad.days).find((d) => !opts.floor || d >= opts.floor) ?? opts.floor ?? `${monthKey}-15`;
    const picks = pickEven(open, indices.length);
    indices.forEach((idx, j) => {
      const date = picks[j] ?? fallback;
      out[idx] = date;
      used.add(date); // don't reuse within this batch
    });
    taken[channel] = used;
  }
  return out;
}

/* Manual planner: assign each item a date within `monthKey` on its channel's
   recommended days, never before `floor` (today, for the current month). */
export function autoSchedule(monthKey: string, items: PlanItem[], floor?: string): ScheduledItem[] {
  const valid = items.filter((it) => it.title.trim());
  const dates = assignOpenDates(monthKey, valid, { floor });
  return valid.map((it, i) => ({
    title: it.title.trim(),
    channel: it.channel,
    date: dates[i] || `${monthKey}-15`,
    time: cadenceFor(it.channel).time,
  }));
}
