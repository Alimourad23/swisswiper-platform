"use client";

import { useEffect, useRef, useState } from "react";
import { channels } from "@/lib/marketing/channels";
import { CONTENT_STATUSES, type ContentPost, type ContentStatus } from "@/lib/marketing/schedule";

/* The content studio: a full-screen workspace for ONE post. Left = the scorecard
   (title, channel, status, date, the post body, a live character read). Right = a
   co-writing conversation with Alfred, who gives honest channel-aware feedback and
   rewrites the body on request. Media (images/video) lands here next. */

function channelName(key: string): string {
  return channels.find((c) => c.key === key)?.name ?? key;
}

// Soft per-channel character guidance (where the platform has a practical cap).
const CHAR_LIMIT: Record<string, number> = {
  linkedin: 3000,
  instagram: 2200,
  tiktok: 2200,
  youtube: 5000,
  website: 0,
};

type Msg = { role: "user" | "assistant"; content: string };

export default function ContentStudio({
  post,
  onClose,
  onTitle,
  onSaveTitle,
  onChan,
  onStatus,
  onSched,
  onBodyChange,
  onBodySave,
}: {
  post: ContentPost;
  onClose: () => void;
  onTitle: (id: string, t: string) => void;
  onSaveTitle: (id: string, t: string) => void;
  onChan: (id: string, c: string) => void;
  onStatus: (id: string, s: ContentStatus) => void;
  onSched: (id: string, d: string) => void;
  onBodyChange: (id: string, b: string) => void;
  onBodySave: (id: string, b: string) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: `Share your thoughts or a rough draft and I'll shape it for ${channelName(
        post.channel,
      )}. Want me to take a first pass?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Close on Escape; lock background scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setThinking(true);
    try {
      const res = await fetch("/api/marketing/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          draft: post.body,
          channel: post.channel,
          title: post.title,
        }),
      });
      const data = (await res.json()) as { reply?: string; draft?: string | null; error?: string };
      if (data.reply) setMessages((m) => [...m, { role: "assistant", content: data.reply as string }]);
      else if (data.error) setMessages((m) => [...m, { role: "assistant", content: data.error as string }]);
      if (data.draft && data.draft !== post.body) {
        onBodyChange(post.id, data.draft);
        onBodySave(post.id, data.draft);
        if (post.status === "idea") onStatus(post.id, "draft");
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "I couldn't reach the studio just now — try again." }]);
    }
    setThinking(false);
  }

  const limit = CHAR_LIMIT[post.channel] ?? 0;
  const len = post.body.length;
  const over = limit > 0 && len > limit;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-sm font-medium text-peri-deep">Content studio</span>
          <span className="truncate text-sm text-muted">{post.title || "Untitled post"}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full bg-bg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
        >
          Close ✕
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Scorecard */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-b border-hairline lg:border-b-0 lg:border-r">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 py-6">
            <input
              value={post.title}
              onChange={(e) => onTitle(post.id, e.target.value)}
              onBlur={(e) => onSaveTitle(post.id, e.target.value)}
              placeholder="Post title or topic…"
              className="w-full bg-transparent text-xl font-medium text-ink placeholder:text-hint focus:outline-none"
            />

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={post.channel}
                onChange={(e) => onChan(post.id, e.target.value)}
                className="rounded-full bg-bg px-3 py-1.5 text-xs font-medium text-muted focus:outline-none"
              >
                {channels.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={post.status}
                onChange={(e) => onStatus(post.id, e.target.value as ContentStatus)}
                className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs text-muted focus:outline-none"
              >
                {CONTENT_STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={post.scheduled_for ?? ""}
                onChange={(e) => onSched(post.id, e.target.value)}
                className="rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-1.5 text-xs text-muted focus:outline-none"
              />
            </div>

            <textarea
              value={post.body}
              onChange={(e) => onBodyChange(post.id, e.target.value)}
              onBlur={(e) => onBodySave(post.id, e.target.value)}
              rows={14}
              placeholder="Write the post here — or tell Alfred your thoughts on the right and he'll draft it."
              className="w-full flex-1 resize-y rounded-[var(--radius-control)] border border-hairline bg-bg px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none"
            />
            <div className="flex items-center justify-between text-xs">
              <span className={over ? "text-red-600" : "text-hint"}>
                {len.toLocaleString()} characters{limit ? ` · ${channelName(post.channel)} limit ${limit.toLocaleString()}` : ""}
              </span>
              <span className="text-hint">Saved automatically</span>
            </div>

            {/* Media — next phase */}
            <div className="rounded-[var(--radius-control)] border border-dashed border-hairline px-4 py-4 text-center">
              <p className="text-xs text-hint">Images &amp; video — coming next. You&apos;ll upload media here and Alfred can generate it for you.</p>
            </div>
          </div>
        </div>

        {/* Alfred — co-writing conversation */}
        <div className="flex min-h-0 w-full flex-col lg:w-[26rem]">
          <div className="border-b border-hairline px-5 py-3">
            <p className="text-sm font-medium text-ink">Write with Alfred</p>
            <p className="text-xs text-hint">Honest feedback, tuned to {channelName(post.channel)}</p>
          </div>

          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "max-w-[85%] self-end rounded-2xl rounded-br-sm bg-peri-soft px-3.5 py-2 text-sm text-peri-deep"
                    : "max-w-[90%] self-start whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-bg px-3.5 py-2 text-sm text-ink"
                }
              >
                {m.content}
              </div>
            ))}
            {thinking && (
              <div className="max-w-[90%] self-start rounded-2xl rounded-bl-sm bg-bg px-3.5 py-2 text-sm text-hint">
                Alfred is thinking…
              </div>
            )}
          </div>

          <div className="border-t border-hairline px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                placeholder="Your thoughts, a rough draft, or 'make it shorter'…"
                className="min-h-0 flex-1 resize-none rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={thinking || !input.trim()}
                className="shrink-0 rounded-[var(--radius-control)] bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
