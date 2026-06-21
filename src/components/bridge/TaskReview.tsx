"use client";

import type { TaskPriority, TaskVisibility } from "@/lib/tasks/types";

/* Editable, prefilled task review shown on the Bridge when Alfred proposes a
   task. Every field is editable before creating. Dark, on-brand, compact — the
   only on-screen element while a creation is pending. Confirm by button or by
   voice ("yes"). */

export type TaskDraft = {
  title: string;
  assigneeIds: string[];
  due: string; // YYYY-MM-DD (date input)
  priority: TaskPriority;
  visibility: TaskVisibility;
};

type Person = { id: string; name: string; first: string };

const PRIORITIES: TaskPriority[] = ["low", "normal", "high"];

export default function TaskReview({
  draft,
  profiles,
  canFounders,
  busy,
  onChange,
  onConfirm,
  onCancel,
}: {
  draft: TaskDraft;
  profiles: Person[];
  canFounders: boolean;
  busy: boolean;
  onChange: (patch: Partial<TaskDraft>) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const visibilities: TaskVisibility[] = canFounders
    ? ["team", "personal", "founders"]
    : ["team", "personal"];

  function toggleAssignee(id: string) {
    onChange({
      assigneeIds: draft.assigneeIds.includes(id)
        ? draft.assigneeIds.filter((x) => x !== id)
        : [...draft.assigneeIds, id],
    });
  }

  return (
    <div className="mb-5 flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-card)] border border-[#8e9ae0]/25 bg-white/[0.04] px-5 py-5 text-left">
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#8e9ae0]/70">
        New task — review
      </p>

      <Field label="Title">
        <input
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Task title"
          className="w-full rounded-[var(--radius-control)] border border-[#8e9ae0]/25 bg-white/[0.04] px-3 py-2 text-sm text-[#eef1f8] placeholder:text-[#8e9ae0]/40 focus:border-[#8e9ae0]/60 focus:outline-none"
        />
      </Field>

      <Field label="Assignees">
        {profiles.length === 0 ? (
          <p className="text-xs font-light text-[#8e9ae0]/60">No teammates available.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {profiles.map((p) => {
              const on = draft.assigneeIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleAssignee(p.id)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-light transition-colors",
                    on
                      ? "border-[#cad1e8]/70 bg-[#cad1e8]/15 text-white"
                      : "border-[#8e9ae0]/25 text-[#cad1e8]/80 hover:border-[#8e9ae0]/50 hover:text-white",
                  ].join(" ")}
                >
                  {p.first}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Due">
          <input
            type="date"
            value={draft.due}
            onChange={(e) => onChange({ due: e.target.value })}
            style={{ colorScheme: "dark" }}
            className="w-full rounded-[var(--radius-control)] border border-[#8e9ae0]/25 bg-white/[0.04] px-3 py-2 text-sm text-[#eef1f8] focus:border-[#8e9ae0]/60 focus:outline-none"
          />
        </Field>
        <Field label="Priority">
          <Segmented
            value={draft.priority}
            options={PRIORITIES.map((p) => ({ value: p, label: cap(p) }))}
            onChange={(v) => onChange({ priority: v as TaskPriority })}
          />
        </Field>
      </div>

      <Field label="Visibility">
        <Segmented
          value={draft.visibility}
          options={visibilities.map((v) => ({ value: v, label: cap(v) }))}
          onChange={(v) => onChange({ visibility: v as TaskVisibility })}
        />
      </Field>

      <div className="mt-1 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || !draft.title.trim()}
          className="rounded-full bg-[#cad1e8] px-5 py-2 text-sm font-medium text-[#06070f] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full border border-[#8e9ae0]/30 px-5 py-2 text-sm font-light text-[#cad1e8] transition-colors hover:bg-white/[0.05] disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
      <p className="text-center text-[11px] font-light tracking-wide text-[#8e9ae0]/60">
        or say “yes” to create
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[#8e9ae0]/60">
        {label}
      </span>
      {children}
    </label>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-[var(--radius-control)] border border-[#8e9ae0]/25 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={[
            "flex-1 rounded-[8px] px-2 py-1.5 text-xs font-light transition-colors",
            value === o.value ? "bg-[#cad1e8]/15 text-white" : "text-[#cad1e8]/70 hover:text-white",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
