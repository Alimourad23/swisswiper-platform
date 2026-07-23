"use client";

import { useState } from "react";
import { saveAccessPolicy } from "@/lib/admin/actions";
import { MODULES, ROLES, withAccessDefaults, type AccessPolicy, type Role } from "@/lib/auth/roles";

/* Which role sees which module. Founder always sees everything (locked on).
   Admin / Member / Viewer are editable. */

const EDITABLE: Role[] = ["admin", "member", "viewer"];

export default function AccessMatrix({ policy: initial }: { policy: AccessPolicy }) {
  const [policy, setPolicy] = useState<AccessPolicy>(withAccessDefaults(initial));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const has = (role: Role, mod: string) => policy[role].includes(mod);
  const toggle = (role: Role, mod: string) => {
    setSaved(false);
    setPolicy((p) => {
      const set = new Set(p[role]);
      if (set.has(mod)) set.delete(mod);
      else set.add(mod);
      return { ...p, [role]: MODULES.filter((m) => set.has(m.key)).map((m) => m.key) };
    });
  };

  async function save() {
    setSaving(true);
    await saveAccessPolicy(policy);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  }

  const roleLabel = (k: Role) => ROLES.find((r) => r.key === k)?.label ?? k;

  return (
    <div className="sw-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
        <div>
          <h3 className="text-[14px] font-medium">Access control</h3>
          <p className="text-[11px] text-hint">Tick the modules each role can open. Founders always see everything.</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-peri-deep px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-60"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save access"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-hairline text-hint">
              <th className="px-5 py-2 text-left font-medium">Module</th>
              <th className="px-3 py-2 text-center font-medium">Founder</th>
              {EDITABLE.map((r) => (
                <th key={r} className="px-3 py-2 text-center font-medium">{roleLabel(r)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((mod) => (
              <tr key={mod.key} className="border-b border-hairline last:border-0">
                <td className="px-5 py-2.5 text-left font-medium text-ink">{mod.label}</td>
                <td className="px-3 py-2.5 text-center">
                  <span title="Founders always have full access" className="text-hint">✓</span>
                </td>
                {EDITABLE.map((r) => (
                  <td key={r} className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={has(r, mod.key)}
                      onChange={() => toggle(r, mod.key)}
                      className="h-4 w-4 accent-[#5c66a6]"
                      aria-label={`${roleLabel(r)} can access ${mod.label}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-hairline px-5 py-2.5 text-[11px] text-hint">
        This controls what each role sees in the sidebar. Enforcement across every page is being wired next — for now it drives the menu and the access map.
      </p>
    </div>
  );
}
