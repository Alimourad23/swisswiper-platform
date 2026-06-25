"use client";

import { useState } from "react";
import { setBudget, type UsageView } from "@/lib/marketing/ai-usage-actions";

/* AI spend this month vs the monthly cap, with a founder-only cap editor.
   Estimates — actual Google billing is the source of truth. */
export default function AiUsageCard({ usage }: { usage: UsageView }) {
  const [cap, setCap] = useState(usage.cap);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const pct = cap > 0 ? Math.min(100, Math.round((usage.spend / cap) * 100)) : 0;
  const over = usage.spend >= cap;
  const bar = over ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-peri-deep";

  async function save() {
    setBusy(true);
    await setBudget(cap);
    setBusy(false);
    setEditing(false);
  }

  return (
    <div className="sw-card px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-medium text-ink">AI spend this month</h3>
        <span className={`text-sm font-medium ${over ? "text-red-600" : "text-ink"}`}>
          ~${usage.spend.toFixed(2)} <span className="text-hint">/ ${cap.toFixed(0)}</span>
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-hint">
        <span>
          {usage.images} image{usage.images === 1 ? "" : "s"}
          {usage.videoSeconds > 0 ? ` · ${usage.videoSeconds}s video` : ""} · estimated
        </span>
        {usage.isFounder &&
          (editing ? (
            <span className="flex items-center gap-1">
              Cap $
              <input
                type="number"
                min={0}
                value={cap}
                onChange={(e) => setCap(Number(e.target.value))}
                className="w-16 rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-xs text-ink focus:outline-none"
              />
              <button type="button" onClick={save} disabled={busy} className="font-medium text-peri-deep hover:underline disabled:opacity-50">
                {busy ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => { setCap(usage.cap); setEditing(false); }} className="text-muted hover:text-ink">
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="font-medium text-peri-deep hover:underline">
              Edit cap
            </button>
          ))}
      </div>

      {over && <p className="mt-2 text-xs text-red-600">Cap reached — generation is paused until next month or until the cap is raised.</p>}
    </div>
  );
}
