"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ContentStudio from "./ContentStudio";
import { createPost, updatePost, deletePost } from "@/lib/marketing/schedule-actions";
import type { ContentPost, ContentStatus } from "@/lib/marketing/schedule";

/* Create & compose a post for a channel WITHOUT leaving the channel page.
   Opens the full Studio (caption, media, Alfred co-writing, schedule/publish)
   in a modal, on a fresh draft pre-set to this channel. An untouched draft is
   discarded on close so the pipeline stays clean. */

const BLANK = "Untitled post";

export default function CreatePostButton({ channel, label = "✦  Create post" }: { channel: string; label?: string }) {
  const router = useRouter();
  const [post, setPost] = useState<ContentPost | null>(null);
  const [busy, setBusy] = useState(false);

  async function open() {
    if (busy) return;
    setBusy(true);
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
    // Discard an untouched draft so blank posts don't pile up.
    if (p && p.title.trim() === BLANK && !p.body.trim()) void deletePost(p.id);
    setPost(null);
    router.refresh();
  }

  const patch = (f: Partial<ContentPost>) => setPost((p) => (p ? { ...p, ...f } : p));

  return (
    <>
      <button className="mc-cta" onClick={open} disabled={busy}>{busy ? "…" : label}</button>

      {post && (
        <div
          onClick={close}
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(11,11,15,0.42)", display: "grid", placeItems: "start center", padding: "24px 16px", overflowY: "auto" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(1040px, 96vw)" }}>
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
          </div>
        </div>
      )}
    </>
  );
}
