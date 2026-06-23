"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Task } from "@/lib/tasks/types";
import { getTodayRows, planToday, setEstimate, type PlanRow } from "@/lib/tasks/today";

/* The day's home on the dashboard. Reads the state of your plan and reacts the
   way Alfred would: showcase progress, offer to set today up, or offer to carry
   yesterday's unfinished tasks forward. "Today" follows the device timezone. */

const TARGET_MIN = 6 * 60;

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtH(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}
function planDay() {
  window.dispatchEvent(
    new CustomEvent("sw-alfred-summon", {
      detail: { seed: "Help me plan my day — what should I focus on today, and roughly how long will each take?" },
    }),
  );
}

export default function DashboardToday({
  tasks,
  userId,
  firstName,
}: {
  tasks: Task[];
  userId: string | null;
  firstName: string;
}) {
  const today = useMemo(() => dateOffset(0), []);
  const yesterday = useMemo(() => dateOffset(-1), []);
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [carry, setCarry] = useState<PlanRow[]>([]);
  const [carrying, setCarrying] = useState(false);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  useEffect(() => {
    let live = true;
    getTodayRows(today).then((r) => live && setRows(r));
    getTodayRows(yesterday).then((r) => {
      if (!live) return;
      // Yesterday's planned tasks that still aren't done.
      const unfinished = r.filter((row) => {
        const t = taskById.get(row.task_id);
        return t && !t.deleted_at && t.status !== "done";
      });
      setCarry(unfinished);
    });
    return () => {
      live = false;
    };
  }, [today, yesterday, taskById]);

  const items = (rows ?? [])
    .map((r) => ({ row: r, task: taskById.get(r.task_id) }))
    .filter((x): x is { row: PlanRow; task: Task } => !!x.task && !x.task.deleted_at);
  const done = items.filter((i) => i.task.status === "done").length;
  const open = items.filter((i) => i.task.status !== "done");
  const remainingMin = open.reduce((n, i) => n + i.row.estimate_min, 0);

  async function carryForward() {
    if (carrying) return;
    setCarrying(true);
    const toAdd = carry.filter((c) => !(rows ?? []).some((r) => r.task_id === c.task_id));
    await Promise.all(toAdd.map((c) => planToday(c.task_id, today, c.estimate_min)));
    await Promise.all(toAdd.map((c) => setEstimate(c.task_id, today, c.estimate_min)));
    const fresh = await getTodayRows(today);
    setRows(fresh);
    setCarry([]);
    setCarrying(false);
  }

  // ── Loading ──
  if (rows === null) {
    return <div className="py-5 text-sm text-muted">Reading your day…</div>;
  }

  // ── Showcase: a plan exists ──
  if (items.length > 0) {
    const pct = items.length ? Math.round((done / items.length) * 100) : 0;
    const line =
      open.length === 0
        ? `Everything planned for today is done — ${firstName}, that's the whole list. 🎯`
        : done === 0
          ? `${open.length} on today's plan, about ${fmtH(remainingMin)} of focused work.`
          : `${done} of ${items.length} done — about ${fmtH(remainingMin)} left.`;
    return (
      <div className="py-5">
        <p className="text-sm text-ink">{line}</p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg">
          <div className="h-full rounded-full bg-peri-deep" style={{ width: `${pct}%` }} />
        </div>
        <ul className="mt-4 flex flex-col gap-1.5">
          {open.slice(0, 4).map((i) => (
            <li key={i.task.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-muted">{i.task.title}</span>
              <span className="shrink-0 text-xs text-hint">{fmtH(i.row.estimate_min)}</span>
            </li>
          ))}
          {open.length > 4 && <li className="text-xs text-hint">+{open.length - 4} more</li>}
        </ul>
        <Link href="/dashboard/tasks" className="mt-4 inline-block text-sm font-medium text-peri-deep hover:underline">
          Open today →
        </Link>
      </div>
    );
  }

  // ── Continue: nothing planned, but yesterday left unfinished ──
  if (carry.length > 0) {
    return (
      <div className="py-5">
        <p className="text-sm text-ink">
          Nothing planned yet, {firstName} — but {carry.length} task{carry.length === 1 ? "" : "s"} from yesterday
          {carry.length === 1 ? " is" : " are"} still open. Carry {carry.length === 1 ? "it" : "them"} into today?
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={carryForward}
            disabled={carrying}
            className="rounded-full bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
          >
            {carrying ? "Carrying…" : `Carry ${carry.length} into today`}
          </button>
          <button type="button" onClick={planDay} className="text-sm font-medium text-peri-deep hover:underline">
            Plan with Alfred
          </button>
        </div>
      </div>
    );
  }

  // ── Create: a clean slate ──
  return (
    <div className="py-5">
      <p className="text-sm text-ink">Nothing planned for today yet, {firstName}. Shall we set it up?</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={planDay}
          className="rounded-full bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793]"
        >
          Plan today with Alfred
        </button>
        <Link href="/dashboard/tasks" className="text-sm font-medium text-peri-deep hover:underline">
          Plan it myself →
        </Link>
      </div>
    </div>
  );
}
