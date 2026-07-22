"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmailThread, InboxView } from "@/lib/google/gmail";
import { PriorityPill, SafePill } from "@/components/Pill";
import SectionHead from "@/components/SectionHead";
import { getDraft, getEmailBody, trashThread, untrashThread } from "@/lib/google/gmail-actions";
import type { EmailDraftState } from "@/components/bridge/EmailReview";

type RowState = { status: "draft" | "sent" | "cleared"; draft?: EmailDraftState };

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "your timezone";
  } catch {
    return "your timezone";
  }
}

/* Relative received time in the viewer's device timezone (native Date is local). */
function relativeTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const diff = now - t;
  if (diff < 0) return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;

  const d = new Date(iso);
  const n = new Date(now);
  if (d.toDateString() === n.toDateString()) return `${Math.floor(min / 60)}h ago`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  const sameYear = d.getFullYear() === n.getFullYear();
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function fullTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

/* Strip quoted reply history so the showcase + read-aloud is JUST the new
   message, not the whole forwarded chain. Cuts at the EARLIEST quoted-history
   marker found. */
function cleanForReading(body: string): string {
  let b = body.replace(/\r\n/g, "\n");
  const markers = [
    /\n\s*On .{0,120}wrote:/i, //         "On <date>, <name> wrote:"
    /\n\s*-{2,}\s*Original Message/i, //  "----- Original Message -----"
    /\n\s*From: .*\n\s*(Sent|Date): /i, // forwarded header block (Date or Sent)
    /\n\s*From: .*<[^>]+@[^>]+>/i, //      "From: Name <email>" quoted header
    /\n_{5,}/, //                         long underscore divider
  ];
  let cut = b.length;
  for (const m of markers) {
    const idx = b.search(m);
    if (idx > 40 && idx < cut) cut = idx;
  }
  b = b.slice(0, cut);
  // Drop any remaining quoted lines + inline image placeholders.
  b = b
    .split("\n")
    .filter((l) => !/^\s*>/.test(l))
    .join("\n")
    .replace(/\[[^\]\n]+\.(png|jpe?g|gif|svg)\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return b;
}

export default function EmailsBoard({ view }: { view: InboxView }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  // Rows Alfred has drafted a reply to / replied to this session, so the status,
  // dot and the saved draft (for re-opening) update immediately. Dispatched from
  // the draft / send / discard flow.
  const [drafted, setDrafted] = useState<Record<string, RowState>>({});
  useEffect(() => {
    function onDrafted(e: Event) {
      const d = (e as CustomEvent).detail as
        | { messageId?: string; status?: "draft" | "sent" | "cleared"; draft?: EmailDraftState }
        | undefined;
      if (!d?.messageId) return;
      const id = d.messageId;
      if (d.status === "cleared") {
        // Sentinel so a discarded draft also overrides a load-detected one.
        setDrafted((m) => ({ ...m, [id]: { status: "cleared" } }));
      } else if (d.status === "draft" || d.status === "sent") {
        const status = d.status;
        setDrafted((m) => ({ ...m, [id]: { status, draft: d.draft ?? m[id]?.draft } }));
      }
    }
    window.addEventListener("sw-email-drafted", onDrafted);
    return () => window.removeEventListener("sw-email-drafted", onDrafted);
  }, []);

  const tz = useMemo(() => deviceTimeZone(), []);
  const awaiting = view.threads.filter((t) => t.awaitingReply);

  if (now === null) {
    return (
      <div className="sw-card px-6 py-10 text-center text-sm text-muted">Loading your inbox…</div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-hint">Times shown in {tz}</p>

      <SectionHead n="01" title="At a glance" note="inbox load & triage" />
      {/* Inbox load — totals kept separate from recent-window triage so the
          numbers never look contradictory (totals span the whole inbox; triage
          covers only the most recent conversations). */}
      <div className="sw-card px-6 py-5">
        <span className="text-sm text-muted">Inbox load</span>
        <p className="mt-2 text-sm text-ink">
          <strong className="font-medium">{view.unread}</strong> unread{" · "}
          <strong className="font-medium">{view.week}</strong> received this week
        </p>
        <p className="mt-1 text-xs text-hint">
          In your {view.windowSize} most recent conversations:{" "}
          <strong className="font-medium text-peri-deep">{view.needAttention}</strong> need attention
          {" · "}
          <strong className="font-medium">{view.safeToDelete}</strong> safe to delete
        </p>
      </div>

      <SectionHead n="02" title="Action needed" note="unread mail addressed to you" />
      {/* Needs your reply */}
      <div className="sw-card">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <h3 className="text-base font-medium">Needs your reply</h3>
          <span className="text-xs text-hint">{awaiting.length}</span>
        </div>
        {awaiting.length > 0 ? (
          <ul>
            {awaiting.map((t) => (
              <EmailRow key={t.id} t={t} now={now} rowState={drafted[t.id]} />
            ))}
          </ul>
        ) : (
          <p className="px-6 py-8 text-center text-sm text-muted">
            You’re all caught up — nothing needs a reply right now.
          </p>
        )}
        <p className="border-t border-hairline px-6 py-3 text-xs text-hint">
          Best-effort — based on unread Primary mail addressed to you.
        </p>
      </div>

      <SectionHead n="03" title="Your inbox" note="most recent conversations" />
      {/* Triaged inbox */}
      <div className="sw-card">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <h3 className="text-base font-medium">Triaged inbox</h3>
          <span className="text-xs text-hint">Most recent {view.threads.length} conversations</span>
        </div>
        {view.threads.length > 0 ? (
          <ul>
            {view.threads.map((t) => (
              <EmailRow key={t.id} t={t} now={now} rowState={drafted[t.id]} />
            ))}
          </ul>
        ) : (
          <p className="px-6 py-10 text-center text-sm text-muted">Your inbox is empty.</p>
        )}
        <p className="border-t border-hairline px-6 py-3 text-xs text-hint">
          “Safe to delete” is a suggestion based on Gmail’s categories and sender signals.
          “Move to Trash” is recoverable — nothing is ever permanently deleted.
        </p>
      </div>
    </div>
  );
}

function EmailRow({ t, now, rowState }: { t: EmailThread; now: number; rowState?: RowState }) {
  const [drafting, setDrafting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  // Move the whole conversation to Gmail Trash (recoverable).
  async function deleteRow() {
    if (deleting) return;
    setDeleting(true);
    setDelErr(null);
    const r = await trashThread(t.threadId);
    setDeleting(false);
    setConfirmDel(false);
    if (r.ok) setDeleted(true);
    else setDelErr(r.error);
  }

  // Undo — restore the conversation from Trash back to the inbox.
  async function undoTrash() {
    if (undoing) return;
    setUndoing(true);
    const r = await untrashThread(t.threadId);
    setUndoing(false);
    if (r.ok) setDeleted(false);
  }
  // Status comes from this session's actions, else from an existing Gmail draft
  // detected on load (so it survives a refresh). A "cleared" sentinel (discarded
  // this session) overrides a load-detected draft.
  const sess = rowState?.status;
  const status: "draft" | "sent" | undefined =
    sess === "cleared" ? undefined : (sess ?? (t.draftId ? "draft" : undefined));
  const dotClass = status === "sent" ? "bg-emerald-500" : status === "draft" ? "bg-amber-500" : "bg-peri-deep";

  // Reopen the saved draft alongside the original email for review/send. Use the
  // in-session draft if we have it; otherwise fetch the saved Gmail draft.
  async function reviewDraft() {
    if (drafting) return;
    setDrafting(true);
    let preset = rowState?.draft;
    if (!preset && t.draftId) {
      try {
        const dr = await getDraft(t.draftId);
        if (dr.ok) {
          preset = {
            to: dr.to,
            cc: dr.cc,
            bcc: dr.bcc,
            subject: dr.subject,
            body: dr.body,
            messageId: t.id,
            fromName: t.senderName,
            draftId: t.draftId,
          };
        }
      } catch {
        /* fall through */
      }
    }
    if (!preset) {
      void draftReply();
      setDrafting(false);
      return;
    }
    let showcase: { from: string; subject: string; body: string } | undefined;
    try {
      const r = await getEmailBody(t.id);
      if (r.ok && r.body) {
        showcase = { from: t.senderName, subject: t.subject, body: cleanForReading(r.body) };
      }
    } catch {
      /* draft still opens without the showcase */
    }
    window.dispatchEvent(new CustomEvent("sw-alfred-summon", { detail: { showcase, presetEmail: preset } }));
    setDrafting(false);
  }

  // Read the real email body, then hand the whole thing to Alfred so he replies
  // in context (and in SwissWiper's voice) — not from the subject line alone.
  async function draftReply() {
    if (drafting) return;
    setDrafting(true);
    let seed = `Draft a reply to ${t.senderName} regarding "${t.subject}".`;
    let showcase: { from: string; subject: string; body: string } | undefined;
    try {
      const r = await getEmailBody(t.id);
      if (r.ok && r.body) {
        const clean = cleanForReading(r.body);
        seed =
          `Draft a reply to ${t.senderName} regarding "${t.subject}". ` +
          `Reply in context to their message below, in SwissWiper's voice.\n\n` +
          `--- Their email ---\n${clean}\n--- end ---`;
        showcase = { from: t.senderName, subject: t.subject, body: clean };
      }
    } catch {
      /* fall back to the subject-only seed */
    }
    window.dispatchEvent(new CustomEvent("sw-alfred-summon", { detail: { seed, showcase } }));
    setDrafting(false);
  }

  if (deleted) {
    return (
      <li className="flex items-center justify-between gap-4 border-t border-hairline px-6 py-3 text-sm text-hint first:border-t-0">
        <span className="truncate">
          <span className="line-through">
            {t.senderName} — {t.subject}
          </span>{" "}
          · Moved to Trash
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={undoTrash}
            disabled={undoing}
            className="rounded-full bg-peri-soft px-2.5 py-1 text-xs font-medium text-peri-deep transition-colors hover:brightness-95 disabled:opacity-50"
          >
            {undoing ? "Restoring…" : "Undo"}
          </button>
          <a
            href="https://mail.google.com/mail/u/0/#trash"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs hover:underline"
          >
            Trash ↗
          </a>
        </span>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-4 border-t border-hairline px-6 py-3 first:border-t-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {(t.unread || status) && (
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} aria-label={status ?? "unread"} />
          )}
          <span className="truncate text-sm font-medium text-ink">{t.senderName}</span>
          {t.msgCount > 1 && (
            <span
              title={`${t.msgCount} messages in this conversation`}
              className="shrink-0 rounded-full bg-bg px-1.5 text-[11px] font-medium leading-tight text-hint"
            >
              {t.msgCount}
            </span>
          )}
          {status ? <StatusBadge status={status} /> : <Badge t={t} />}
        </div>
        <a
          href={t.gmailUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in Gmail"
          className="block truncate text-sm text-muted transition-colors hover:text-ink hover:underline"
        >
          {t.subject}
        </a>
        {t.snippet && <p className="truncate text-sm text-hint">{t.snippet}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-hint" title={fullTime(t.dateISO)}>
          {relativeTime(t.dateISO, now)}
        </span>
        {status === "draft" ? (
          <button
            type="button"
            onClick={reviewDraft}
            disabled={drafting}
            className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/25 disabled:opacity-50"
          >
            {drafting ? "Opening…" : "Review draft / send"}
          </button>
        ) : (
          <button
            type="button"
            onClick={draftReply}
            disabled={drafting}
            className="rounded-full bg-peri-soft px-2.5 py-1 text-xs font-medium text-peri-deep transition-colors hover:brightness-95 disabled:opacity-50"
          >
            {drafting ? "Reading email…" : "Draft reply with Alfred"}
          </button>
        )}
        {t.tag === "safe" &&
          (confirmDel ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="text-hint">Move to Trash?</span>
              <button
                type="button"
                onClick={deleteRow}
                disabled={deleting}
                className="rounded-full bg-red-500/15 px-2.5 py-1 font-medium text-red-600 transition-colors hover:bg-red-500/25 disabled:opacity-50"
              >
                {deleting ? "…" : "Yes, Trash"}
              </button>
              <button type="button" onClick={() => setConfirmDel(false)} className="text-hint hover:underline">
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/20"
            >
              Move to Trash
            </button>
          ))}
        <a
          href={t.gmailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-hint hover:underline"
        >
          Open in Gmail ↗
        </a>
        {delErr && <span className="max-w-[14rem] text-right text-[11px] text-red-600">{delErr}</span>}
      </div>
    </li>
  );
}

function Badge({ t }: { t: EmailThread }) {
  if (t.awaitingReply) {
    return (
      <span
        title="Best-effort guess"
        className="inline-flex shrink-0 items-center rounded-full bg-peri-soft px-2 py-0.5 text-[11px] font-medium leading-none text-peri-deep"
      >
        Awaiting reply
      </span>
    );
  }
  if (t.tag === "priority") return <PriorityPill />;
  if (t.tag === "safe") return <SafePill />;
  return null;
}

function StatusBadge({ status }: { status: "draft" | "sent" }) {
  if (status === "sent") {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium leading-none text-emerald-700">
        Replied
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium leading-none text-amber-700">
      Draft ready · review or send
    </span>
  );
}
