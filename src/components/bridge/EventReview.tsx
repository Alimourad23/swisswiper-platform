"use client";

/* Editable calendar-event FIELDS, rendered inside an ActionPanel (which supplies
   the card shell + Create/Reschedule · Revise · Cancel options). */

export type EventDraftState = {
  mode: "create" | "reschedule";
  title: string;
  start: string; // datetime-local "YYYY-MM-DDTHH:mm"
  end: string;
  attendees: string; // comma-separated emails
  description: string;
  eventId?: string; // set for reschedule
};

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
