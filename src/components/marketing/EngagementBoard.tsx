"use client";

import { useState } from "react";
import type { EngageComment, EngageThread } from "@/lib/marketing/engagement-data";
import { sendCommentReply, sendDmReply } from "@/lib/marketing/engagement-actions";

/* The engagement inbox UI: comments + DMs with Alfred-drafted replies that a
   human reviews, edits, and explicitly sends. Nothing is ever sent
   automatically. */

type DraftState = {
  itemId: string;
  reply: string;
  voice: "ali" | "etienne";
  category: string;
  sending: boolean;
  error: string | null;
  drafting?: boolean;
};

const voiceLabel = (v: string) => (v === "etienne" ? "Etienne — product voice" : "Ali — founder voice");

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

const inputCls =
  "w-full resize-y rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none";

export default function EngagementBoard({
  comments,
  threads,
  commentsError,
  dmError,
}: {
  comments: EngageComment[];
  threads: EngageThread[];
  commentsError: string | null;
  dmError: string | null;
}) {
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});

  const patchDraft = (id: string, p: Partial<DraftState>) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] as DraftState), ...p } }));

  async function draftFor(item: {
    id: string;
    kind: "comment" | "dm";
    author: string;
    text: string;
    postCaption?: string;
    history?: string;
  }) {
    setDrafts((d) => ({
      ...d,
      [item.id]: { itemId: item.id, reply: "", voice: "ali", category: "", sending: false, error: null, drafting: true },
    }));
    try {
      const res = await fetch("/api/marketing/engage-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: item.kind,
          author: item.author,
          text: item.text,
          postCaption: item.postCaption,
          history: item.history,
        }),
      });
      const data = (await res.json()) as { reply?: string; voice?: "ali" | "etienne"; category?: string; error?: string };
      if (!res.ok || !data.reply) throw new Error(data.error || "Drafting failed.");
      patchDraft(item.id, { reply: data.reply, voice: data.voice ?? "ali", category: data.category ?? "", drafting: false });
    } catch (e) {
      patchDraft(item.id, { drafting: false, error: e instanceof Error ? e.message : "Drafting failed." });
    }
  }

  async function send(item: { id: string; kind: "comment" | "dm"; recipientId?: string }) {
    const d = drafts[item.id];
    if (!d || !d.reply.trim()) return;
    patchDraft(item.id, { sending: true, error: null });
    const r =
      item.kind === "comment"
        ? await sendCommentReply(item.id, d.reply)
        : await sendDmReply(item.recipientId as string, d.reply);
    if (r.ok) {
      setDone((x) => ({ ...x, [item.id]: true }));
      setDrafts((x) => {
        const n = { ...x };
        delete n[item.id];
        return n;
      });
    } else {
      patchDraft(item.id, { sending: false, error: r.error ?? "Couldn't send." });
    }
  }

  const openComments = comments.filter((c) => !c.replied && !done[c.id]);
  const answeredComments = comments.filter((c) => c.replied || done[c.id]);

  return (
    <div className="flex flex-col gap-6">
      {/* Comments */}
      <div className="sw-card">
        <div className="border-b border-hairline px-6 py-4">
          <h3 className="text-base font-medium">Comments</h3>
          <p className="text-xs text-hint">
            {openComments.length ? `${openComments.length} awaiting a reply` : "All caught up"} · founders reply
            personally, Alfred drafts
          </p>
        </div>
        {commentsError ? (
          <p className="px-6 py-6 text-sm text-red-600">{commentsError}</p>
        ) : comments.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted">
            No comments on recent posts yet — new ones appear here, ready for a reply.
          </p>
        ) : (
          <ul>
            {[...openComments, ...answeredComments].map((c) => {
              const d = drafts[c.id];
              const isDone = c.replied || done[c.id];
              return (
                <li key={c.id} className="flex flex-col gap-2 border-t border-hairline px-6 py-4 first:border-t-0">
                  <div className="flex items-start gap-3">
                    {c.post.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.post.thumb} alt="" className="h-10 w-10 shrink-0 rounded-[var(--radius-control)] border border-hairline object-cover" />
                    ) : (
                      <span className="h-10 w-10 shrink-0 rounded-[var(--radius-control)] bg-bg" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        <span className="font-medium">@{c.username}</span>{" "}
                        <span className="text-hint">· {timeAgo(c.timestamp)}</span>
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{c.text}</p>
                    </div>
                    {isDone ? (
                      <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        Replied
                      </span>
                    ) : d ? null : (
                      <button
                        type="button"
                        onClick={() =>
                          void draftFor({ id: c.id, kind: "comment", author: c.username, text: c.text, postCaption: c.post.caption })
                        }
                        className="shrink-0 rounded-full bg-peri-soft px-3 py-1.5 text-xs font-medium text-peri-deep transition-colors hover:brightness-95"
                      >
                        Draft with Alfred
                      </button>
                    )}
                  </div>

                  {d && !isDone && (
                    <div className="ml-13 flex flex-col gap-2 pl-0 sm:ml-[3.25rem]">
                      {d.drafting ? (
                        <p className="text-xs text-peri-deep">Alfred is drafting…</p>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-[11px] text-hint">
                            <span className="rounded-full bg-bg px-2 py-0.5 font-medium text-muted">{voiceLabel(d.voice)}</span>
                            {d.category && <span>· {d.category.replace(/_/g, " ")}</span>}
                          </div>
                          <textarea
                            value={d.reply}
                            onChange={(e) => patchDraft(c.id, { reply: e.target.value })}
                            rows={2}
                            className={inputCls}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void send({ id: c.id, kind: "comment" })}
                              disabled={d.sending || !d.reply.trim()}
                              className="rounded-full bg-peri-deep px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
                            >
                              {d.sending ? "Sending…" : "Send reply"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void draftFor({ id: c.id, kind: "comment", author: c.username, text: c.text, postCaption: c.post.caption })
                              }
                              className="rounded-full bg-bg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
                            >
                              Redraft
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDrafts((x) => {
                                  const n = { ...x };
                                  delete n[c.id];
                                  return n;
                                })
                              }
                              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
                            >
                              Cancel
                            </button>
                          </div>
                          {d.error && <p className="text-xs text-red-600">{d.error}</p>}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Direct messages */}
      <div className="sw-card">
        <div className="border-b border-hairline px-6 py-4">
          <h3 className="text-base font-medium">Direct messages</h3>
          <p className="text-xs text-hint">
            Replies allowed within 24h of the customer&apos;s last message (Instagram&apos;s rule)
          </p>
        </div>
        {dmError ? (
          <p className="px-6 py-6 text-sm text-red-600">{dmError}</p>
        ) : threads.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted">
            No conversations yet — DMs to @swisswiper will appear here.
          </p>
        ) : (
          <ul>
            {threads.map((t) => {
              const d = drafts[t.id];
              const isDone = done[t.id];
              const history = t.messages
                .map((m) => `${m.fromMe ? "Us" : "@" + t.username}: ${m.text}`)
                .join("\n");
              const lastInbound = [...t.messages].reverse().find((m) => !m.fromMe);
              return (
                <li key={t.id} className="flex flex-col gap-2 border-t border-hairline px-6 py-4 first:border-t-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        @{t.username} <span className="font-normal text-hint">· {timeAgo(t.updatedTime)}</span>
                      </p>
                      <div className="mt-1 flex flex-col gap-1">
                        {t.messages.slice(-4).map((m) => (
                          <p key={m.id} className={`text-sm ${m.fromMe ? "text-peri-deep" : "text-muted"}`}>
                            {m.fromMe ? "You: " : ""}
                            {m.text || <span className="text-hint">(attachment)</span>}
                          </p>
                        ))}
                      </div>
                    </div>
                    {t.answered || isDone ? (
                      <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        Replied
                      </span>
                    ) : !t.canReply ? (
                      <span className="shrink-0 rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-hint" title="Instagram's 24-hour reply window has passed">
                        Window closed
                      </span>
                    ) : d ? null : (
                      <button
                        type="button"
                        onClick={() =>
                          void draftFor({
                            id: t.id,
                            kind: "dm",
                            author: t.username,
                            text: lastInbound?.text ?? "",
                            history,
                          })
                        }
                        className="shrink-0 rounded-full bg-peri-soft px-3 py-1.5 text-xs font-medium text-peri-deep transition-colors hover:brightness-95"
                      >
                        Draft with Alfred
                      </button>
                    )}
                  </div>

                  {d && !isDone && (
                    <div className="flex flex-col gap-2">
                      {d.drafting ? (
                        <p className="text-xs text-peri-deep">Alfred is drafting…</p>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-[11px] text-hint">
                            <span className="rounded-full bg-bg px-2 py-0.5 font-medium text-muted">{voiceLabel(d.voice)}</span>
                            {d.category && <span>· {d.category.replace(/_/g, " ")}</span>}
                          </div>
                          <textarea
                            value={d.reply}
                            onChange={(e) => patchDraft(t.id, { reply: e.target.value })}
                            rows={2}
                            className={inputCls}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void send({ id: t.id, kind: "dm", recipientId: t.participantId })}
                              disabled={d.sending || !d.reply.trim()}
                              className="rounded-full bg-peri-deep px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
                            >
                              {d.sending ? "Sending…" : "Send message"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void draftFor({ id: t.id, kind: "dm", author: t.username, text: lastInbound?.text ?? "", history })
                              }
                              className="rounded-full bg-bg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
                            >
                              Redraft
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDrafts((x) => {
                                  const n = { ...x };
                                  delete n[t.id];
                                  return n;
                                })
                              }
                              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
                            >
                              Cancel
                            </button>
                          </div>
                          {d.error && <p className="text-xs text-red-600">{d.error}</p>}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
