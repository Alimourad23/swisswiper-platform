"use client";

import { useState } from "react";
import { savePlan } from "@/lib/marketing/plan-actions";
import { PLAN_FIELDS, type MarketingPlan } from "@/lib/marketing/plan";

export default function MarketingPlanCard({ initial }: { initial: MarketingPlan }) {
  const [plan, setPlan] = useState<MarketingPlan>(initial);
  const hasPlan = Object.values(initial).some((v) => v.trim());
  const [open, setOpen] = useState(!hasPlan); // open by default if empty
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function set(key: keyof MarketingPlan, value: string) {
    setPlan((p) => ({ ...p, [key]: value }));
    setDirty(true);
    setSaved(false);
  }
  async function save() {
    if (saving) return;
    setSaving(true);
    const r = await savePlan(plan);
    setSaving(false);
    if (r.ok) {
      setDirty(false);
      setSaved(true);
    }
  }

  const summary = plan.goals.trim() || plan.positioning.trim();

  return (
    <div className="sw-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-[14px] font-medium">Marketing plan</h3>
          <p className="truncate text-xs text-hint">
            {summary || "Set your north star — goals, audience, positioning, pillars, cadence."}
          </p>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-hint transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-hairline px-6 py-5">
          {PLAN_FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-hint">{f.label}</span>
              <textarea
                value={plan[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={f.key === "budget" ? 1 : 2}
                className="w-full resize-y rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none"
              />
            </label>
          ))}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="rounded-[var(--radius-control)] bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save plan"}
            </button>
            {saved && !dirty && <span className="text-xs text-emerald-600">Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}
