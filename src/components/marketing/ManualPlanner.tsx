"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { channels } from "@/lib/marketing/channels";
import { autoSchedule, cadenceFor, type ScheduledItem } from "@/lib/marketing/cadence";
import { floorForMonth, monthLabel } from "@/lib/marketing/monthly";
import { createPostsBulk } from "@/lib/marketing/schedule-actions";

/* Plan-ahead-yourself: type post titles, pick a channel, and the planner spreads
   them across the chosen month on each channel's recommended posting days. Review
   the dates, then add them all to the pipeline. */

type Row = { title: string; channel: string };

function fmtDate(d: string): string {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const inputCls =
  "rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none";

export default function ManualPlanner({ months }: { months: string[] }) {
  const router = useRouter();
  const [month, setMonth] = useState(months[0]);
  const [rows, setRows] = useState<Row[]>([
    { title: "", channel: "linkedin" },
    { title: "", channel: "linkedin" },
    { title: "", channel: "linkedin" },
  ]);
  const [scheduled, setScheduled] = useState<ScheduledItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(0);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addRow = () => setRows((r) => [...r, { title: "", channel: "linkedin" }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, j) => j !== i));

  const filled = rows.filter((r) => r.title.trim());

  function schedule() {
    setAdded(0);
    // Never schedule before today when planning the current month.
    setScheduled(autoSchedule(month, rows, floorForMonth(month)));
  }

  async function addAll() {
    if (!scheduled || scheduled.length === 0) return;
    setBusy(true);
    const r = await createPostsBulk(
      scheduled.map((s) => ({ title: s.title, channel: s.channel, scheduledFor: s.date, notes: `Best time: ${s.time}` })),
    );
    setBusy(false);
    setAdded(r.added);
    setScheduled(null);
    setRows([{ title: "", channel: "linkedin" }]);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-hint">
          Type your titles, pick a channel — the planner spreads them across the month on each channel&apos;s best days.
        </p>
        <label className="flex items-center gap-1 text-xs text-muted">
          Month
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-ink focus:outline-none">
            {months.map((k) => (
              <option key={k} value={k}>
                {monthLabel(k)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={r.title}
              onChange={(e) => setRow(i, { title: e.target.value })}
              placeholder="Post title or hook…"
              className={`${inputCls} min-w-0 flex-1`}
            />
            <select
              value={r.channel}
              onChange={(e) => setRow(i, { channel: e.target.value })}
              className="shrink-0 rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-2 text-sm text-muted focus:outline-none"
            >
              {channels.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
            {rows.length > 1 && (
              <button type="button" onClick={() => removeRow(i)} aria-label="Remove" className="shrink-0 text-xs text-hint transition-colors hover:text-red-600">
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={addRow} className="rounded-full bg-bg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink">
          + Add row
        </button>
        <button
          type="button"
          onClick={schedule}
          disabled={filled.length === 0}
          className="rounded-[var(--radius-control)] bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
        >
          Auto-schedule across {monthLabel(month)}
        </button>
      </div>

      {/* Preview of computed dates */}
      {scheduled && scheduled.length > 0 && (
        <div className="rounded-[var(--radius-control)] border border-hairline bg-bg">
          <ul className="divide-y divide-hairline">
            {scheduled.map((s, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-4 py-2.5 text-sm">
                <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium capitalize text-muted">{s.channel}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{s.title}</span>
                <span className="shrink-0 text-xs text-peri-deep">{fmtDate(s.date)}</span>
                <span className="shrink-0 text-[11px] text-hint">{s.time}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 border-t border-hairline px-4 py-3">
            <span className="text-[11px] text-hint">Dates follow general best-practice cadence per channel — drag to adjust later on the calendar.</span>
            <button
              type="button"
              onClick={addAll}
              disabled={busy}
              className="shrink-0 rounded-[var(--radius-control)] bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
            >
              {busy ? "Adding…" : `Add ${scheduled.length} to the pipeline`}
            </button>
          </div>
        </div>
      )}

      {added > 0 && (
        <p className="text-sm text-emerald-700">Added {added} post{added === 1 ? "" : "s"} to your pipeline. ✓</p>
      )}

      {/* Cadence legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
        {channels.map((c) => (
          <span key={c.key} className="text-[11px] text-hint">
            {c.name}: {cadenceFor(c.key).note}
          </span>
        ))}
      </div>
    </div>
  );
}
