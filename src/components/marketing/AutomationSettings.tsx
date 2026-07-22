"use client";

import { useState } from "react";
import { saveAutomationPolicy } from "@/lib/marketing/automation-actions";
import { CATEGORIES, autoCount, type AutomationPolicy, type CatKey } from "@/lib/marketing/automation";

/* The graduation switches — set, per category, whether Alfred's reply stays
   approval-first or auto-sends. Sensitive categories are locked to approval. */

export default function AutomationSettings({ initial }: { initial: AutomationPolicy }) {
  const [policy, setPolicy] = useState<AutomationPolicy>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k: CatKey, v: "approve" | "auto") => { setPolicy((p) => ({ ...p, [k]: v })); setSaved(false); };

  async function save() {
    setSaving(true);
    await saveAutomationPolicy(policy);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  const autos = autoCount(policy);

  return (
    <div className="sw-card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-medium">Automation policy</h3>
          <p className="mt-0.5 text-[11px] text-hint">
            {autos === 0 ? "Everything approval-first — nothing sends itself." : `${autos} categor${autos === 1 ? "y" : "ies"} set to auto.`}
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-peri-deep px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-peri-deeper disabled:opacity-60"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save policy"}
        </button>
      </div>

      <div className="flex flex-col divide-y divide-hairline">
        {CATEGORIES.map((c) => {
          const val = policy[c.key];
          return (
            <div key={c.key} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-medium text-ink">{c.label}</span>
                  {c.voice !== "—" && <span className="rounded-full bg-peri-soft px-1.5 py-0.5 text-[9.5px] font-medium text-peri-deep">{c.voice}</span>}
                  {!c.autoEligible && <span className="text-[10px] text-hint">🔒 approval-first</span>}
                </div>
                <p className="mt-0.5 text-[11px] text-muted">{c.note}</p>
              </div>

              <div className="flex shrink-0 rounded-[var(--radius-control)] border border-hairline p-0.5">
                <button
                  onClick={() => set(c.key, "approve")}
                  className={[
                    "rounded-[8px] px-2.5 py-1 text-[11px] font-medium transition-colors",
                    val === "approve" ? "bg-peri-soft text-peri-deep" : "text-muted hover:text-ink",
                  ].join(" ")}
                >
                  Approve
                </button>
                <button
                  onClick={() => c.autoEligible && set(c.key, "auto")}
                  disabled={!c.autoEligible}
                  title={c.autoEligible ? "Alfred sends these automatically" : "Locked to approval-first"}
                  className={[
                    "rounded-[8px] px-2.5 py-1 text-[11px] font-medium transition-colors",
                    !c.autoEligible ? "cursor-not-allowed text-hint/50" : val === "auto" ? "bg-peri-soft text-peri-deep" : "text-muted hover:text-ink",
                  ].join(" ")}
                >
                  Auto
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-hint">
        Alfred drafts every reply in your voice today; you approve each send. When you set a safe category to Auto, Alfred
        will handle those on his own — this switches fully on once Instagram’s live webhook is connected, so until then even
        “Auto” categories stay draft-first for your review.
      </p>
    </div>
  );
}
