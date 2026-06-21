"use client";

/* Editable calendar-event review on the Bridge/overlay. CREATE makes a new
   event; RESCHEDULE moves an existing one (title shown, times editable). Confirm
   by button or voice "yes". (Cancellation uses the simple confirm card.) */

export type EventDraftState = {
  mode: "create" | "reschedule";
  title: string;
  start: string; // datetime-local "YYYY-MM-DDTHH:mm"
  end: string;
  attendees: string; // comma-separated emails
  description: string;
  eventId?: string; // set for reschedule
};

export default function EventReview({
  draft,
  busy,
  onChange,
  onConfirm,
  onCancel,
}: {
  draft: EventDraftState;
  busy: boolean;
  onChange: (patch: Partial<EventDraftState>) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const resched = draft.mode === "reschedule";
  const input =
    "w-full rounded-[var(--radius-control)] border border-[#8e9ae0]/25 bg-white/[0.04] px-3 py-2 text-sm text-[#eef1f8] placeholder:text-[#8e9ae0]/40 focus:border-[#8e9ae0]/60 focus:outline-none";

  return (
    <div className="mb-5 flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-card)] border border-[#8e9ae0]/25 bg-white/[0.04] px-5 py-5 text-left">
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#8e9ae0]/70">
        {resched ? "Reschedule — review" : "New event — review"}
      </p>

      <Field label="Title">
        {resched ? (
          <p className="text-sm font-light text-[#eef1f8]">{draft.title}</p>
        ) : (
          <input value={draft.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Event title" className={input} />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Start">
          <input
            type="datetime-local"
            value={draft.start}
            onChange={(e) => onChange({ start: e.target.value })}
            style={{ colorScheme: "dark" }}
            className={input}
          />
        </Field>
        <Field label="End">
          <input
            type="datetime-local"
            value={draft.end}
            onChange={(e) => onChange({ end: e.target.value })}
            style={{ colorScheme: "dark" }}
            className={input}
          />
        </Field>
      </div>

      {!resched && (
        <>
          <Field label="Attendees">
            <input
              value={draft.attendees}
              onChange={(e) => onChange({ attendees: e.target.value })}
              placeholder="comma-separated emails"
              className={input}
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={draft.description}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={2}
              className={`${input} resize-none leading-relaxed`}
            />
          </Field>
        </>
      )}

      <div className="mt-1 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || !draft.title.trim() || !draft.start || !draft.end}
          className="rounded-full bg-[#cad1e8] px-5 py-2 text-sm font-medium text-[#06070f] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Working…" : resched ? "Reschedule" : "Create event"}
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
        or say “yes” to confirm
      </p>
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
