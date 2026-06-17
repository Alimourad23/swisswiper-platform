"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Task } from "@/lib/tasks/types";
import { isDueToday, isOverdue } from "@/lib/tasks/format";

/* Overview panel body: my open tasks, due today, overdue. Counts are computed
   on the CLIENT so "today"/"overdue" follow the viewer's timezone. Honest
   empty state when there's nothing assigned. */
export default function TasksPulse({ tasks, userId }: { tasks: Task[]; userId: string | null }) {
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);

  const mine = tasks.filter(
    (t) =>
      !t.deleted_at &&
      t.status !== "done" &&
      (t.created_by === userId || t.assignees.includes(userId ?? "")),
  );
  const dueToday = mine.filter((t) => isDueToday(t.due_at, now)).length;
  const overdue = mine.filter((t) => isOverdue(t.due_at, now)).length;

  return (
    <div className="py-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Open" value={mine.length} />
        <Stat label="Due today" value={now ? dueToday : 0} />
        <Stat label="Overdue" value={now ? overdue : 0} accent={overdue > 0} />
      </div>
      <Link
        href="/dashboard/tasks?view=mine"
        className="mt-5 inline-block text-sm font-medium text-peri-deep hover:underline"
      >
        View Tasks →
      </Link>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-[var(--radius-control)] bg-bg px-4 py-3">
      <span className="text-xs text-muted">{label}</span>
      <p className={["mt-1 text-2xl font-medium tracking-tight", accent ? "text-red-600" : "text-ink"].join(" ")}>
        {value}
      </p>
    </div>
  );
}
