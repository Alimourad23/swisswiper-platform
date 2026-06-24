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

const inputCls =
  "rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none";

export default function ContentSchedule({ initialPosts }: { initialPosts: ContentPost[] }) {
  const [posts, setPosts] = useState<ContentPost[]>(initialPosts);
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("linkedin");
  const [date, setDate] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);

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

  const shown = filter === "all" ? posts : posts.filter((p) => p.channel === filter);
  const scheduled = shown
    .filter((p) => p.scheduled_for)
    .sort((a, b) => (a.scheduled_for as string).localeCompare(b.scheduled_for as string));
  const backlog = shown.filter((p) => !p.scheduled_for);

  return (
    <div className="sw-card">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-6 py-4">
        <h3 className="text-base font-medium">Content schedule</h3>
        <span className="text-xs text-hint">{posts.length} planned</span>
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
          {scheduled.length > 0 && (
            <Section label="Scheduled">
              {scheduled.map((p) => (
                <Row
                  key={p.id}
                  post={p}
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
  onStatus,
  onSched,
  onChan,
  onTitle,
  onSaveTitle,
  onRemove,
}: {
  post: ContentPost;
  onStatus: (id: string, s: ContentStatus) => void;
  onSched: (id: string, d: string) => void;
  onChan: (id: string, c: string) => void;
  onTitle: (id: string, t: string) => void;
  onSaveTitle: (id: string, t: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 border-t border-hairline px-6 py-3 first:border-t-0">
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[post.status]}`}>
        {CONTENT_STATUSES.find((s) => s.key === post.status)?.label}
      </span>
      <input
        value={post.title}
        onChange={(e) => onTitle(post.id, e.target.value)}
        onBlur={(e) => onSaveTitle(post.id, e.target.value)}
        className="min-w-[10rem] flex-1 bg-transparent text-sm text-ink focus:outline-none"
      />
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
    </li>
  );
}
