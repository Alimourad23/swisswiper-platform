"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ContentStudio from "./ContentStudio";
import PublishNow from "./PublishNow";
import { createPost, updatePost, deletePost } from "@/lib/marketing/schedule-actions";
import type { ContentPost, ContentStatus } from "@/lib/marketing/schedule";

/* Create & compose a post for a channel WITHOUT leaving the channel page.
   Opens the full Studio (caption, media, Alfred co-writing) with a publish bar
   pinned to the bottom: Instagram publishes directly; LinkedIn has no publishing
   API (read-only export), so it offers copy + open-LinkedIn for a manual post. */

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
    // Discard an untouched blank draft so we don't litter the pipeline.
    if (p && p.title.trim() === BLANK && !p.body.trim()) void deletePost(p.id);
    setPost(null);
    router.refresh();
  }

  const patch = (f: Partial<ContentPost>) => setPost((p) => (p ? { ...p, ...f } : p));

  return (
    <>
      <button className="mc-cta" onClick={open} disabled={busy}>{busy ? "…" : label}</button>

      {post && (
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
          footer={
            <PublishNow
              variant="bar"
              postId={post.id}
              channel={post.channel}
              getText={() => post.body}
              onPublished={() => { patch({ status: "published" }); router.refresh(); }}
            />
          }
        />
      )}
    </>
  );
}
