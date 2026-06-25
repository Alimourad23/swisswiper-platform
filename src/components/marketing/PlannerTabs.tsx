"use client";

import { useState } from "react";
import MonthPlanBanner from "@/components/marketing/MonthPlanBanner";
import ManualPlanner from "@/components/marketing/ManualPlanner";
import type { MonthPlan } from "@/lib/marketing/monthly";

/* Two ways to plan a month: let Alfred suggest, or plan ahead yourself. */
export default function PlannerTabs({
  plan,
  monthKey,
  counts,
}: {
  plan: MonthPlan | null;
  monthKey: string;
  counts: Record<string, number>;
}) {
  const [tab, setTab] = useState<"alfred" | "manual">("alfred");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex w-fit rounded-full bg-bg p-0.5 text-xs">
        {(
          [
            ["alfred", "Plan with Alfred"],
            ["manual", "Plan myself"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
              tab === key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "alfred" ? (
        <MonthPlanBanner plan={plan} monthKey={monthKey} counts={counts} />
      ) : (
        <div className="sw-card px-6 py-5">
          <ManualPlanner monthKey={monthKey} />
        </div>
      )}
    </div>
  );
}
