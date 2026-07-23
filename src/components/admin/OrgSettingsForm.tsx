"use client";

import { useState } from "react";
import { saveOrgSettings } from "@/lib/admin/actions";
import type { OrgSettings } from "@/lib/admin/types";

/* Org-wide personalisation — brand name, timezone and working hours. These feed
   the platform's defaults (e.g. how dates and schedules read). Founder/Admin. */

const TIMEZONES = ["Europe/Zurich", "Europe/Istanbul", "Europe/London", "Europe/Paris", "America/New_York", "Asia/Dubai", "UTC"];

export default function OrgSettingsForm({ initial }: { initial: OrgSettings }) {
  const [s, setS] = useState<OrgSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (p: Partial<OrgSettings>) => { setS((v) => ({ ...v, ...p })); setSaved(false); };

  async function save() {
    setSaving(true);
    await saveOrgSettings(s);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  }

  const tzOptions = TIMEZONES.includes(s.timezone) ? TIMEZONES : [s.timezone, ...TIMEZONES];

  return (
    <div className="sw-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
        <div>
          <h3 className="text-[14px] font-medium">Organisation settings</h3>
          <p className="text-[11px] text-hint">Brand and defaults used across the platform.</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-peri-deep px-4 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-60"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save settings"}
        </button>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-ink">Brand name</span>
          <input
            value={s.brandName}
            onChange={(e) => set({ brandName: e.target.value })}
            className="rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:border-peri-deep focus:outline-none"
          />
          <span className="text-[11px] text-hint">Shown across the app and on reports.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-ink">Timezone</span>
          <select
            value={s.timezone}
            onChange={(e) => set({ timezone: e.target.value })}
            className="rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:border-peri-deep focus:outline-none"
          >
            {tzOptions.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
          <span className="text-[11px] text-hint">Default timezone for schedules and reminders.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-ink">Working hours</span>
          <input
            value={s.workingHours}
            onChange={(e) => set({ workingHours: e.target.value })}
            placeholder="09:00–18:00"
            className="rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none"
          />
          <span className="text-[11px] text-hint">Used to frame the day across the platform.</span>
        </label>
      </div>
    </div>
  );
}
