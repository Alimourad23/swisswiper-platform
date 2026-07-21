"use client";

import { useEffect, useRef, useState } from "react";
import { channels } from "@/lib/marketing/channels";
import { CONTENT_STATUSES, type ContentPost, type ContentStatus } from "@/lib/marketing/schedule";
import { getMedia, deleteMedia } from "@/lib/marketing/media-actions";
import { setInstagramPublish, publishNow, updatePost } from "@/lib/marketing/schedule-actions";
import type { ContentMedia } from "@/lib/marketing/media";

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

// Nano Banana models — input prompt limits (tokens) for the on-screen guide.
const MODEL_INFO: Record<string, { name: string; tokens: number }> = {
  pro: { name: "Nano Banana Pro", tokens: 65536 },
  flash: { name: "Nano Banana 2", tokens: 131072 },
};

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
  onDelete,
  onLocalPatch,
  isFounder = false,
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
  onDelete: (id: string) => void;
  onLocalPatch: (id: string, p: Partial<ContentPost>) => void;
  isFounder?: boolean;
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [media, setMedia] = useState<ContentMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [genPrompt, setGenPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [genModel, setGenModel] = useState("pro");
  const [genAspect, setGenAspect] = useState("1:1");
  const [genSize, setGenSize] = useState("2K");
  const [genCount, setGenCount] = useState(1);
  const [mediaMode, setMediaMode] = useState<"choose" | "upload" | "create">("choose");
  const [publishingNow, setPublishingNow] = useState(false);
  const [confirmPub, setConfirmPub] = useState(false);
  const [genKind, setGenKind] = useState<"image" | "video">("image");
  const [genSource, setGenSource] = useState<"text" | "image">("text");
  const [genSourceId, setGenSourceId] = useState<string | null>(null);
  // Video (Veo)
  const [vidModel, setVidModel] = useState("quality");
  const [vidAspect, setVidAspect] = useState("16:9");
  const [vidRes, setVidRes] = useState("1080p");
  const [vidSeconds, setVidSeconds] = useState(8);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoStatus, setVideoStatus] = useState("");
  const videoPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLTextAreaElement>(null);

  const images = media.filter((m) => m.kind === "image");
  const igVideos = media.filter((m) => m.kind === "video");

  // Per-format readiness for Instagram publishing (null = ready to publish).
  const igFormat =
    (post.format || "").toLowerCase() ||
    (igVideos.length && !images.length ? "reel" : images.length > 1 ? "carousel" : "post");
  const igBlocker: string | null =
    igFormat === "story"
      ? images.length || igVideos.length
        ? null
        : "a Story needs an image or video"
      : igFormat === "carousel"
        ? images.length < 2
          ? "a carousel needs at least 2 images"
          : post.body.trim()
            ? null
            : "write the caption first"
        : igFormat === "reel" || igFormat === "video"
          ? !igVideos.length
            ? "a Reel needs a video"
            : post.body.trim()
              ? null
              : "write the caption first"
          : !images.length && !igVideos.length
            ? "add an image first"
            : post.body.trim()
              ? null
              : "write the caption first";

  // Load attached media when the studio opens.
  useEffect(() => {
    let alive = true;
    void getMedia(post.id).then((m) => {
      if (alive) setMedia(m);
    });
    return () => {
      alive = false;
    };
  }, [post.id]);

  // Auto-draft the copy from Alfred's seed idea (once) when the post came from a
  // suggestion and has no body yet.
  const autoDraftedRef = useRef<string | null>(null);
  const [autoDrafting, setAutoDrafting] = useState(false);
  useEffect(() => {
    if (!post.seed_idea || post.body || autoDraftedRef.current === post.id) return;
    autoDraftedRef.current = post.id;
    setAutoDrafting(true);
    void (async () => {
      try {
        const res = await fetch("/api/marketing/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: post.title, channel: post.channel, brief: post.seed_idea }),
        });
        const data = (await res.json()) as { text?: string };
        if (data.text) {
          onBodyChange(post.id, data.text);
          onBodySave(post.id, data.text);
        }
      } catch {
        /* auto-draft is best-effort */
      }
      setAutoDrafting(false);
    })();
  }, [post.id, post.seed_idea, post.body, post.title, post.channel, onBodyChange, onBodySave]);

  async function doPublishNow() {
    setConfirmPub(false);
    setPublishingNow(true);
    try {
      const r = await publishNow(post.id);
      if (r.ok) {
        onLocalPatch(post.id, {
          status: "published",
          publish_status: "published",
          external_permalink: r.permalink ?? null,
          publish_error: null,
        });
      } else {
        onLocalPatch(post.id, { publish_status: "failed", publish_error: r.error ?? "Publishing failed." });
      }
    } catch {
      onLocalPatch(post.id, { publish_status: "failed", publish_error: "Publishing failed — try again." });
    }
    setPublishingNow(false);
  }

  async function uploadFiles(files: FileList) {
    setUploading(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("postId", post.id);
      fd.append("file", file);
      try {
        const res = await fetch("/api/marketing/media/upload", { method: "POST", body: fd });
        const data = (await res.json()) as { media?: ContentMedia };
        if (data.media) setMedia((m) => [...m, data.media as ContentMedia]);
      } catch {
        /* upload is best-effort */
      }
    }
    setUploading(false);
  }

  async function removeMedia(id: string) {
    setMedia((m) => m.filter((x) => x.id !== id));
    await deleteMedia(id);
  }

  // Stop any video polling when the studio closes/unmounts.
  useEffect(() => {
    return () => {
      if (videoPollRef.current) clearTimeout(videoPollRef.current);
    };
  }, []);

  async function generateVideo() {
    const prompt = genPrompt.trim();
    if (!prompt || videoBusy) return;
    setVideoBusy(true);
    setGenError("");
    setVideoStatus("Starting…");
    try {
      const res = await fetch("/api/marketing/media/video/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          prompt,
          model: vidModel,
          aspectRatio: vidAspect,
          resolution: vidRes,
          seconds: vidSeconds,
        }),
      });
      const data = (await res.json()) as { jobId?: string; error?: string };
      if (!data.jobId) {
        setGenError(data.error || "Couldn't start the video.");
        setVideoBusy(false);
        setVideoStatus("");
        return;
      }
      const started = Date.now();
      const poll = async () => {
        try {
          const r = await fetch(`/api/marketing/media/video/status?jobId=${data.jobId}`);
          const d = (await r.json()) as { status?: string; media?: ContentMedia; error?: string };
          if (d.status === "done" && d.media) {
            setMedia((m) => [...m, d.media as ContentMedia]);
            setVideoBusy(false);
            setVideoStatus("");
            setGenPrompt("");
            return;
          }
          if (d.status === "error") {
            setGenError(d.error || "Video generation failed.");
            setVideoBusy(false);
            setVideoStatus("");
            return;
          }
          const secs = Math.round((Date.now() - started) / 1000);
          setVideoStatus(`Generating… ${secs}s (this can take 1–3 minutes)`);
          videoPollRef.current = setTimeout(poll, 10000);
        } catch {
          videoPollRef.current = setTimeout(poll, 10000);
        }
      };
      videoPollRef.current = setTimeout(poll, 8000);
    } catch {
      setGenError("Couldn't start the video.");
      setVideoBusy(false);
      setVideoStatus("");
    }
  }

  async function generateImage() {
    const prompt = genPrompt.trim();
    if (!prompt || generating) return;
    if (genSource === "image" && !genSourceId) {
      setGenError("Pick an image to edit first.");
      return;
    }
    setGenerating(true);
    setGenError("");
    const sourceUrl = genSource === "image" ? images.find((m) => m.id === genSourceId)?.url : undefined;
    try {
      const res = await fetch("/api/marketing/media/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.id,
          prompt,
          model: genModel,
          aspectRatio: genAspect,
          imageSize: genSize,
          count: genCount,
          sourceUrl,
        }),
      });
      const data = (await res.json()) as { media?: ContentMedia[]; error?: string };
      if (data.media && data.media.length) {
        setMedia((m) => [...m, ...(data.media as ContentMedia[])]);
        setGenPrompt("");
      } else {
        setGenError(data.error || "Generation failed.");
      }
    } catch {
      setGenError("Generation failed.");
    }
    setGenerating(false);
  }

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
    if (chatRef.current) chatRef.current.style.height = "auto";
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
        <div className="flex shrink-0 items-center gap-2">
          {confirmDelete ? (
            <>
              <span className="text-xs text-muted">Delete this post?</span>
              <button
                type="button"
                onClick={() => {
                  onDelete(post.id);
                  onClose();
                }}
                className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-full bg-bg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-red-600"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-bg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
              >
                Close ✕
              </button>
            </>
          )}
        </div>
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

            {post.scheduled_for && (
              <p className="text-xs text-peri-deep">
                {post.gcal_event_ids && post.gcal_event_ids.length > 0
                  ? "📅 On your Google Calendar — planning, drafting & publish-day reminders are set."
                  : "📅 Scheduling adds planning, drafting & publish-day reminders to your Google Calendar."}
              </p>
            )}

            {/* Instagram auto-publish + publish-now */}
            {post.channel === "instagram" && (
              <div className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-hairline bg-bg px-4 py-3">
                {post.publish_status === "published" ? (
                  <p className="text-xs text-emerald-700">
                    Published to Instagram
                    {post.external_permalink && (
                      <>
                        {" · "}
                        <a
                          href={post.external_permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium underline"
                        >
                          View the live post ↗
                        </a>
                      </>
                    )}
                  </p>
                ) : post.publish_status === "publishing" || publishingNow ? (
                  <p className="text-xs text-peri-deep">Publishing to Instagram…</p>
                ) : (
                  <>
                    {post.publish_status === "failed" && (
                      <p className="text-xs text-red-600">
                        Last attempt failed — {post.publish_error || "unknown error."}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="font-medium text-ink">Format</span>
                      <select
                        value={post.format || ""}
                        onChange={(e) => {
                          onLocalPatch(post.id, { format: e.target.value });
                          void updatePost(post.id, { format: e.target.value });
                        }}
                        className="rounded-full border border-hairline bg-surface px-2 py-1 text-xs text-muted focus:outline-none"
                      >
                        <option value="">Auto (from media)</option>
                        <option value="post">Feed post — 1 image</option>
                        <option value="carousel">Carousel — 2–10 images</option>
                        <option value="story">Story — image or video</option>
                        <option value="reel">Reel — video</option>
                      </select>
                      {igFormat === "story" && (
                        <span className="text-[11px] text-hint">Stories don&apos;t carry captions on Instagram</span>
                      )}
                    </div>
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(post.auto_publish)}
                        onChange={(e) => {
                          onLocalPatch(post.id, { auto_publish: e.target.checked });
                          void setInstagramPublish(post.id, { autoPublish: e.target.checked });
                        }}
                        className="mt-0.5 accent-[#5C66A6]"
                      />
                      <span className="text-xs text-muted">
                        <span className="font-medium text-ink">Auto-publish to Instagram</span> — goes live late
                        morning on the scheduled day. Needs the caption written, an image attached, and a scheduled
                        date.
                      </span>
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {confirmPub ? (
                        <>
                          <span className="text-xs text-muted">Post this to @swisswiper right now?</span>
                          <button
                            type="button"
                            onClick={() => void doPublishNow()}
                            className="rounded-full bg-peri-deep px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#4d5793]"
                          >
                            Yes — publish now
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmPub(false)}
                            className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setConfirmPub(true)}
                            disabled={Boolean(igBlocker)}
                            className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-peri-deep transition-colors hover:border-peri-deep disabled:opacity-50"
                          >
                            Publish to Instagram now
                          </button>
                          {igBlocker && <span className="text-[11px] text-hint">{igBlocker}</span>}
                          {post.publish_status === "failed" && (
                            <button
                              type="button"
                              onClick={() => {
                                onLocalPatch(post.id, { publish_status: null, publish_error: null });
                                void setInstagramPublish(post.id, { reset: true });
                              }}
                              className="rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
                            >
                              Clear error
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

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
              <span className="text-hint">{autoDrafting ? "Alfred is drafting from his idea…" : "Saved automatically"}</span>
            </div>

            {/* Media */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-hint">Media</span>
                {mediaMode !== "choose" && (
                  <button type="button" onClick={() => setMediaMode("choose")} className="text-xs text-muted transition-colors hover:text-ink">
                    ← Back
                  </button>
                )}
              </div>

              {/* Step 1 — choose a direction */}
              {mediaMode === "choose" && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMediaMode("upload")}
                    className="flex flex-col items-start gap-1 rounded-[var(--radius-control)] border border-hairline bg-surface px-4 py-3 text-left transition-colors hover:border-peri-deep"
                  >
                    <span className="text-sm font-medium text-ink">⬆ Upload</span>
                    <span className="text-xs text-hint">Add your own image or video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaMode("create")}
                    className="flex flex-col items-start gap-1 rounded-[var(--radius-control)] border border-hairline bg-surface px-4 py-3 text-left transition-colors hover:border-peri-deep"
                  >
                    <span className="text-sm font-medium text-ink">✨ Create with Alfred</span>
                    <span className="text-xs text-hint">Generate an image with Nano Banana</span>
                  </button>
                </div>
              )}

              {/* Upload */}
              {mediaMode === "upload" && (
                <div className="rounded-[var(--radius-control)] border border-dashed border-hairline px-4 py-5 text-center">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="rounded-full bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
                  >
                    {uploading ? "Uploading…" : "Choose image / video"}
                  </button>
                  <p className="mt-2 text-xs text-hint">Images and video, up to 50 MB. You can pick several at once.</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length) void uploadFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}

              {/* Create with Alfred (Nano Banana / Veo) */}
              {mediaMode === "create" && (
                <div className="flex flex-col gap-2">
                  {/* image vs video */}
                  {isFounder && (
                    <div className="flex w-fit rounded-full bg-bg p-0.5 text-xs">
                      {(["image", "video"] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setGenKind(k)}
                          className={`rounded-full px-3 py-1 font-medium capitalize transition-colors ${
                            genKind === k ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                          }`}
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  )}

                  {genKind === "image" && (
                  <>
                  {/* text-to-image vs image-to-image */}
                  <div className="flex w-fit rounded-full bg-bg p-0.5 text-xs">
                    {(["text", "image"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setGenSource(s)}
                        className={`rounded-full px-3 py-1 font-medium transition-colors ${
                          genSource === s ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
                        }`}
                      >
                        {s === "text" ? "From text" : "Edit an image"}
                      </button>
                    ))}
                  </div>

                  {/* pick a source image for image-to-image */}
                  {genSource === "image" &&
                    (images.length === 0 ? (
                      <p className="text-xs text-hint">No images yet — upload or generate one first, then come back to edit it.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {images.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setGenSourceId(m.id)}
                            className={`overflow-hidden rounded-[var(--radius-control)] border-2 transition-colors ${
                              genSourceId === m.id ? "border-peri-deep" : "border-transparent hover:border-hairline"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={m.url} alt="" className="h-14 w-14 object-cover" />
                          </button>
                        ))}
                      </div>
                    ))}

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
                    <label className="flex items-center gap-1">
                      Model
                      <select value={genModel} onChange={(e) => setGenModel(e.target.value)} className="rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-ink focus:outline-none">
                        <option value="pro">Nano Banana Pro</option>
                        <option value="flash">Nano Banana 2 (faster)</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1">
                      Ratio
                      <select value={genAspect} onChange={(e) => setGenAspect(e.target.value)} className="rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-ink focus:outline-none">
                        <option value="1:1">1:1 Square</option>
                        <option value="4:5">4:5 Portrait</option>
                        <option value="9:16">9:16 Story / Reel</option>
                        <option value="16:9">16:9 Landscape</option>
                        <option value="3:4">3:4</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1">
                      Quality
                      <select value={genSize} onChange={(e) => setGenSize(e.target.value)} className="rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-ink focus:outline-none">
                        <option value="1K">1K</option>
                        <option value="2K">2K</option>
                        <option value="4K">4K</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1">
                      Images
                      <select value={genCount} onChange={(e) => setGenCount(Number(e.target.value))} className="rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-ink focus:outline-none">
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex items-start gap-2">
                    <textarea
                      value={genPrompt}
                      onChange={(e) => setGenPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void generateImage();
                        }
                      }}
                      rows={2}
                      placeholder={
                        genSource === "image"
                          ? "Describe the edit — e.g. 'place it on a marble counter, softer light'…"
                          : "Describe an image for Alfred to generate…"
                      }
                      className="min-w-0 flex-1 resize-y rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void generateImage()}
                      disabled={generating || !genPrompt.trim()}
                      className="shrink-0 rounded-[var(--radius-control)] bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
                    >
                      {generating ? "Generating…" : genSource === "image" ? "Edit" : "Generate"}
                    </button>
                  </div>
                  <p className="text-xs text-hint">
                    {genPrompt.length.toLocaleString()} characters · {MODEL_INFO[genModel].name} accepts up to ~
                    {MODEL_INFO[genModel].tokens.toLocaleString()} tokens — keep it focused for the best result.
                  </p>
                  </>
                  )}

                  {genKind === "video" && (
                    <>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
                        <label className="flex items-center gap-1">
                          Model
                          <select value={vidModel} onChange={(e) => setVidModel(e.target.value)} className="rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-ink focus:outline-none">
                            <option value="quality">Veo 3.1</option>
                            <option value="fast">Veo 3.1 Fast</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-1">
                          Ratio
                          <select value={vidAspect} onChange={(e) => setVidAspect(e.target.value)} className="rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-ink focus:outline-none">
                            <option value="16:9">16:9 Landscape</option>
                            <option value="9:16">9:16 Story / Reel</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-1">
                          Quality
                          <select value={vidRes} onChange={(e) => setVidRes(e.target.value)} className="rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-ink focus:outline-none">
                            <option value="720p">720p</option>
                            <option value="1080p">1080p</option>
                            <option value="4k">4K</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-1">
                          Length
                          <select value={vidSeconds} onChange={(e) => setVidSeconds(Number(e.target.value))} className="rounded-[var(--radius-control)] border border-hairline bg-surface px-2 py-1 text-ink focus:outline-none">
                            {[4, 6, 8].map((n) => (
                              <option key={n} value={n}>
                                {n}s
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="flex items-start gap-2">
                        <textarea
                          value={genPrompt}
                          onChange={(e) => setGenPrompt(e.target.value)}
                          rows={2}
                          placeholder="Describe the video — scene, motion, mood…"
                          className="min-w-0 flex-1 resize-y rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => void generateVideo()}
                          disabled={videoBusy || !genPrompt.trim()}
                          className="shrink-0 rounded-[var(--radius-control)] bg-peri-deep px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4d5793] disabled:opacity-50"
                        >
                          {videoBusy ? "Generating…" : "Generate video"}
                        </button>
                      </div>
                      <p className="text-xs text-hint">
                        {videoStatus || `~$${(vidSeconds * 0.4).toFixed(2)} estimated · ${vidSeconds}s clip · video takes 1–3 minutes`}
                      </p>
                    </>
                  )}

                  {genError && <p className="text-xs text-red-600">{genError}</p>}
                </div>
              )}

              {/* Gallery */}
              {media.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {media.map((m) => (
                    <div
                      key={m.id}
                      className="group relative overflow-hidden rounded-[var(--radius-control)] border border-hairline bg-bg"
                    >
                      {m.kind === "video" ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={m.url} controls className="h-28 w-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.url} alt="" className="h-28 w-full object-cover" />
                      )}
                      {m.source === "ai" && (
                        <span className="absolute left-1 top-1 rounded-full bg-peri-deep/90 px-1.5 text-[10px] font-medium text-white">
                          AI
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void removeMedia(m.id)}
                        aria-label="Remove media"
                        className="absolute right-1 top-1 hidden rounded-full bg-black/60 px-1.5 py-0.5 text-xs leading-none text-white group-hover:block"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div
                  key={i}
                  className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-sm bg-peri-soft px-3.5 py-2 text-sm text-peri-deep"
                >
                  {m.content}
                </div>
              ) : (
                <div key={i} className="flex max-w-[90%] flex-col gap-1 self-start">
                  <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-bg px-3.5 py-2 text-sm text-ink">
                    {m.content}
                  </div>
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setGenPrompt(m.content);
                        setMediaMode("create");
                        setGenSource("text");
                        setGenError("");
                      }}
                      className="self-start text-[11px] font-medium text-peri-deep transition-opacity hover:opacity-80"
                    >
                      Use as image prompt →
                    </button>
                  )}
                </div>
              ),
            )}
            {thinking && (
              <div className="max-w-[90%] self-start rounded-2xl rounded-bl-sm bg-bg px-3.5 py-2 text-sm text-hint">
                Alfred is thinking…
              </div>
            )}
          </div>

          <div className="border-t border-hairline px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={chatRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = chatRef.current;
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                placeholder="Your thoughts, a rough draft, or 'make it shorter'…"
                className="max-h-56 min-h-0 flex-1 resize-none overflow-y-auto rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-hint focus:border-peri-deep focus:outline-none"
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
