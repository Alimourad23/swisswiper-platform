"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmailThread, InboxView } from "@/lib/google/gmail";
import { PriorityPill, SafePill } from "@/components/Pill";

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

      {/* Inbox load — one-line summary */}
      <div className="sw-card px-6 py-5">
        <span className="text-sm text-muted">Inbox load</span>
        <p className="mt-2 text-sm text-ink">
          <strong className="font-medium">{view.unread}</strong> unread{" · "}
          <strong className="font-medium text-peri-deep">{view.needAttention}</strong> need attention
          {" · "}
          <strong className="font-medium">{view.safeToDelete}</strong> safe to delete{" · "}
          <strong className="font-medium">{view.week}</strong> received this week
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
          <span className="text-xs text-hint">Most recent {view.threads.length}</span>
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
  return (
    <li className="flex items-start justify-between gap-4 border-t border-hairline px-6 py-3 first:border-t-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {t.unread && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-peri-deep" aria-label="unread" />
          )}
          <span className="truncate text-sm font-medium text-ink">{t.senderName}</span>
          <Badge t={t} />
        </div>
        <p className="truncate text-sm text-muted">{t.subject}</p>
        {t.snippet && <p className="truncate text-sm text-hint">{t.snippet}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-hint" title={fullTime(t.dateISO)}>
          {relativeTime(t.dateISO, now)}
        </span>
        <a
          href={t.gmailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-peri-deep hover:underline"
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
