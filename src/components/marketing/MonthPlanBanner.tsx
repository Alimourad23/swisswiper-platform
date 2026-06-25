"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addPlanItems,
  dismissMonthPlan,
  generateMonthPlanNow,
  getMonthPlan,
  suggestMoreMonthPlan,
} from "@/lib/marketing/monthly-actions";
import { dateForDay, monthLabel, type MonthPlan, type MonthSuggestion } from "@/lib/marketing/monthly";
import { channels } from "@/lib/marketing/channels";
import { recommendedCount } from "@/lib/marketing/cadence";

type Item = MonthSuggestion & { date: string; selected: boolean };

function toItems(plan: MonthPlan): Item[] {
  return plan.suggestions.map((s) => ({ ...s, date: s.date ?? dateForDay(plan.month, s.day), selected: true }));
}
function channelName(key: string): string {
  return channels.find((c) => c.key === key)?.name ?? key;
}

export default function MonthPlanBanner({
  plan: initial,
  monthKey,
  months,
  countsByMonth,
}: {
  plan: MonthPlan | null;
  monthKey: string; // default (current) month
  months: string[]; // selectable horizon
  countsByMonth: Record<string, Record<string, number>>;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(monthKey);
  const [plan, setPlan] = useState<MonthPlan | null>(initial);
  const [items, setItems] = useState<Item[]>(initial ? toItems(initial) : []);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);

  const label = monthLabel(month);
  const counts = countsByMonth[month] ?? {};
  const monthMin = `${month}-01`;
  const [my, mm] = month.split("-").map(Number);
  const monthMax = `${month}-${String(new Date(my, mm, 0).getDate()).padStart(2, "0")}`;

  const setItem = (i: number, patch: Partial<Item>) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const selected = items.filter((it) => it.selected);

  async function switchMonth(next: string) {
    setMonth(next);
    setAdded(0);
    if (next === monthKey) {
      setPlan(initial);
      setItems(initial ? toItems(initial) : []);
      return;
    }
    setBusy(true);
    const p = await getMonthPlan(next);
    setPlan(p);
    setItems(p && p.status === "suggested" ? toItems(p) : []);
    setBusy(false);
  }
  async function generate() {
    setBusy(true);
    setAdded(0);
    const p = await generateMonthPlanNow(month);
    setPlan(p);
    setItems(p ? toItems(p) : []);
    setBusy(false);
  }
  async function more() {
    setBusy(true);
    const p = await suggestMoreMonthPlan(month);
    if (p) {
      setPlan(p);
      setItems(toItems(p));
    }
    setBusy(false);
  }
  async function addSelected() {
    if (selected.length === 0) return;
    setBusy(true);
    const r = await addPlanItems(
      month,
      selected.map((s) => ({ title: s.title, channel: s.channel, idea: s.idea, goal: s.goal, date: s.date })),
    );
    setBusy(false);
    setAdded(r.added);
    const addedKeys = new Set(selected.map((s) => `${s.channel}|${s.title}`));
    const remaining = items.filter((it) => !addedKeys.has(`${it.channel}|${it.title}`));
    setItems(remaining);
    if (remaining.length === 0) setPlan(null);
    router.refresh();
  }
  async function dismiss() {
    setBusy(true);
    await dismissMonthPlan(month);
    setPlan(null);
    setItems([]);
    setBusy(false);
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {channels.map((c) => {
          const have = counts[c.key] ?? 0;
          const rec = recommendedCount(c.key);
          return (
            <span key={c.key} className={have >= rec ? "text-emerald-700" : ""}>
              {c.name} {have}/{rec}
            </span>
          );
        })}
      </div>
      <label className="flex items-center gap-1 text-xs text-muted">
        Month
        <select value={month} onChange={(e) => switchMonth(e.target.value)} className="rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-ink focus:outline-none">
          {months.map((k) => (
            <option key={k} value={k}>
              {monthLabel(k)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  if (plan && plan.status === "suggested" && items.length > 0) {
    return (
      <div className="flex flex-col gap-2">
        {header}
        <div className="sw-card overflow-hidden border-peri-soft">
          <div className="flex items-center justify-between gap-3 border-b border-hairline bg-peri-soft/30 px-6 py-4">
            <div>
              <h3 className="text-base font-medium text-ink">✨ Alfred&apos;s plan for {label}</h3>
              <p className="text-xs text-hint">Tick the ones you want, tweak dates, then add them. Fills only the open gaps.</p>
            </div>
            <button type="button" onClick={dismiss} disabled={busy} className="shrink-0 text-xs text-muted transition-colors hover:text-ink">
              Dismiss
            </button>
          </div>

          <ul className="divide-y divide-hairline">
            {items.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-6 py-2.5">
                <input
                  type="checkbox"
                  checked={s.selected}
                  onChange={(e) => setItem(i, { selected: e.target.checked })}
                  className="h-4 w-4 shrink-0 accent-[#5c66a6]"
                />
                <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-[11px] font-medium capitalize text-muted">{channelName(s.channel)}</span>
                <span className="min-w-0 flex-1 text-sm font-medium text-ink">{s.title}</span>
                {s.goal && <span className="shrink-0 rounded-full bg-peri-soft px-2 py-0.5 text-[10px] font-medium text-peri-deep">{s.goal}</span>}
                <input
                  type="date"
                  value={s.date}
                  min={monthMin}
                  max={monthMax}
                  onChange={(e) => setItem(i, { date: e.target.value })}
                  className="shrink-0 rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-xs text-muted focus:outline-none"
                />
                {s.idea && <span className="w-full pl-6 text-xs text-muted">{s.idea}</span>}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-6 py-4">
            <button
              type="button"
              onClick={addSelected}
              disabled={busy || selected.length === 0}
              className="rounded-[var(--radius-control)] bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
            >
              {busy ? "Adding…" : `Add ${selected.length} to the pipeline`}
            </button>
            <button type="button" onClick={more} disabled={busy} className="rounded-full bg-peri-soft px-3 py-1.5 text-xs font-medium text-peri-deep transition-colors hover:brightness-95 disabled:opacity-50">
              Suggest more
            </button>
            <button type="button" onClick={generate} disabled={busy} className="rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink disabled:opacity-50">
              Start over
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {header}
      {added > 0 && (
        <p className="text-sm text-emerald-700">
          Added {added} post{added === 1 ? "" : "s"} for {label}. ✓
        </p>
      )}
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="self-start rounded-full bg-peri-soft px-4 py-1.5 text-sm font-medium text-peri-deep transition-colors hover:brightness-95 disabled:opacity-50"
      >
        {busy ? "Alfred is thinking…" : `✨ Plan ${label} with Alfred`}
      </button>
    </div>
  );
}
