"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Task, TaskPriority, TaskRole, TaskStatus } from "@/lib/tasks/types";
import { STATUS_COLUMNS } from "@/lib/tasks/types";
import {
  dueLabel,
  isDueThisWeek,
  isOverdue,
  PRIORITY_DOT,
} from "@/lib/tasks/format";
import { purgeTask, restoreTask, setStatus } from "@/lib/tasks/actions";
import QuickAdd from "@/components/tasks/QuickAdd";
import TaskDetail from "@/components/tasks/TaskDetail";
import Avatar, { AvatarStack } from "@/components/tasks/Avatar";

type Scope = "mine" | "all" | "overdue" | "week" | "trash";
type SortKey = "due" | "priority";
type View = "list" | "board";

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };

export default function TasksBoard({
  initialTasks,
  profiles,
  userId,
  userRole = "member",
  initialView = "list",
  initialScope = "all",
  initialOpenId = null,
}: {
  initialTasks: Task[];
  profiles: Profile[];
  userId: string | null;
  userRole?: TaskRole;
  initialView?: View;
  initialScope?: Scope;
  initialOpenId?: string | null;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [view, setView] = useState<View>(initialView);
  const [scope, setScope] = useState<Scope>(initialScope);
  const [tag, setTag] = useState<string>("all");
  const [assignee, setAssignee] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("due");
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [now, setNow] = useState(0);

  // When the URL changes (e.g. sidebar "Team board" / "My tasks", or a
  // notification deep-link), the server re-renders with new initial* props but
  // useState initialisers don't re-run. Sync view/scope/open during render the
  // moment those props change (React's recommended reset-on-prop-change).
  const [navKey, setNavKey] = useState(`${initialView}|${initialScope}`);
  const curKey = `${initialView}|${initialScope}`;
  if (navKey !== curKey) {
    setNavKey(curKey);
    setView(initialView);
    setScope(initialScope);
  }
  const [prevOpen, setPrevOpen] = useState(initialOpenId);
  if (initialOpenId !== prevOpen) {
    setPrevOpen(initialOpenId);
    setOpenId(initialOpenId);
  }

  // Keep local state in sync after a server refresh (realtime / mutations).
  useEffect(() => setTasks(initialTasks), [initialTasks]);

  // Device-tz clock, ticked each minute (also flips us past hydration).
  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(i);
  }, []);

  // Live updates: any change to tasks or assignees re-pulls the server view
  // (which respects RLS), so everyone sees adds/moves instantly.
  const refresh = useDebouncedRefresh(router);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("tasks-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignees" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const byId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const active = useMemo(() => tasks.filter((t) => !t.deleted_at), [tasks]);
  const trashed = useMemo(
    () =>
      tasks
        .filter((t) => t.deleted_at)
        .sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? "")),
    [tasks],
  );
  const allTags = useMemo(
    () => Array.from(new Set(active.flatMap((t) => t.tags))).sort(),
    [active],
  );

  const visible = useMemo(() => {
    let list = active;
    if (scope === "mine")
      list = list.filter((t) => t.created_by === userId || t.assignees.includes(userId ?? ""));
    else if (scope === "overdue")
      list = list.filter((t) => t.status !== "done" && isOverdue(t.due_at, now));
    else if (scope === "week")
      list = list.filter((t) => t.status !== "done" && isDueThisWeek(t.due_at, now));
    // Personal "to-dos" are your private lane — they live in "Mine" and Today,
    // never on the shared company board / All view.
    if (scope !== "mine") list = list.filter((t) => t.visibility !== "personal");
    if (tag !== "all") list = list.filter((t) => t.tags.includes(tag));
    if (assignee !== "all") list = list.filter((t) => t.assignees.includes(assignee));

    return [...list].sort((a, b) => {
      if (sort === "priority") {
        const d = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (d) return d;
      }
      // Due: soonest first, nulls last.
      const da = a.due_at ? Date.parse(a.due_at) : Infinity;
      const db = b.due_at ? Date.parse(b.due_at) : Infinity;
      if (da !== db) return da - db;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [active, scope, tag, assignee, sort, userId, now]);

  const openTask = openId ? tasks.find((t) => t.id === openId) ?? null : null;

  function move(taskId: string, status: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status, completed_at: status === "done" ? new Date().toISOString() : null }
          : t,
      ),
    );
    void setStatus(taskId, status);
  }

  function toggleDone(t: Task) {
    move(t.id, t.status === "done" ? "todo" : "done");
  }

  function restore(id: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, deleted_at: null } : t)));
    void restoreTask(id);
  }

  function purge(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    void purgeTask(id);
  }

  return (
    <div className="flex flex-col gap-5">
      <QuickAdd profiles={profiles} userRole={userRole} />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <SegFilter
          value={scope}
          onChange={(v) => setScope(v as Scope)}
          options={[
            { v: "mine", label: "Mine" },
            { v: "all", label: "All" },
            { v: "overdue", label: "Overdue" },
            { v: "week", label: "Due this week" },
          ]}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {allTags.length > 0 && (
            <Dropdown
              value={tag}
              onChange={setTag}
              options={[{ v: "all", label: "All tags" }, ...allTags.map((t) => ({ v: t, label: `#${t}` }))]}
            />
          )}
          <Dropdown
            value={assignee}
            onChange={setAssignee}
            options={[
              { v: "all", label: "Anyone" },
              ...profiles.map((p) => ({ v: p.id, label: (p.full_name || p.email || "Unknown").split(" ")[0] })),
            ]}
          />
          <Dropdown
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={[
              { v: "due", label: "Sort: Due date" },
              { v: "priority", label: "Sort: Priority" },
            ]}
          />
          <button
            type="button"
            onClick={() => setScope((s) => (s === "trash" ? "all" : "trash"))}
            className={[
              "flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-2 text-sm font-medium transition-colors",
              scope === "trash"
                ? "border-peri-deep bg-peri-soft text-peri-deep"
                : "border-hairline text-muted hover:bg-bg hover:text-ink",
            ].join(" ")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
            </svg>
            Trash{trashed.length > 0 ? ` (${trashed.length})` : ""}
          </button>
          <div className="flex rounded-[var(--radius-control)] border border-hairline p-0.5">
            {(["list", "board"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={[
                  "rounded-[8px] px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  view === v ? "bg-peri-soft text-peri-deep" : "text-muted hover:text-ink",
                ].join(" ")}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      {scope === "trash" ? (
        trashed.length === 0 ? (
          <EmptyState scope={scope} />
        ) : (
          <div className="sw-card divide-y divide-hairline overflow-hidden">
            <p className="bg-bg/60 px-5 py-2.5 text-xs text-hint">
              Deleted tasks. Restore them, or (if you created it) delete permanently.
            </p>
            {trashed.map((t) => (
              <TrashRow
                key={t.id}
                task={t}
                byId={byId}
                isCreator={t.created_by === userId}
                onRestore={() => restore(t.id)}
                onPurge={() => purge(t.id)}
              />
            ))}
          </div>
        )
      ) : visible.length === 0 ? (
        <EmptyState scope={scope} />
      ) : view === "list" ? (
        <div className="sw-card divide-y divide-hairline overflow-hidden">
          {visible.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              byId={byId}
              now={now}
              onOpen={() => setOpenId(t.id)}
              onToggleDone={() => toggleDone(t)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STATUS_COLUMNS.map((col) => {
            const items = visible.filter((t) => t.status === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(col.key);
                }}
                onDragLeave={() => setDragOver((d) => (d === col.key ? null : d))}
                onDrop={() => {
                  if (draggingId) move(draggingId, col.key);
                  setDraggingId(null);
                  setDragOver(null);
                }}
                className={[
                  "flex flex-col gap-3 rounded-[var(--radius-card)] border p-3 transition-colors",
                  dragOver === col.key
                    ? "border-peri-deep bg-peri-soft/50"
                    : "border-hairline bg-bg/60",
                ].join(" ")}
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-medium text-ink">{col.label}</span>
                  <span className="text-xs text-hint">{items.length}</span>
                </div>
                {items.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    byId={byId}
                    now={now}
                    onOpen={() => setOpenId(t.id)}
                    onDragStart={() => setDraggingId(t.id)}
                    onDragEnd={() => setDraggingId(null)}
                  />
                ))}
                {items.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-hint">Nothing here</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {openTask && (
        <TaskDetail
          task={openTask}
          profiles={profiles}
          userId={userId}
          userRole={userRole}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

/* ── Rows / cards ───────────────────────────────────────────────────────── */

function DoneToggle({ done, onClick }: { done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={done ? "Mark not done" : "Mark done"}
      className={[
        "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
        done ? "border-live bg-live text-white" : "border-hairline bg-surface hover:border-peri-deep",
      ].join(" ")}
    >
      {done && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </button>
  );
}

function DueChip({ due, now }: { due: string | null; now: number }) {
  if (!due || !now) return null;
  const d = dueLabel(due, now);
  if (!d) return null;
  return (
    <span
      className={[
        "inline-flex items-center gap-1 text-xs",
        d.overdue ? "font-medium text-red-600" : d.soon ? "text-peri-deep" : "text-muted",
      ].join(" ")}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18M8 3v3M16 3v3" />
      </svg>
      {d.text}
    </span>
  );
}

function Badges({ task }: { task: Task }) {
  return (
    <>
      {task.visibility === "personal" && (
        <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-medium leading-none text-hint">
          To-do
        </span>
      )}
      {task.visibility === "founders" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-peri-deep px-2 py-0.5 text-[11px] font-medium leading-none text-white">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7l4 5 5-7 5 7 4-5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          Founders
        </span>
      )}
      {task.tags.map((t) => (
        <span
          key={t}
          className="rounded-full bg-peri-soft px-2 py-0.5 text-[11px] font-medium leading-none text-peri-deep"
        >
          #{t}
        </span>
      ))}
    </>
  );
}

function TrashRow({
  task,
  byId,
  isCreator,
  onRestore,
  onPurge,
}: {
  task: Task;
  byId: Map<string, Profile>;
  isCreator: boolean;
  onRestore: () => void;
  onPurge: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="min-w-0 flex-1 truncate text-sm text-muted line-through">{task.title}</span>
      <AvatarStack ids={task.assignees} byId={byId} />
      <button
        type="button"
        onClick={onRestore}
        className="rounded-[var(--radius-control)] border border-hairline px-3 py-1.5 text-xs font-medium text-peri-deep hover:bg-peri-soft"
      >
        Restore
      </button>
      {isCreator && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Permanently delete "${task.title}"? This can't be undone.`)) onPurge();
          }}
          className="rounded-[var(--radius-control)] px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
        >
          Delete permanently
        </button>
      )}
    </div>
  );
}

function TaskRow({
  task,
  byId,
  now,
  onOpen,
  onToggleDone,
}: {
  task: Task;
  byId: Map<string, Profile>;
  now: number;
  onOpen: () => void;
  onToggleDone: () => void;
}) {
  const done = task.status === "done";
  return (
    <div
      onClick={onOpen}
      className="flex cursor-pointer items-center gap-3 px-5 py-3.5 transition-colors hover:bg-bg/60"
    >
      <DoneToggle done={done} onClick={onToggleDone} />
      <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} title={`${task.priority} priority`} />
      <span className={["min-w-0 flex-1 truncate text-sm", done ? "text-hint line-through" : "text-ink"].join(" ")}>
        {task.title}
      </span>
      <div className="hidden items-center gap-2 sm:flex">
        <Badges task={task} />
      </div>
      <DueChip due={task.due_at} now={now} />
      <AvatarStack ids={task.assignees} byId={byId} />
    </div>
  );
}

function TaskCard({
  task,
  byId,
  now,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  byId: Map<string, Profile>;
  now: number;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const done = task.status === "done";
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className="flex cursor-pointer flex-col gap-2.5 rounded-[var(--radius-control)] border border-hairline bg-surface px-3.5 py-3 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
        <span className={["flex-1 text-sm", done ? "text-hint line-through" : "text-ink"].join(" ")}>
          {task.title}
        </span>
      </div>
      {(task.tags.length > 0 || task.visibility !== "team") && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badges task={task} />
        </div>
      )}
      <div className="flex items-center justify-between">
        <DueChip due={task.due_at} now={now} />
        <AvatarStack ids={task.assignees} byId={byId} />
      </div>
    </div>
  );
}

/* ── Small controls ─────────────────────────────────────────────────────── */

function SegFilter({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap rounded-[var(--radius-control)] border border-hairline p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={[
            "rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors",
            value === o.v ? "bg-peri-soft text-peri-deep" : "text-muted hover:text-ink",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Dropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-muted focus:outline-none focus:ring-1 focus:ring-peri"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function EmptyState({ scope }: { scope: Scope }) {
  const msg =
    scope === "overdue"
      ? "Nothing overdue. "
      : scope === "week"
        ? "Nothing due this week. "
        : scope === "mine"
          ? "No tasks assigned to you. "
          : scope === "trash"
            ? "Trash is empty. "
            : "No tasks yet. ";
  return (
    <div className="sw-card flex flex-col items-center gap-2 px-6 py-16 text-center">
      <p className="text-sm font-medium text-ink">{msg}</p>
      <p className="text-sm text-muted">
        {scope === "trash"
          ? "Deleted tasks appear here and can be restored."
          : "Add one above — it appears for the whole team instantly."}
      </p>
    </div>
  );
}

/* Debounce realtime bursts into a single server refresh. */
function useDebouncedRefresh(router: ReturnType<typeof useRouter>) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 250);
  }, [router]);
}
