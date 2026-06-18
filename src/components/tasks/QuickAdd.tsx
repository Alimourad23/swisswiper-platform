"use client";

import { useState, useTransition } from "react";
import type { Profile, TaskRole, TaskVisibility } from "@/lib/tasks/types";
import { createTask } from "@/lib/tasks/actions";
import { dateInputToIso } from "@/lib/tasks/format";
import AssigneeSelect from "@/components/tasks/AssigneeSelect";
import CategoryPicker from "@/components/tasks/CategoryPicker";
import VisibilitySelect from "@/components/tasks/VisibilitySelect";

/* The quick-add bar: title + assignee + optional due date. Enter creates the
   task with sensible defaults (team / todo / normal). Founders also get the
   "Founders" visibility option. */
export default function QuickAdd({
  profiles,
  userRole = "member",
}: {
  profiles: Profile[];
  userRole?: TaskRole;
}) {
  const [title, setTitle] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<TaskVisibility>("team");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    const t = title.trim();
    if (!t) return;
    setError(null);
    start(async () => {
      const res = await createTask({
        title: t,
        assigneeIds: assignees,
        tags,
        visibility,
        dueAt: dateInputToIso(due),
      });
      if (res.ok) {
        setTitle("");
        setAssignees([]);
        setTags([]);
        setVisibility("team");
        setDue("");
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="sw-card px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Add a task and press Enter…"
          className="min-w-0 flex-1 rounded-[var(--radius-control)] bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-hint focus:outline-none focus:ring-1 focus:ring-peri"
        />
        <div className="flex items-center gap-2">
          <AssigneeSelect
            profiles={profiles}
            selected={assignees}
            onToggle={(id) =>
              setAssignees((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
              )
            }
            compact
          />
          <CategoryPicker value={tags} onChange={setTags} variant="popover" />
          <VisibilitySelect value={visibility} onChange={setVisibility} userRole={userRole} />
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Due date"
            className="rounded-[var(--radius-control)] border border-hairline bg-surface px-2.5 py-2 text-sm text-muted focus:outline-none focus:ring-1 focus:ring-peri"
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending || !title.trim()}
            className="rounded-[var(--radius-control)] bg-peri-deep px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
