"use client";

import { useEffect, useMemo, useState } from "react";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { getTodayRows, planToday, unplanToday, setEstimate, type PlanRow } from "@/lib/tasks/today";
import { createTask, setStatus } from "@/lib/tasks/actions";

/* The always-on "Today" plan. You can write your OWN to-dos straight in (they
   become personal tasks) or pull in existing team tasks. Each item has Complete
   / In progress / Remove, a time estimate, and feeds a capacity bar that warns
   when you've overcommitted. Per-user; "today" follows the device timezone. */

const TARGET_MIN = 6 * 60;

function localDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtH(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

type Lite = { id: string; title: string; status: TaskStatus };

export default function TodayPlan({ tasks, userId }: { tasks: Task[]; userId: string | null }) {
  const [date] = useState(localDate);
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [localStatus, setLocalStatus] = useState<Record<string, TaskStatus>>({});
  const [extra, setExtra] = useState<Record<string, Lite>>({}); // to-dos created here
  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () => getTodayRows(date).then((r) => live && setRows(r));
    load();
    window.addEventListener("sw-today-planned", load); // Alfred set the day
    return () => {
      live = false;
      window.removeEventListener("sw-today-planned", load);
    };
  }, [date]);

  // Merge team tasks with to-dos written right here.
  const liteById = useMemo(() => {
    const m = new Map<string, Lite>();
    for (const t of tasks) if (!t.deleted_at) m.set(t.id, { id: t.id, title: t.title, status: t.status });
    for (const e of Object.values(extra)) m.set(e.id, e);
    return m;
  }, [tasks, extra]);

  const statusOf = (id: string): TaskStatus => localStatus[id] ?? liteById.get(id)?.status ?? "todo";

  const items = (rows ?? [])
    .map((r) => ({ row: r, t: liteById.get(r.task_id) }))
    .filter((x): x is { row: PlanRow; t: Lite } => !!x.t);

  const open = items.filter((i) => statusOf(i.t.id) !== "done");
  const plannedMin = open.reduce((n, i) => n + i.row.estimate_min, 0);
  const doneCount = items.length - open.length;
  const over = plannedMin > TARGET_MIN;
  const fill = Math.min(plannedMin / TARGET_MIN, 1) * 100;

  const plannedIds = new Set(items.map((i) => i.t.id));
  const candidates = tasks.filter(
    (t) =>
      !t.deleted_at &&
      t.status !== "done" &&
      !plannedIds.has(t.id) &&
      (t.created_by === userId || t.assignees.includes(userId ?? "")),
  );

  // ── Actions ──
  async function addOwnTodo() {
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    setDraft("");
    const r = await createTask({ title, assigneeIds: userId ? [userId] : [], visibility: "personal" });
    if (r.ok && r.id) {
      setExtra((x) => ({ ...x, [r.id!]: { id: r.id!, title, status: "todo" } }));
      setRows((rs) => [...(rs ?? []), { task_id: r.id!, estimate_min: 30, sort_order: rs?.length ?? 0 }]);
      await planToday(r.id, date, 30);
    }
    setBusy(false);
  }
  async function addExisting(taskId: string) {
    setRows((rs) => [...(rs ?? []), { task_id: taskId, estimate_min: 30, sort_order: rs?.length ?? 0 }]);
    setPicking(false);
    await planToday(taskId, date, 30);
  }
  async function remove(taskId: string) {
    setRows((rs) => (rs ?? []).filter((x) => x.task_id !== taskId));
    await unplanToday(taskId, date);
  }
  async function bump(taskId: string, delta: number) {
    let next = 30;
    setRows((rs) =>
      (rs ?? []).map((x) => {
        if (x.task_id !== taskId) return x;
        next = Math.max(5, x.estimate_min + delta);
        return { ...x, estimate_min: next };
      }),
    );
    await setEstimate(taskId, date, next);
  }
  async function move(taskId: string, status: TaskStatus) {
    setLocalStatus((s) => ({ ...s, [taskId]: status }));
    await setStatus(taskId, status);
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
            {open.length} to do · {fmtH(plannedMin)} planned{doneCount > 0 ? ` · ${doneCount} done` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          className="shrink-0 text-xs font-medium text-peri-deep hover:underline"
        >
          Pull from tasks
        </button>
      </div>

      {/* Capacity bar */}
      <div className="px-6 pt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
          <div className={`h-full rounded-full ${over ? "bg-red-500" : "bg-peri-deep"}`} style={{ width: `${fill}%` }} />
        </div>
        <p className={`mt-1.5 text-xs ${over ? "font-medium text-red-600" : "text-hint"}`}>
          {over
            ? `That's ${fmtH(plannedMin)} in a ~6h day. Something has to give — trim, shrink, or move one.`
            : `${fmtH(plannedMin)} of a ~6h day planned.`}
        </p>
      </div>

      {/* Write your own to-do */}
      <div className="px-6 pt-4">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addOwnTodo()}
          placeholder="Write a to-do and press Enter…"
          className="w-full rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none"
        />
      </div>

      {/* Pull-from-tasks picker */}
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
                    onClick={() => addExisting(t.id)}
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

      {/* The plan */}
      {items.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-muted">
          Write your first to-do above, or pull one from your tasks. Keep the day under ~6 hours.
        </p>
      ) : (
        <ul className="mt-3">
          {items.map(({ row, t }) => {
            const st = statusOf(t.id);
            const done = st === "done";
            const inProg = st === "in_progress";
            return (
              <li key={t.id} className="flex items-center gap-3 border-t border-hairline px-6 py-3 first:border-t-0">
                {/* Complete */}
                <button
                  type="button"
                  onClick={() => move(t.id, done ? "todo" : "done")}
                  aria-label={done ? "Mark not done" : "Complete"}
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${
                    done ? "border-emerald-500 bg-emerald-500 text-white" : "border-hairline hover:border-emerald-500"
                  }`}
                >
                  {done && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>

                <span className={`min-w-0 flex-1 truncate text-sm ${done ? "text-hint line-through" : "text-ink"}`}>
                  {t.title}
                </span>

                {!done && (
                  <>
                    {/* In progress toggle */}
                    <button
                      type="button"
                      onClick={() => move(t.id, inProg ? "todo" : "in_progress")}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        inProg ? "bg-peri-soft text-peri-deep" : "text-hint hover:text-peri-deep"
                      }`}
                    >
                      {inProg ? "In progress" : "Start"}
                    </button>

                    {/* Estimate */}
                    <div className="flex shrink-0 items-center gap-1 text-xs text-muted">
                      <button type="button" onClick={() => bump(t.id, -15)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-bg" aria-label="Less time">−</button>
                      <span className="w-9 text-center tabular-nums">{fmtH(row.estimate_min)}</span>
                      <button type="button" onClick={() => bump(t.id, 15)} className="grid h-6 w-6 place-items-center rounded-full hover:bg-bg" aria-label="More time">+</button>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  className="shrink-0 text-xs text-hint transition-colors hover:text-red-600 hover:underline"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="h-2" />
    </div>
  );
}
