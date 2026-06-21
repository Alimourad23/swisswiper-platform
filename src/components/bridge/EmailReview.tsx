"use client";

/* Editable email FIELDS, rendered inside an ActionPanel (which supplies the
   card shell + Send / Redraft / Save draft / Cancel options). */

export type EmailDraftState = {
  to: string;
  subject: string;
  body: string;
  messageId?: string; // set for replies (threading handled server-side)
  fromName?: string; // sender display (for spoken phrasing)
};

const inputCls =
  "w-full rounded-[var(--radius-control)] border border-[#8e9ae0]/25 bg-white/[0.04] px-3 py-2 text-sm text-[#eef1f8] placeholder:text-[#8e9ae0]/40 focus:border-[#8e9ae0]/60 focus:outline-none";

export default function EmailReview({
  draft,
  onChange,
}: {
  draft: EmailDraftState;
  onChange: (patch: Partial<EmailDraftState>) => void;
}) {
  return (
    <>
      <Field label="To">
        <input value={draft.to} onChange={(e) => onChange({ to: e.target.value })} placeholder="name@email.com" className={inputCls} />
      </Field>
      <Field label="Subject">
        <input value={draft.subject} onChange={(e) => onChange({ subject: e.target.value })} placeholder="(no subject)" className={inputCls} />
      </Field>
      <Field label="Message">
        <textarea
          value={draft.body}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={5}
          className={`${inputCls} resize-none leading-relaxed`}
        />
      </Field>
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
