"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmailThread, InboxView } from "@/lib/google/gmail";
import { PriorityPill, SafePill } from "@/components/Pill";
import { getEmailBody } from "@/lib/google/gmail-actions";

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

/* Strip quoted reply history so the showcase + read-aloud is just the new
   message, not the whole forwarded chain. */
function cleanForReading(body: string): string {
  let b = body.replace(/\r\n/g, "\n");
  const cutPatterns = [
    /\nOn .+wrote:/,
    /\n_{5,}/,
    /\n-{2,}\s*Original Message\s*-{2,}/i,
    /\nFrom:\s.+\nSent:\s/i,
    /\n\s*>/,
  ];
  for (const p of cutPatterns) {
    const idx = b.search(p);
    if (idx > 60) b = b.slice(0, idx);
  }
  b = b
    .split("\n")
    .filter((l) => !/^\s*>/.test(l))
    .join("\n");
  return b.replace(/\n{3,}/g, "\n\n").trim();
}

export default function EmailsBoard({ view }: { view: InboxView }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const tz = useMemo(() => deviceTimeZone(), []);
  const awaiting = view.threads.filter((t) => t.awaitingReply);

  if (now === null) {
    return (
      <div className="sw-card px-6 py-10 text-center text-sm text-muted">Loading your inbox…</div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-hint">Times shown in {tz}</p>

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

      {/* Needs your reply */}
      <div className="sw-card">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <h3 className="text-base font-medium">Needs your reply</h3>
          <span className="text-xs text-hint">{awaiting.length}</span>
        </div>
        {awaiting.length > 0 ? (
          <ul>
            {awaiting.map((t) => (
              <EmailRow key={t.id} t={t} now={now} />
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

      {/* Triaged inbox */}
      <div className="sw-card">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <h3 className="text-base font-medium">Triaged inbox</h3>
          <span className="text-xs text-hint">Most recent {view.threads.length} conversations</span>
        </div>
        {view.threads.length > 0 ? (
          <ul>
            {view.threads.map((t) => (
              <EmailRow key={t.id} t={t} now={now} />
            ))}
          </ul>
        ) : (
          <p className="px-6 py-10 text-center text-sm text-muted">Your inbox is empty.</p>
        )}
        <p className="border-t border-hairline px-6 py-3 text-xs text-hint">
          “Safe to delete” is only a suggestion based on Gmail’s categories and sender signals.
          Nothing is ever deleted or modified.
        </p>
      </div>
    </div>
  );
}

function EmailRow({ t, now }: { t: EmailThread; now: number }) {
  const [drafting, setDrafting] = useState(false);

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

  return (
    <li className="flex items-start justify-between gap-4 border-t border-hairline px-6 py-3 first:border-t-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {t.unread && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-peri-deep" aria-label="unread" />
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
          <Badge t={t} />
        </div>
        <p className="truncate text-sm text-muted">{t.subject}</p>
        {t.snippet && <p className="truncate text-sm text-hint">{t.snippet}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-hint" title={fullTime(t.dateISO)}>
          {relativeTime(t.dateISO, now)}
        </span>
        <button
          type="button"
          onClick={draftReply}
          disabled={drafting}
          className="text-xs font-medium text-peri-deep hover:underline disabled:opacity-50"
        >
          {drafting ? "Reading email…" : "Draft reply with Alfred"}
        </button>
        <a
          href={t.gmailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-hint hover:underline"
        >
          Open in Gmail ↗
        </a>
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
