"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ContentStudio from "./ContentStudio";
import { createPost, updatePost, deletePost, publishInstagramNow } from "@/lib/marketing/schedule-actions";
import type { ContentPost, ContentStatus } from "@/lib/marketing/schedule";

/* Create & compose a post for a channel WITHOUT leaving the channel page.
   Opens the full Studio (caption, media, Alfred co-writing) in a modal, plus a
   publish bar: Instagram publishes directly; LinkedIn has no publishing API
   (read-only export), so it offers copy + open-LinkedIn for a manual post. */

const BLANK = "Untitled post";

export default function CreatePostButton({ channel, label = "✦  Create post" }: { channel: string; label?: string }) {
  const router = useRouter();
  const [post, setPost] = useState<ContentPost | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string | null } | null>(null);

  async function open() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const res = await createPost({ title: BLANK, channel, status: "draft" });
    setBusy(false);
    if (res.ok && res.id) {
      setPost({
        id: res.id, created_by: "", title: BLANK, channel, status: "draft",
        scheduled_for: null, format: "", body: "", notes: "", created_at: "", updated_at: "",
      });
    }
  }

  function close() {
    const p = post;
    if (p && p.title.trim() === BLANK && !p.body.trim()) void deletePost(p.id);
    setPost(null);
    setMsg(null);
    router.refresh();
  }

  const patch = (f: Partial<ContentPost>) => setPost((p) => (p ? { ...p, ...f } : p));

  async function publishIG() {
    if (!post || publishing) return;
    setPublishing(true);
    setMsg(null);
    await updatePost(post.id, { body: post.body, channel: "instagram" });
    const res = await publishInstagramNow(post.id);
    setPublishing(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Published to Instagram", link: res.permalink ?? null });
      patch({ status: "published" });
      router.refresh();
    } else {
      setMsg({ ok: false, text: res.error ?? "Couldn't publish." });
    }
  }

  function copyForLinkedIn() {
    if (!post) return;
    const text = (post.body || post.title || "").trim();
    void navigator.clipboard?.writeText(text);
    setMsg({ ok: true, text: "Copied — paste it into LinkedIn" });
  }

  const isIG = post?.channel === "instagram";

  return (
    <>
      <button className="mc-cta" onClick={open} disabled={busy}>{busy ? "…" : label}</button>

      {post && (
        <div
          onClick={close}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(11,11,15,0.42)", display: "grid", placeItems: "start center", padding: "24px 16px", overflowY: "auto" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(1040px, 96vw)", display: "flex", flexDirection: "column", gap: 10 }}>
            <ContentStudio
              post={post}
              onClose={close}
              onTitle={(_id, t) => patch({ title: t })}
              onSaveTitle={(id, t) => void updatePost(id, { title: t })}
              onChan={(id, c) => { patch({ channel: c }); void updatePost(id, { channel: c }); }}
              onStatus={(id, s) => { patch({ status: s as ContentStatus }); void updatePost(id, { status: s as ContentStatus }); }}
              onSched={(id, d) => { patch({ scheduled_for: d, status: "scheduled" }); void updatePost(id, { scheduledFor: d, status: "scheduled" }); }}
              onBodyChange={(_id, b) => patch({ body: b })}
              onBodySave={(id, b) => void updatePost(id, { body: b })}
              onDelete={(id) => { void deletePost(id); setPost(null); router.refresh(); }}
            />

            {/* Publish bar */}
            <div className="flex flex-col gap-2 rounded-[13px] border border-hairline bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12px] text-muted">
                {msg ? (
                  <span className={msg.ok ? "font-medium text-[color:var(--color-live)]" : "font-medium text-[#b3261e]"}>
                    {msg.text}
                    {msg.link ? (
                      <> — <a href={msg.link} target="_blank" rel="noopener noreferrer" className="text-peri-deep underline">view ↗</a></>
                    ) : null}
                  </span>
                ) : isIG ? (
                  "Attach an image in the Studio, then publish straight to @swisswiper."
                ) : (
                  "LinkedIn posting is manual — copy your text and post it on LinkedIn."
                )}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {isIG ? (
                  <button
                    onClick={publishIG}
                    disabled={publishing}
                    className="rounded-full bg-peri-deep px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-peri-deeper disabled:opacity-60"
                  >
                    {publishing ? "Publishing…" : "Publish to Instagram now"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={copyForLinkedIn}
                      className="rounded-full border border-hairline px-4 py-2 text-[12.5px] font-medium text-ink transition-colors hover:bg-bg"
                    >
                      Copy text
                    </button>
                    <a
                      href="https://www.linkedin.com/feed/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-peri-deep px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-peri-deeper"
                    >
                      Open LinkedIn ↗
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
