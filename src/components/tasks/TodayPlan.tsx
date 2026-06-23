"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/tasks/types";
import { getTodayRows, planToday, unplanToday, setEstimate, type PlanRow } from "@/lib/tasks/today";
import { setStatus } from "@/lib/tasks/actions";

/* The always-on "Today" plan: the tasks you've committed to today, each with a
   time estimate, plus a capacity bar that warns when you've overcommitted.
   This is the heart of the daily ritual (Alfred plans it with you in a later
   phase). Per-user; "today" follows your device timezone. */

const TARGET_MIN = 6 * 60; // a realistic focused workday

function localDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtH(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

export default function TodayPlan({ tasks, userId }: { tasks: Task[]; userId: string | null }) {
  const [date] = useState(localDate);
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    getTodayRows(date).then(setRows);
  }, [date]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const items = (rows ?? [])
    .map((r) => ({ row: r, task: taskById.get(r.task_id) }))
    .filter((x): x is { row: PlanRow; task: Task } => !!x.task && !x.task.deleted_at);

  const isDone = (t: Task) => t.status === "done" || doneIds.has(t.id);
  const open = items.filter((i) => !isDone(i.task));
  const plannedMin = open.reduce((n, i) => n + i.row.estimate_min, 0);
  const over = plannedMin > TARGET_MIN;
  const fill = Math.min(plannedMin / TARGET_MIN, 1) * 100;

  const plannedIds = new Set(items.map((i) => i.task.id));
  const candidates = tasks.filter(
    (t) =>
      !t.deleted_at &&
      t.status !== "done" &&
      !plannedIds.has(t.id) &&
      (t.created_by === userId || t.assignees.includes(userId ?? "")),
  );

  async function add(taskId: string) {
    setRows((r) => [...(r ?? []), { task_id: taskId, estimate_min: 30, sort_order: r?.length ?? 0 }]);
    setPicking(false);
    await planToday(taskId, date, 30);
  }
  async function remove(taskId: string) {
    setRows((r) => (r ?? []).filter((x) => x.task_id !== taskId));
    await unplanToday(taskId, date);
  }
  async function bump(taskId: string, delta: number) {
    let next = 30;
    setRows((r) =>
      (r ?? []).map((x) => {
        if (x.task_id !== taskId) return x;
        next = Math.max(5, x.estimate_min + delta);
        return { ...x, estimate_min: next };
      }),
    );
    await setEstimate(taskId, date, next);
  }
  async function complete(taskId: string) {
    setDoneIds((s) => new Set(s).add(taskId));
    await setStatus(taskId, "done");
  }

  if (rows === null) {
    return <div className="sw-card px-6 py-5 text-sm text-muted">Loading today…</div>;
  }

  return (
    <div className="sw-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-6 py-4">
        <div>
          <h3 className="text-base font-medium">Today</h3>
          <p className="text-xs text-hint">
            {open.length} to do · {fmtH(plannedMin)} planned
            {items.length - open.length > 0 ? ` · ${items.length - open.length} done` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          className="shrink-0 rounded-full bg-peri-soft px-3 py-1.5 text-xs font-medium text-peri-deep transition-colors hover:brightness-95"
        >
          + Add to today
        </button>
      </div>

      {/* Capacity bar */}
      <div className="px-6 pt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
          <div
            className={`h-full rounded-full ${over ? "bg-red-500" : "bg-peri-deep"}`}
            style={{ width: `${fill}%` }}
          />
        </div>
        <p className={`mt-1.5 text-xs ${over ? "font-medium text-red-600" : "text-hint"}`}>
          {over
            ? `That's ${fmtH(plannedMin)} of work in a ~6h day. Something has to give — trim, shrink, or move one.`
            : `${fmtH(plannedMin)} of a ~6h day planned.`}
        </p>
      </div>

      {/* Picker */}
      {picking && (
        <div className="mx-6 mt-3 rounded-[var(--radius-control)] border border-hairline bg-bg/50 p-2">
          {candidates.length === 0 ? (
            <p className="px-2 py-2 text-sm text-hint">No other open tasks to add.</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto">
              {candidates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => add(t.id)}
                    className="w-full truncate rounded px-2 py-1.5 text-left text-sm text-ink transition-colors hover:bg-surface"
                  >
                    {t.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Plan list */}
      {items.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-muted">
          Plan your day — add a few tasks and estimate each. Keep it under ~6 hours.
        </p>
      ) : (
        <ul className="mt-3">
          {items.map(({ row, task }) => {
            const done = isDone(task);
            return (
              <li
                key={task.id}
                className="flex items-center gap-3 border-t border-hairline px-6 py-3 first:border-t-0"
              >
                <button
                  type="button"
                  onClick={() => !done && complete(task.id)}
                  aria-label={done ? "Done" : "Mark done"}
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
                    done ? "border-emerald-500 bg-emerald-500 text-white" : "border-hairline hover:border-peri-deep"
                  }`}
                >
                  {done && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>

                <span className={`min-w-0 flex-1 truncate text-sm ${done ? "text-hint line-through" : "text-ink"}`}>
                  {task.title}
                </span>

                {!done && (
                  <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                    <button type="button" onClick={() => bump(task.id, -15)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-bg" aria-label="Less time">−</button>
                    <span className="w-10 text-center tabular-nums">{fmtH(row.estimate_min)}</span>
                    <button type="button" onClick={() => bump(task.id, 15)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-bg" aria-label="More time">+</button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => remove(task.id)}
                  className="shrink-0 text-xs text-hint transition-colors hover:text-ink hover:underline"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
