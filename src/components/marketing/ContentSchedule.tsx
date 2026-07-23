"use client";

import { useEffect, useState } from "react";
import { channels } from "@/lib/marketing/channels";
import { getMedia } from "@/lib/marketing/media-actions";
import type { ContentMedia } from "@/lib/marketing/media";
import { createPost, updatePost, deletePost, submitForApproval, approvePost, requestChanges } from "@/lib/marketing/schedule-actions";
import { syncPostCalendar, clearPostCalendar } from "@/lib/marketing/calendar-sync";
import { CONTENT_STATUSES, APPROVAL_LABELS, type ContentPost, type ContentStatus, type ApprovalStatus } from "@/lib/marketing/schedule";
import ContentStudio from "@/components/marketing/ContentStudio";
import MonthGrid from "@/components/marketing/MonthGrid";
import PublishNow from "@/components/marketing/PublishNow";

const STATUS_STYLE: Record<ContentStatus, string> = {
  idea: "bg-line text-hint",
  draft: "bg-amber-500/15 text-amber-700",
  scheduled: "bg-peri-soft text-peri-deep",
  published: "bg-emerald-500/15 text-emerald-700",
};

const APPROVAL_STYLE: Record<ApprovalStatus, string> = {
  none: "bg-line text-hint",
  pending: "bg-amber-500/15 text-amber-700",
  approved: "bg-emerald-500/15 text-emerald-700",
  changes: "bg-red-500/15 text-red-600",
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

export default function ContentSchedule({
  initialPosts,
  view,
  isFounder = false,
}: {
  initialPosts: ContentPost[];
  view: "calendar" | "list";
  isFounder?: boolean;
}) {
  const [posts, setPosts] = useState<ContentPost[]>(initialPosts);
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("linkedin");
  const [date, setDate] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [month, setMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const prevMonth = () => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const thisMonth = () => {
    const d = new Date();
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  };
  const moveToDate = (id: string, d: string) => {
    const post = posts.find((x) => x.id === id);
    const bump = post?.status === "idea";
    patch(id, { scheduled_for: d, ...(bump ? { status: "scheduled" as ContentStatus } : {}) });
    void updatePost(id, { scheduledFor: d, ...(bump ? { status: "scheduled" } : {}) });
    void syncCal(id, { scheduled_for: d });
  };

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
      if (date) void syncCal(r.id, { scheduled_for: date, title: t, channel, body: "" });
      setTitle("");
      setDate("");
    }
    setBusy(false);
  }
  function patch(id: string, p: Partial<ContentPost>) {
    setPosts((all) => all.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  const tzNow = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isDated = (id: string) => Boolean(posts.find((x) => x.id === id)?.scheduled_for);
  async function syncCal(id: string, overrides?: Partial<ContentPost>) {
    const cur = posts.find((x) => x.id === id);
    const p = { ...(cur ?? {}), ...(overrides ?? {}) } as ContentPost;
    const r = await syncPostCalendar({
      postId: id,
      scheduledFor: p.scheduled_for ?? null,
      title: p.title ?? "",
      channel: p.channel ?? "linkedin",
      body: p.body ?? "",
      timeZone: tzNow(),
      todayStr: todayStr(),
    });
    if (r.ok) patch(id, { gcal_event_ids: r.ids });
  }
  const setStatus = (id: string, status: ContentStatus) => {
    patch(id, { status });
    void updatePost(id, { status });
  };
  const setSched = (id: string, d: string) => {
    patch(id, { scheduled_for: d || null });
    void updatePost(id, { scheduledFor: d || null });
    void syncCal(id, { scheduled_for: d || null });
  };
  const setChan = (id: string, ch: string) => {
    patch(id, { channel: ch });
    void updatePost(id, { channel: ch });
    if (isDated(id)) void syncCal(id, { channel: ch });
  };
  const setTitleOf = (id: string, t: string) => patch(id, { title: t });
  const saveTitle = (id: string, t: string) => {
    void updatePost(id, { title: t.trim() });
    if (isDated(id)) void syncCal(id, { title: t.trim() });
  };
  const remove = (id: string) => {
    setPosts((p) => p.filter((x) => x.id !== id));
    void clearPostCalendar(id).then(() => deletePost(id));
  };
  // ── approval workflow ──
  async function submitApproval(id: string) {
    patch(id, { approval_status: "pending", review_note: null });
    const r = await submitForApproval(id);
    if (!r.ok) patch(id, { approval_status: "none" });
  }
  async function approve(id: string) {
    patch(id, { approval_status: "approved", review_note: null });
    const r = await approvePost(id);
    if (!r.ok) patch(id, { approval_status: "pending" });
  }
  async function reqChanges(id: string) {
    const note = window.prompt("What needs to change before this can go out? (optional)") ?? undefined;
    patch(id, { approval_status: "changes", review_note: note ?? null });
    const r = await requestChanges(id, note);
    if (!r.ok) patch(id, { approval_status: "pending" });
  }
  const toggleExpand = (id: string) => setExpandedId((c) => (c === id ? null : id));
  const bodyChange = (id: string, b: string) => patch(id, { body: b });
  const bodySave = (id: string, b: string) => {
    void updatePost(id, { body: b });
    if (isDated(id)) void syncCal(id, { body: b });
  };
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
          <h3 className="text-[14px] font-medium">Content schedule</h3>
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

          {view === "calendar" ? (
            <MonthGrid
              posts={shown}
              month={month}
              onPrev={prevMonth}
              onNext={nextMonth}
              onToday={thisMonth}
              onMove={moveToDate}
              onOpen={setStudioId}
              onDelete={remove}
            />
          ) : (
            <>
          {scheduled.length > 0 && (
            <Section label="Scheduled">
              {scheduled.map((p) => (
                <Row
                  key={p.id}
                  post={p}
                  expanded={expandedId === p.id}
                  onToggle={() => toggleExpand(p.id)}
                  onStudio={() => setStudioId(p.id)}
                  onStatus={setStatus}
                  onSched={setSched}
                  onChan={setChan}
                  onTitle={setTitleOf}
                  onSaveTitle={saveTitle}
                  onRemove={remove}
                  isFounder={isFounder}
                  onSubmit={submitApproval}
                  onApprove={approve}
                  onRequestChanges={reqChanges}
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
                  onToggle={() => toggleExpand(p.id)}
                  onStudio={() => setStudioId(p.id)}
                  onStatus={setStatus}
                  onSched={setSched}
                  onChan={setChan}
                  onTitle={setTitleOf}
                  onSaveTitle={saveTitle}
                  onRemove={remove}
                  isFounder={isFounder}
                  onSubmit={submitApproval}
                  onApprove={approve}
                  onRequestChanges={reqChanges}
                />
              ))}
            </Section>
          )}
            </>
          )}
        </>
      )}

      {studioId &&
        (() => {
          const p = posts.find((x) => x.id === studioId);
          if (!p) return null;
          return (
            <ContentStudio
              post={p}
              onClose={() => setStudioId(null)}
              onTitle={setTitleOf}
              onSaveTitle={saveTitle}
              onChan={setChan}
              onStatus={setStatus}
              onSched={setSched}
              onBodyChange={bodyChange}
              onBodySave={bodySave}
              onDelete={remove}
              isFounder={isFounder}
            />
          );
        })()}
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
  onToggle,
  onStudio,
  onStatus,
  onSched,
  onChan,
  onTitle,
  onSaveTitle,
  onRemove,
  isFounder = false,
  onSubmit,
  onApprove,
  onRequestChanges,
}: {
  post: ContentPost;
  expanded: boolean;
  onToggle: () => void;
  onStudio: () => void;
  onStatus: (id: string, s: ContentStatus) => void;
  onSched: (id: string, d: string) => void;
  onChan: (id: string, c: string) => void;
  onTitle: (id: string, t: string) => void;
  onSaveTitle: (id: string, t: string) => void;
  onRemove: (id: string) => void;
  isFounder?: boolean;
  onSubmit: (id: string) => void;
  onApprove: (id: string) => void;
  onRequestChanges: (id: string) => void;
}) {
  const approval = (post.approval_status ?? "none") as ApprovalStatus;
  const [previewMedia, setPreviewMedia] = useState<ContentMedia[]>([]);
  // Load the post's media (for the at-a-glance preview) only when the row opens.
  useEffect(() => {
    if (!expanded) return;
    let alive = true;
    void getMedia(post.id).then((m) => {
      if (alive) setPreviewMedia(m);
    });
    return () => {
      alive = false;
    };
  }, [expanded, post.id]);

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
        {post.status !== "published" && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${APPROVAL_STYLE[approval]}`}
            title={post.review_note ? `Changes requested: ${post.review_note}` : APPROVAL_LABELS[approval]}
          >
            {APPROVAL_LABELS[approval]}
          </span>
        )}
        <input
          value={post.title}
          onChange={(e) => onTitle(post.id, e.target.value)}
          onBlur={(e) => onSaveTitle(post.id, e.target.value)}
          className="min-w-[10rem] flex-1 bg-transparent text-sm text-ink focus:outline-none"
        />
        {post.body && !expanded && <span className="shrink-0 text-[11px] text-emerald-600">drafted</span>}
        {post.gcal_event_ids && post.gcal_event_ids.length > 0 && (
          <span className="shrink-0 text-[11px] text-peri-deep" title="Plan, draft & publish events are on your Google Calendar">
            📅 On calendar
          </span>
        )}
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
          onClick={onStudio}
          className="shrink-0 rounded-full bg-peri-soft px-2.5 py-1 text-xs font-medium text-peri-deep transition-colors hover:brightness-95"
        >
          Studio ⤢
        </button>
        {/* Approval actions. Editors submit; founders approve or send back.
            Once approved, the submit button is replaced by the Approved chip above. */}
        {post.status !== "published" && (approval === "none" || approval === "changes") && (
          <button
            type="button"
            onClick={() => onSubmit(post.id)}
            className="shrink-0 rounded-full border border-hairline px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:text-peri-deep"
          >
            Submit for approval
          </button>
        )}
        {post.status !== "published" && approval === "pending" && isFounder && (
          <>
            <button
              type="button"
              onClick={() => onApprove(post.id)}
              className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 transition-colors hover:brightness-95"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => onRequestChanges(post.id)}
              className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-hint transition-colors hover:text-red-600"
            >
              Request changes
            </button>
          </>
        )}
        <PublishNow
          variant="row"
          postId={post.id}
          channel={post.channel}
          getText={() => post.body}
          onPublished={() => onStatus(post.id, "published")}
        />
        <button
          type="button"
          onClick={() => onRemove(post.id)}
          className="shrink-0 text-xs text-hint transition-colors hover:text-red-600 hover:underline"
        >
          Remove
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 pl-7">
          {/* Summary of the copy (read-only preview — draft in the Studio) */}
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-hint">Post copy</span>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">
              {post.body ? (
                post.body.length > 280 ? `${post.body.slice(0, 280)}…` : post.body
              ) : (
                <span className="text-hint">No copy yet — open the Studio to write it with Alfred.</span>
              )}
            </p>
          </div>

          {/* Media preview — first image / video */}
          {previewMedia.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {previewMedia.slice(0, 4).map((m) =>
                m.kind === "video" ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video key={m.id} src={m.url} className="h-20 w-20 rounded-[var(--radius-control)] border border-hairline object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={m.id} src={m.url} alt="" className="h-20 w-20 rounded-[var(--radius-control)] border border-hairline object-cover" />
                ),
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onStudio}
            className="self-start rounded-[var(--radius-control)] bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793]"
          >
            Open in Studio →
          </button>
        </div>
      )}
    </li>
  );
}
