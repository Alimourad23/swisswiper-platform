"use client";

import type { TaskRole, TaskVisibility } from "@/lib/tasks/types";

/* Visibility picker shared by QuickAdd and TaskDetail.
   - Team:     everyone on the team can see it.
   - Personal: just the creator + assignees.
   - Founders: founders only (option shown only to founders; the DB enforces it).

   The "Founders" option appears when the current user is a founder, or when
   the task already has founders visibility (so the value never silently
   disappears in the editor). */
export default function VisibilitySelect({
  value,
  onChange,
  userRole = "member",
  className = "",
}: {
  value: TaskVisibility;
  onChange: (v: TaskVisibility) => void;
  userRole?: TaskRole;
  className?: string;
}) {
  const showFounders = userRole === "founder" || value === "founders";
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as TaskVisibility)}
      aria-label="Visibility"
      className={`rounded-[var(--radius-control)] border border-hairline bg-surface px-2.5 py-2 text-sm text-muted focus:outline-none focus:ring-1 focus:ring-peri ${className}`}
    >
      <option value="team">Team task</option>
      <option value="personal">My to-do</option>
      {showFounders && <option value="founders">Founders</option>}
    </select>
  );
}
