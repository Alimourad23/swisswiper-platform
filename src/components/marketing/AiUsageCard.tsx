"use client";

import { useState } from "react";
import { setBudget, setCredit, type UsageView } from "@/lib/marketing/ai-usage-actions";

/* AI credit + spend. Leads with the prepaid credit remaining (what you bought
   from Google, counted down by our per-generation estimates), with the monthly
   spend and cap underneath. Founder can set the credit balance and the cap.
   Estimates — actual Google billing is the source of truth. */
export default function AiUsageCard({ usage }: { usage: UsageView }) {
  const [cap, setCapVal] = useState(usage.cap);
  const [credit, setCreditVal] = useState(usage.credit);
  const [editing, setEditing] = useState<"none" | "credit" | "cap">("none");
  const [busy, setBusy] = useState(false);

  const hasCredit = usage.credit > 0;
  const remaining = Math.round((usage.credit - usage.spentAllTime) * 100) / 100;
  const usedPct = hasCredit ? Math.min(100, Math.max(0, Math.round((usage.spentAllTime / usage.credit) * 100))) : 0;
  const low = hasCredit && remaining <= usage.credit * 0.15;
  const empty = hasCredit && remaining <= 0;
  const bar = empty ? "bg-red-500" : low ? "bg-amber-500" : "bg-peri-deep";

  async function saveCredit() {
    setBusy(true);
    await setCredit(credit);
    setBusy(false);
    setEditing("none");
  }
  async function saveCap() {
    setBusy(true);
    await setBudget(cap);
    setBusy(false);
    setEditing("none");
  }

  return (
    <div className="sw-card px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-medium text-ink">AI credit</h3>
        {hasCredit ? (
          <span className={`text-sm font-medium ${empty ? "text-red-600" : low ? "text-amber-700" : "text-ink"}`}>
            ≈ ${Math.max(0, remaining).toFixed(2)} <span className="text-hint">left of ${usage.credit.toFixed(2)}</span>
          </span>
        ) : (
          <span className="text-sm text-hint">No balance set</span>
        )}
      </div>

      {hasCredit && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-bg">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${usedPct}%` }} />
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-hint">
        <span>
          ${usage.spend.toFixed(2)} this month{usage.cap > 0 ? ` · cap $${usage.cap.toFixed(0)}` : ""} ·{" "}
          {usage.images} image{usage.images === 1 ? "" : "s"}
          {usage.videoSeconds > 0 ? ` · ${usage.videoSeconds}s video` : ""} · estimated
        </span>
        {usage.isFounder && editing === "none" && (
          <span className="flex items-center gap-3">
            <button type="button" onClick={() => setEditing("credit")} className="font-medium text-peri-deep hover:underline">
              {hasCredit ? "Update credit" : "Set credit"}
            </button>
            <button type="button" onClick={() => setEditing("cap")} className="font-medium text-peri-deep hover:underline">
              Edit cap
            </button>
          </span>
        )}
      </div>

      {usage.isFounder && editing === "credit" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3 text-xs">
          <span className="text-muted">Credit balance you bought $</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={credit}
            onChange={(e) => setCreditVal(Number(e.target.value))}
            className="w-24 rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-ink focus:outline-none"
          />
          <button type="button" onClick={saveCredit} disabled={busy} className="font-medium text-peri-deep hover:underline disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => { setCreditVal(usage.credit); setEditing("none"); }} className="text-muted hover:text-ink">
            Cancel
          </button>
          <span className="w-full text-hint">Set this to what you topped up on Google. We count it down by our per-generation estimates.</span>
        </div>
      )}

      {usage.isFounder && editing === "cap" && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-hairline pt-3 text-xs">
          <span className="text-muted">Monthly spend cap $</span>
          <input
            type="number"
            min={0}
            value={cap}
            onChange={(e) => setCapVal(Number(e.target.value))}
            className="w-20 rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-ink focus:outline-none"
          />
          <button type="button" onClick={saveCap} disabled={busy} className="font-medium text-peri-deep hover:underline disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => { setCapVal(usage.cap); setEditing("none"); }} className="text-muted hover:text-ink">
            Cancel
          </button>
        </div>
      )}

      {empty && <p className="mt-2 text-xs text-red-600">Estimated credit used up — top up on Google, then update the balance here. (Monthly cap still applies.)</p>}
      {low && !empty && <p className="mt-2 text-xs text-amber-700">Running low — consider topping up soon.</p>}
    </div>
  );
}
