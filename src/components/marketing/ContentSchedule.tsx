"use client";

import { useState } from "react";
import { channels } from "@/lib/marketing/channels";
import { createPost, updatePost, deletePost } from "@/lib/marketing/schedule-actions";
import { CONTENT_STATUSES, type ContentPost, type ContentStatus } from "@/lib/marketing/schedule";

const STATUS_STYLE: Record<ContentStatus, string> = {
  idea: "bg-line text-hint",
  draft: "bg-amber-500/15 text-amber-700",
  scheduled: "bg-peri-soft text-peri-deep",
  published: "bg-emerald-500/15 text-emerald-700",
};

function channelName(key: string): string {
  return channels.find((c) => c.key === key)?.name ?? key;
}
function fmtDate(d: string): string {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

const CHANNEL_URL: Record<string, string> = {
  linkedin: "https://www.linkedin.com/feed/",
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/upload",
  youtube: "https://studio.youtube.com/",
  website: "",
};
function pad(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayStr(): string {
  return ymd(new Date());
}
function weekRange(): { start: string; end: string } {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  const mon = new Date(d);
  mon.setDate(d.getDate() - dow);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: ymd(mon), end: ymd(sun) };
}

const inputCls =
  "rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none";

export default function ContentSchedule({ initialPosts }: { initialPosts: ContentPost[] }) {
  const [posts, setPosts] = useState<ContentPost[]>(initialPosts);
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("linkedin");
  const [date, setDate] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function add() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    const r = await createPost({ title: t, channel, scheduledFor: date || null });
    if (r.ok && r.id) {
      setPosts((p) => [
        {
          id: r.id!,
          created_by: "",
          title: t,
          channel,
          status: date ? "scheduled" : "idea",
          scheduled_for: date || null,
          format: "",
          body: "",
          notes: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...p,
      ]);
      setTitle("");
      setDate("");
    }
    setBusy(false);
  }
  function patch(id: string, p: Partial<ContentPost>) {
    setPosts((all) => all.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  const setStatus = (id: string, status: ContentStatus) => {
    patch(id, { status });
    void updatePost(id, { status });
  };
  const setSched = (id: string, d: string) => {
    patch(id, { scheduled_for: d || null });
    void updatePost(id, { scheduledFor: d || null });
  };
  const setChan = (id: string, ch: string) => {
    patch(id, { channel: ch });
    void updatePost(id, { channel: ch });
  };
  const setTitleOf = (id: string, t: string) => patch(id, { title: t });
  const saveTitle = (id: string, t: string) => void updatePost(id, { title: t.trim() });
  const remove = (id: string) => {
    setPosts((p) => p.filter((x) => x.id !== id));
    void deletePost(id);
  };
  const toggleExpand = (id: string) => setExpandedId((c) => (c === id ? null : id));
  const bodyChange = (id: string, b: string) => patch(id, { body: b });
  const bodySave = (id: string, b: string) => void updatePost(id, { body: b });
  async function draftPost(post: ContentPost) {
    if (draftingId) return;
    setDraftingId(post.id);
    setExpandedId(post.id);
    try {
      const res = await fetch("/api/marketing/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: post.title, channel: post.channel }),
      });
      const data = (await res.json()) as { text?: string };
      if (data.text) {
        bodyChange(post.id, data.text);
        bodySave(post.id, data.text);
        if (post.status === "idea") setStatus(post.id, "draft");
      }
    } catch {
      /* draft is best-effort */
    }
    setDraftingId(null);
  }

  function copy(id: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  }

  const shown = filter === "all" ? posts : posts.filter((p) => p.channel === filter);
  const scheduled = shown
    .filter((p) => p.scheduled_for)
    .sort((a, b) => (a.scheduled_for as string).localeCompare(b.scheduled_for as string));
  const backlog = shown.filter((p) => !p.scheduled_for);

  // Publishing queue + weekly cadence.
  const today = todayStr();
  const wk = weekRange();
  const due = shown.filter((p) => p.scheduled_for && p.scheduled_for <= today && p.status !== "published");
  const weekPosts = posts.filter((p) => p.scheduled_for && p.scheduled_for >= wk.start && p.scheduled_for <= wk.end);
  const toPostWeek = weekPosts.filter((p) => p.status !== "published").length;
  const publishedWeek = weekPosts.filter((p) => p.status === "published").length;

  return (
    <div className="sw-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-6 py-4">
        <div>
          <h3 className="text-base font-medium">Content schedule</h3>
          <p className="text-xs text-hint">
            This week: {toPostWeek} to post · {publishedWeek} published
          </p>
        </div>
        <span className="shrink-0 text-xs text-hint">{posts.length} planned</span>
      </div>

      {/* Quick add */}
      <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Plan a post — topic or hook…"
          className={`${inputCls} min-w-[14rem] flex-1`}
        />
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
          {channels.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="rounded-[var(--radius-control)] bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/* Channel filter */}
      <div className="flex flex-wrap gap-1.5 px-6 pt-3">
        {[{ key: "all", name: "All" }, ...channels].map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              filter === c.key ? "bg-peri-soft text-peri-deep" : "text-muted hover:text-ink"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {posts.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-muted">
          Plan your first post above — set a date to schedule it, or leave it dated-later as an idea.
        </p>
      ) : (
        <>
          {due.length > 0 && (
            <div className="mt-4 border-t border-peri-soft/60 bg-peri-soft/20">
              <p className="px-6 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-peri-deep">Ready to post</p>
              <ul>
                {due.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 px-6 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.title}</span>
                    <span className="shrink-0 text-xs text-hint">
                      {channelName(p.channel)}
                      {p.scheduled_for ? ` · ${fmtDate(p.scheduled_for)}` : ""}
                    </span>
                    {p.body && (
                      <button type="button" onClick={() => copy(p.id, p.body)} className="shrink-0 text-xs font-medium text-peri-deep hover:underline">
                        {copiedId === p.id ? "Copied" : "Copy"}
                      </button>
                    )}
                    {CHANNEL_URL[p.channel] && (
                      <a href={CHANNEL_URL[p.channel]} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-medium text-peri-deep hover:underline">
                        Open {channelName(p.channel)} ↗
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setStatus(p.id, "published")}
                      className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:brightness-95"
                    >
                      Mark published
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {scheduled.length > 0 && (
            <Section label="Scheduled">
              {scheduled.map((p) => (
                <Row
                  key={p.id}
                  post={p}
                  expanded={expandedId === p.id}
                  drafting={draftingId === p.id}
                  onToggle={() => toggleExpand(p.id)}
                  onDraft={() => draftPost(p)}
                  onBodyChange={bodyChange}
                  onBodySave={bodySave}
                  onStatus={setStatus}
                  onSched={setSched}
                  onChan={setChan}
                  onTitle={setTitleOf}
                  onSaveTitle={saveTitle}
                  onRemove={remove}
                />
              ))}
            </Section>
          )}
          {backlog.length > 0 && (
            <Section label="Backlog — ideas & drafts">
              {backlog.map((p) => (
                <Row
                  key={p.id}
                  post={p}
                  expanded={expandedId === p.id}
                  drafting={draftingId === p.id}
                  onToggle={() => toggleExpand(p.id)}
                  onDraft={() => draftPost(p)}
                  onBodyChange={bodyChange}
                  onBodySave={bodySave}
                  onStatus={setStatus}
                  onSched={setSched}
                  onChan={setChan}
                  onTitle={setTitleOf}
                  onSaveTitle={saveTitle}
                  onRemove={remove}
                />
              ))}
            </Section>
          )}
        </>
      )}
      <div className="h-2" />
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="px-6 pb-1 text-xs font-medium uppercase tracking-wider text-hint">{label}</p>
      <ul>{children}</ul>
    </div>
  );
}

function Row({
  post,
  expanded,
  drafting,
  onToggle,
  onDraft,
  onBodyChange,
  onBodySave,
  onStatus,
  onSched,
  onChan,
  onTitle,
  onSaveTitle,
  onRemove,
}: {
  post: ContentPost;
  expanded: boolean;
  drafting: boolean;
  onToggle: () => void;
  onDraft: () => void;
  onBodyChange: (id: string, b: string) => void;
  onBodySave: (id: string, b: string) => void;
  onStatus: (id: string, s: ContentStatus) => void;
  onSched: (id: string, d: string) => void;
  onChan: (id: string, c: string) => void;
  onTitle: (id: string, t: string) => void;
  onSaveTitle: (id: string, t: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="flex flex-col border-t border-hairline px-6 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-hint hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={expanded ? "rotate-90" : ""}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[post.status]}`}>
          {CONTENT_STATUSES.find((s) => s.key === post.status)?.label}
        </span>
        <input
          value={post.title}
          onChange={(e) => onTitle(post.id, e.target.value)}
          onBlur={(e) => onSaveTitle(post.id, e.target.value)}
          className="min-w-[10rem] flex-1 bg-transparent text-sm text-ink focus:outline-none"
        />
        {post.body && !expanded && <span className="shrink-0 text-[11px] text-emerald-600">drafted</span>}
        <select
          value={post.channel}
          onChange={(e) => onChan(post.id, e.target.value)}
          className="shrink-0 rounded-full bg-bg px-2 py-1 text-xs text-muted focus:outline-none"
        >
          {channels.map((c) => (
            <option key={c.key} value={c.key}>
              {channelName(c.key)}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={post.scheduled_for ?? ""}
          onChange={(e) => onSched(post.id, e.target.value)}
          className="shrink-0 rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-xs text-muted focus:outline-none"
          title={post.scheduled_for ? fmtDate(post.scheduled_for) : "Set a date"}
        />
        <select
          value={post.status}
          onChange={(e) => onStatus(post.id, e.target.value as ContentStatus)}
          className="shrink-0 rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-xs text-muted focus:outline-none"
        >
          {CONTENT_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onRemove(post.id)}
          className="shrink-0 text-xs text-hint transition-colors hover:text-red-600 hover:underline"
        >
          Remove
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 pl-7">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-hint">Post copy</span>
            <button
              type="button"
              onClick={onDraft}
              disabled={drafting}
              className="rounded-full bg-peri-soft px-3 py-1 text-xs font-medium text-peri-deep transition-colors hover:brightness-95 disabled:opacity-50"
            >
              {drafting ? "Drafting…" : post.body ? "Redraft with Alfred" : "Draft with Alfred"}
            </button>
          </div>
          <textarea
            value={post.body}
            onChange={(e) => onBodyChange(post.id, e.target.value)}
            onBlur={(e) => onBodySave(post.id, e.target.value)}
            rows={post.body ? 8 : 3}
            placeholder="Write the post, or let Alfred draft it…"
            className="w-full resize-y rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none"
          />
        </div>
      )}
    </li>
  );
}
