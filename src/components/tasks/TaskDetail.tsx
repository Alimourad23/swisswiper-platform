"use client";

import { useEffect, useState, useTransition } from "react";
import type { Profile, Task, TaskPriority, TaskStatus, TaskVisibility } from "@/lib/tasks/types";
import { STATUS_COLUMNS, PRIORITY_LABEL } from "@/lib/tasks/types";
import {
  addAssignee,
  deleteTask,
  removeAssignee,
  setStatus,
  updateTask,
} from "@/lib/tasks/actions";
import { isoToDateInput, dateInputToIso, displayName } from "@/lib/tasks/format";
import Avatar from "@/components/tasks/Avatar";
import AssigneeSelect from "@/components/tasks/AssigneeSelect";

/* Slide-over panel to view & edit a single task. Field edits are saved with
   the "Save changes" button; status and assignees apply immediately because
   they trigger notifications. */
export default function TaskDetail({
  task,
  profiles,
  userId,
  onClose,
}: {
  task: Task;
  profiles: Profile[];
  userId: string | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [visibility, setVisibility] = useState<TaskVisibility>(task.visibility);
  const [due, setDue] = useState(isoToDateInput(task.due_at));
  const [tags, setTags] = useState(task.tags.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Re-sync when the underlying task changes (e.g. realtime update arrives).
  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes);
    setPriority(task.priority);
    setVisibility(task.visibility);
    setDue(isoToDateInput(task.due_at));
    setTags(task.tags.join(", "));
  }, [task]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isCreator = userId === task.created_by;
  const byId = new Map(profiles.map((p) => [p.id, p]));

  function save() {
    setError(null);
    start(async () => {
      const res = await updateTask(
        task.id,
        {
          title,
          notes,
          priority,
          visibility,
          dueAt: dateInputToIso(due),
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
        profiles,
      );
      if (!res.ok) setError(res.error);
      else onClose();
    });
  }

  function changeStatus(s: TaskStatus) {
    start(async () => {
      await setStatus(task.id, s);
    });
  }

  function toggleAssignee(id: string) {
    start(async () => {
      if (task.assignees.includes(id)) await removeAssignee(task.id, id);
      else await addAssignee(task.id, id, title || task.title);
    });
  }

  function remove() {
    start(async () => {
      const res = await deleteTask(task.id);
      if (res.ok) onClose();
      else setError(res.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
      />

      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-hairline bg-surface shadow-[var(--shadow-card-hover)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="flex gap-1.5">
            {STATUS_COLUMNS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => changeStatus(s.key)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  task.status === s.key
                    ? "bg-peri-soft text-peri-deep"
                    : "text-muted hover:bg-bg",
                ].join(" ")}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-control)] p-1.5 text-muted hover:bg-bg hover:text-ink"
            aria-label="Close panel"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 px-6 py-5">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-[var(--radius-control)] bg-bg px-3 py-2.5 text-base font-medium text-ink focus:outline-none focus:ring-1 focus:ring-peri"
            />
          </Field>

          <Field label="Notes  ·  @mention a teammate to notify them">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add detail, or @mention a teammate…"
              className="w-full resize-y rounded-[var(--radius-control)] bg-bg px-3 py-2.5 text-sm text-ink placeholder:text-hint focus:outline-none focus:ring-1 focus:ring-peri"
            />
          </Field>

          <Field label="Assignees">
            <div className="flex flex-wrap items-center gap-2">
              {task.assignees.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-bg py-1 pl-1 pr-2 text-xs text-ink"
                >
                  <Avatar profile={byId.get(id)} />
                  {displayName(byId.get(id)?.full_name ?? null, byId.get(id)?.email ?? null).split(" ")[0]}
                  <button
                    type="button"
                    onClick={() => toggleAssignee(id)}
                    className="text-hint hover:text-red-600"
                    aria-label="Remove assignee"
                  >
                    ×
                  </button>
                </span>
              ))}
              <AssigneeSelect
                profiles={profiles}
                selected={task.assignees}
                onToggle={toggleAssignee}
                compact
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-peri"
              >
                {(["high", "normal", "low"] as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due date">
              <input
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="w-full rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-muted focus:outline-none focus:ring-1 focus:ring-peri"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Visibility">
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as TaskVisibility)}
                className="w-full rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-peri"
              >
                <option value="team">Team</option>
                <option value="personal">Personal</option>
              </select>
            </Field>
            <Field label="Tags  ·  comma separated">
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="design, urgent"
                className="w-full rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-hint focus:outline-none focus:ring-1 focus:ring-peri"
              />
            </Field>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-hairline bg-surface px-6 py-4">
          {isCreator ? (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-control)] border border-hairline px-4 py-2 text-sm font-medium text-muted hover:bg-bg hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-[var(--radius-control)] bg-peri-deep px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-hint">{label}</span>
      {children}
    </label>
  );
}
