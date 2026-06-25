"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { applyMonthPlan, dismissMonthPlan, generateMonthPlanNow } from "@/lib/marketing/monthly-actions";
import { monthLabel, type MonthPlan } from "@/lib/marketing/monthly";

/* Shows Alfred's suggested plan for next month (when one exists) with a one-click
   "Add all to the pipeline". When there's no suggested plan, offers a quiet
   "Plan {month} with Alfred" button so the founder can prompt it any time. */

export default function MonthPlanBanner({ plan: initial, monthKey }: { plan: MonthPlan | null; monthKey: string }) {
  const router = useRouter();
  const [plan, setPlan] = useState<MonthPlan | null>(initial);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);
  const label = monthLabel(monthKey);

  async function generate() {
    setBusy(true);
    const p = await generateMonthPlanNow(monthKey);
    if (p) setPlan(p);
    setBusy(false);
  }
  async function apply() {
    if (!plan) return;
    setBusy(true);
    const r = await applyMonthPlan(plan.month);
    setPlan(null);
    setAdded(r.added);
    setBusy(false);
    router.refresh();
  }
  async function dismiss() {
    if (!plan) return;
    setBusy(true);
    await dismissMonthPlan(plan.month);
    setPlan(null);
    setBusy(false);
  }

  if (plan && plan.status === "suggested") {
    return (
      <div className="sw-card overflow-hidden border-peri-soft">
        <div className="flex items-center justify-between gap-3 border-b border-hairline bg-peri-soft/30 px-6 py-4">
          <div>
            <h3 className="text-base font-medium text-ink">✨ Alfred drafted a plan for {label}</h3>
            <p className="text-xs text-hint">{label} was looking light — review these and add them in one click.</p>
          </div>
          <button type="button" onClick={dismiss} disabled={busy} className="shrink-0 text-xs text-muted transition-colors hover:text-ink">
            Dismiss
          </button>
        </div>

        <ul className="divide-y divide-hairline">
          {plan.suggestions.map((s, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-6 py-2.5">
              <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-[11px] font-medium capitalize text-muted">{s.channel}</span>
              <span className="text-sm font-medium text-ink">{s.title}</span>
              <span className="shrink-0 text-[11px] text-hint">· {label.split(" ")[0]} {s.day}</span>
              {s.idea && <span className="w-full text-xs text-muted">{s.idea}</span>}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2 border-t border-hairline px-6 py-4">
          <button
            type="button"
            onClick={apply}
            disabled={busy}
            className="rounded-[var(--radius-control)] bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
          >
            {busy ? "Adding…" : `Add all ${plan.suggestions.length} to the pipeline`}
          </button>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="rounded-full bg-peri-soft px-3 py-1.5 text-xs font-medium text-peri-deep transition-colors hover:brightness-95 disabled:opacity-50"
          >
            Regenerate
          </button>
        </div>
      </div>
    );
  }

  if (added > 0) {
    return (
      <p className="text-sm text-emerald-700">
        Added {added} post{added === 1 ? "" : "s"} to your pipeline for {label}. ✓
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={generate}
      disabled={busy}
      className="self-start rounded-full bg-peri-soft px-4 py-1.5 text-sm font-medium text-peri-deep transition-colors hover:brightness-95 disabled:opacity-50"
    >
      {busy ? "Alfred is thinking…" : `✨ Plan ${label} with Alfred`}
    </button>
  );
}
