"use client";

import { useState } from "react";
import { saveOkrs } from "@/lib/marketing/okr-actions";
import type { Okrs } from "@/lib/marketing/okr";
import EditGate from "./EditGate";

type Scope = "company" | "linkedin" | "instagram" | "website";
const SCOPES: { key: Scope; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "instagram", label: "Instagram" },
  { key: "website", label: "Website" },
];

export default function OkrEditor({ initial, canEdit = true }: { initial: Okrs; canEdit?: boolean }) {
  const [okrs, setOkrs] = useState<Okrs>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const setObjective = (v: string) => setOkrs((o) => ({ ...o, objective: v }));
  const setTarget = (scope: Scope, i: number, target: number) =>
    setOkrs((o) => ({ ...o, [scope]: o[scope].map((kr, j) => (j === i ? { ...kr, target } : kr)) }));

  async function save() {
    setSaving(true);
    await saveOkrs(okrs);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  return (
    <EditGate canEdit={canEdit}>
    <div className="sw-card flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-medium">Objectives &amp; key results</h3>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-peri-deep px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-peri-deeper disabled:opacity-60"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save targets"}
        </button>
      </div>

      <div>
        <label className="text-[10px] font-medium uppercase tracking-[0.14em] text-hint">Objective</label>
        <input
          value={okrs.objective}
          onChange={(e) => setObjective(e.target.value)}
          className="mt-1 w-full rounded-[var(--radius-control)] border border-hairline bg-bg px-3 py-2 text-[13px] text-ink focus:border-peri-deep focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SCOPES.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-hint">{label}</p>
            {okrs[key].map((kr, i) => (
              <div key={kr.key} className="flex items-center gap-2">
                <span className="flex-1 text-[12.5px] text-muted">{kr.label}</span>
                <input
                  type="number"
                  value={kr.target}
                  onChange={(e) => setTarget(key, i, Number(e.target.value))}
                  className="w-20 rounded-[8px] border border-hairline bg-bg px-2 py-1 text-right text-[12.5px] text-ink focus:border-peri-deep focus:outline-none"
                />
                <span className="w-8 text-[11px] text-hint">{kr.unit ?? ""}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-hint">
        Targets flow into the marketing overview (company) and each channel’s Overview (its own KPIs). Progress is
        measured against your live numbers.
      </p>
    </div>
    </EditGate>
  );
}
