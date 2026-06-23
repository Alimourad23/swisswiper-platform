"use client";

import { useEffect, useRef, useState } from "react";

/* Editable calendar-event FIELDS, rendered inside an ActionPanel (which supplies
   the card shell + Create/Reschedule · Revise · Cancel options). */

export type RecurrenceKey = "none" | "daily" | "weekly" | "weekdays" | "monthly";

export type EventDraftState = {
  mode: "create" | "reschedule";
  title: string;
  start: string; // datetime-local "YYYY-MM-DDTHH:mm"
  end: string;
  attendees: string; // comma-separated emails
  description: string;
  recurrence?: RecurrenceKey; // how often it repeats (create only)
  eventId?: string; // set for reschedule
};

export const RECURRENCE_OPTIONS: { key: RecurrenceKey; label: string }[] = [
  { key: "none", label: "Does not repeat" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "weekdays", label: "Every weekday (Mon–Fri)" },
  { key: "monthly", label: "Monthly" },
];

export function recurrenceLabel(key: RecurrenceKey | undefined): string {
  return RECURRENCE_OPTIONS.find((o) => o.key === (key ?? "none"))?.label ?? "Does not repeat";
}

/* Build the Google Calendar RRULE for a recurrence choice (indefinite series).
   "weekly"/"monthly" recur on the start's weekday/date, which Google infers. */
export function recurrenceRule(key: RecurrenceKey | undefined): string[] | undefined {
  switch (key) {
    case "daily":
      return ["RRULE:FREQ=DAILY"];
    case "weekly":
      return ["RRULE:FREQ=WEEKLY"];
    case "weekdays":
      return ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"];
    case "monthly":
      return ["RRULE:FREQ=MONTHLY"];
    default:
      return undefined;
  }
}

const inputCls =
  "w-full rounded-[var(--radius-control)] border border-[#8e9ae0]/25 bg-white/[0.04] px-3 py-2 text-sm text-[#eef1f8] placeholder:text-[#8e9ae0]/40 focus:border-[#8e9ae0]/60 focus:outline-none";

export default function EventReview({
  draft,
  onChange,
}: {
  draft: EventDraftState;
  onChange: (patch: Partial<EventDraftState>) => void;
}) {
  const resched = draft.mode === "reschedule";
  return (
    <>
      <Field label="Title">
        {resched ? (
          <p className="text-sm font-light text-[#eef1f8]">{draft.title}</p>
        ) : (
          <input value={draft.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Event title" className={inputCls} />
        )}
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Start">
          <input type="datetime-local" value={draft.start} onChange={(e) => onChange({ start: e.target.value })} style={{ colorScheme: "dark" }} className={inputCls} />
        </Field>
        <Field label="End">
          <input type="datetime-local" value={draft.end} onChange={(e) => onChange({ end: e.target.value })} style={{ colorScheme: "dark" }} className={inputCls} />
        </Field>
      </div>

      {!resched && (
        <>
          <Field label="Repeat">
            <RepeatSelect
              value={draft.recurrence ?? "none"}
              onChange={(v) => onChange({ recurrence: v })}
            />
          </Field>
          <Field label="Attendees">
            <input value={draft.attendees} onChange={(e) => onChange({ attendees: e.target.value })} placeholder="comma-separated emails" className={inputCls} />
          </Field>
          <Field label="Notes">
            <textarea value={draft.description} onChange={(e) => onChange({ description: e.target.value })} rows={2} className={`${inputCls} resize-none leading-relaxed`} />
          </Field>
        </>
      )}
    </>
  );
}

/* On-brand dropdown for the deep-space panel — native <select> popups render
   white/unthemed, so we draw our own. */
function RepeatSelect({
  value,
  onChange,
}: {
  value: RecurrenceKey;
  onChange: (v: RecurrenceKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = RECURRENCE_OPTIONS.find((o) => o.key === value) ?? RECURRENCE_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between text-left`}
      >
        <span>{current.label}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-[#8e9ae0]/70 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-[var(--radius-control)] border border-[#8e9ae0]/25 bg-[#0a0c18] py-1 shadow-[0_18px_50px_rgba(2,3,12,0.6)]">
          {RECURRENCE_OPTIONS.map((o) => {
            const selected = o.key === value;
            return (
              <li key={o.key}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                    selected ? "bg-[#8e9ae0]/15 text-[#eef1f8]" : "text-[#cdd3ea]/85 hover:bg-white/[0.05]"
                  }`}
                >
                  {o.label}
                  {selected && (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[#8e9ae0]/60">{label}</span>
      {children}
    </label>
  );
}
