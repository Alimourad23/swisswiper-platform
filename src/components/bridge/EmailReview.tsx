"use client";

import { useEffect, useRef, useState } from "react";

/* Editable email FIELDS, rendered inside an ActionPanel (which supplies the
   card shell + Send / Redraft / Save draft / Cancel options). */

export type EmailDraftState = {
  to: string;
  cc?: string; // comma-separated emails
  bcc?: string; // comma-separated emails
  subject: string;
  body: string;
  messageId?: string; // set for replies (threading handled server-side)
  fromName?: string; // sender display (for spoken phrasing)
  draftId?: string; // the Gmail draft id, once saved (for re-save / discard)
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
  // Reveal Cc/Bcc only when wanted (kept hidden by default for a clean panel),
  // but auto-open if Alfred already filled them in.
  const [showCcBcc, setShowCcBcc] = useState(
    Boolean(draft.cc?.trim() || draft.bcc?.trim()),
  );

  return (
    <>
      <Field label="To">
        <input value={draft.to} onChange={(e) => onChange({ to: e.target.value })} placeholder="name@email.com" className={inputCls} />
      </Field>

      {!showCcBcc ? (
        <button
          type="button"
          onClick={() => setShowCcBcc(true)}
          className="self-start text-[11px] font-medium uppercase tracking-wider text-[#8e9ae0]/60 transition-colors hover:text-[#cad1e8]"
        >
          + Add Cc / Bcc
        </button>
      ) : (
        <>
          <Field label="Cc">
            <input value={draft.cc ?? ""} onChange={(e) => onChange({ cc: e.target.value })} placeholder="comma-separated emails" className={inputCls} />
          </Field>
          <Field label="Bcc">
            <input value={draft.bcc ?? ""} onChange={(e) => onChange({ bcc: e.target.value })} placeholder="comma-separated emails" className={inputCls} />
          </Field>
        </>
      )}

      <Field label="Subject">
        <input value={draft.subject} onChange={(e) => onChange({ subject: e.target.value })} placeholder="(no subject)" className={inputCls} />
      </Field>
      <Field label="Message">
        <SmartComposeTextarea
          value={draft.body}
          onChange={(body) => onChange({ body })}
          context={{ subject: draft.subject, to: draft.to, isReply: Boolean(draft.messageId) }}
        />
      </Field>
    </>
  );
}

/* A textarea with Gmail-style "Smart Compose": as you type, Alfred suggests a
   short continuation in grey. Press Tab (or →) to accept, Esc to dismiss.
   The grey suggestion is drawn by a mirror layer behind a transparent textarea
   so it appears right after the caret. */
function SmartComposeTextarea({
  value,
  onChange,
  context,
}: {
  value: string;
  onChange: (v: string) => void;
  context: { subject: string; to: string; isReply: boolean };
}) {
  const [suggestion, setSuggestion] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    setSuggestion("");
    if (timer.current) window.clearTimeout(timer.current);
    if (value.trim().length < 3) return;
    // Only suggest when the caret is at the very end of what's written.
    const el = ref.current;
    if (el && el.selectionStart !== value.length) return;
    const id = ++reqId.current;
    timer.current = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/alfred/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ written: value, ...context }),
        });
        const data = (await res.json()) as { suggestion?: string };
        if (id === reqId.current && typeof data.suggestion === "string") {
          setSuggestion(data.suggestion);
        }
      } catch {
        /* ignore — suggestions are best-effort */
      }
    }, 450);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value, context.subject, context.to, context.isReply]);

  function accept() {
    if (!suggestion) return;
    onChange(value + suggestion);
    setSuggestion("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!suggestion) return;
    const atEnd = e.currentTarget.selectionStart === value.length;
    if ((e.key === "Tab" || e.key === "ArrowRight") && atEnd) {
      e.preventDefault();
      accept();
    } else if (e.key === "Escape") {
      setSuggestion("");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative w-full rounded-[var(--radius-control)] border border-[#8e9ae0]/25 bg-white/[0.04] focus-within:border-[#8e9ae0]/60">
        <div
          aria-hidden
          className="pointer-events-none min-h-[8.5rem] whitespace-pre-wrap break-words px-3 py-2 text-sm leading-relaxed"
        >
          <span className="invisible">{value}</span>
          <span className="text-[#8e9ae0]/45">{suggestion}</span>
        </div>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="absolute inset-0 h-full w-full resize-none bg-transparent px-3 py-2 text-sm leading-relaxed text-[#eef1f8] placeholder:text-[#8e9ae0]/40 focus:outline-none"
        />
      </div>
      {suggestion && (
        <button
          type="button"
          onClick={accept}
          className="self-start text-[10px] font-medium uppercase tracking-wider text-[#8e9ae0]/55 transition-colors hover:text-[#cad1e8]"
        >
          Press Tab to accept Alfred’s suggestion
        </button>
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
