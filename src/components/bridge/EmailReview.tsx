"use client";

/* Editable email review on the Bridge/overlay. DRAFT mode saves a Gmail draft;
   SEND mode (only when the user explicitly asked to send) sends it. Every field
   is editable; confirm by button or voice "yes". */

export type EmailDraftState = {
  mode: "draft" | "send";
  to: string;
  subject: string;
  body: string;
  messageId?: string; // set for replies (threading handled server-side)
};

export default function EmailReview({
  draft,
  busy,
  onChange,
  onConfirm,
  onCancel,
}: {
  draft: EmailDraftState;
  busy: boolean;
  onChange: (patch: Partial<EmailDraftState>) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const sending = draft.mode === "send";
  const input =
    "w-full rounded-[var(--radius-control)] border border-[#8e9ae0]/25 bg-white/[0.04] px-3 py-2 text-sm text-[#eef1f8] placeholder:text-[#8e9ae0]/40 focus:border-[#8e9ae0]/60 focus:outline-none";

  return (
    <div className="mb-5 flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-card)] border border-[#8e9ae0]/25 bg-white/[0.04] px-5 py-5 text-left">
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[#8e9ae0]/70">
        {sending ? "Send email — review" : "Email draft — review"}
      </p>

      <Field label="To">
        <input value={draft.to} onChange={(e) => onChange({ to: e.target.value })} placeholder="name@email.com" className={input} />
      </Field>
      <Field label="Subject">
        <input value={draft.subject} onChange={(e) => onChange({ subject: e.target.value })} placeholder="(no subject)" className={input} />
      </Field>
      <Field label="Message">
        <textarea
          value={draft.body}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={5}
          className={`${input} resize-none leading-relaxed`}
        />
      </Field>

      <div className="mt-1 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || !draft.to.trim()}
          className="rounded-full bg-[#cad1e8] px-5 py-2 text-sm font-medium text-[#06070f] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy ? (sending ? "Sending…" : "Saving…") : sending ? "Send" : "Save draft"}
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
        {sending ? "or say “yes” to send" : "or say “yes” to save the draft"}
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
