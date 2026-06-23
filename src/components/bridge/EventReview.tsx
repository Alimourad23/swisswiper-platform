"use client";

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
            <select
              value={draft.recurrence ?? "none"}
              onChange={(e) => onChange({ recurrence: e.target.value as RecurrenceKey })}
              style={{ colorScheme: "dark" }}
              className={inputCls}
            >
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[#8e9ae0]/60">{label}</span>
      {children}
    </label>
  );
}
