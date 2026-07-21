import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emailTemplate, sendEmail } from "@/lib/notifications";
import {
  createCarouselContainer,
  createCarouselItemContainer,
  createImageContainer,
  createStoryContainer,
  createVideoContainer,
  getContainerStatus,
  getInstagramProfile,
  getMediaPermalink,
  publishContainer,
} from "@/lib/instagram/client";

/* Instagram auto-publishing engine (used by the /api/marketing/publish cron).

   Safety model:
   - A post is only ever considered when the team explicitly switched
     auto_publish ON for that post (off by default).
   - Due = channel instagram + status 'scheduled' + scheduled_for between
     two days ago and today (a missed post never surprises weeks later).
   - Each post is CLAIMED atomically (compare-and-set on publish_status) so two
     overlapping cron runs can never double-post.
   - Outcome lands on the row: published (+ link) or failed (+ friendly error),
     visible in the Studio. A failed post never auto-retries — a human clears
     the error and re-arms it. */

type DuePost = {
  id: string;
  title: string;
  body: string;
  scheduled_for: string;
  /** post | carousel | story | reel (or legacy/empty = auto from media). */
  format?: string | null;
};

type MediaRow = { kind: string; url: string };

const dateStr = (d: Date) => d.toISOString().slice(0, 10);

export async function publishDueInstagramPosts(
  admin: SupabaseClient,
): Promise<{ due: number; published: number; failed: number; results: { id: string; title: string; ok: boolean; note: string }[] }> {
  const today = new Date();
  const windowStart = new Date(today.getTime() - 2 * 86_400_000);

  const { data: dueRows, error } = await admin
    .from("content_posts")
    .select("id, title, body, scheduled_for, format")
    .eq("channel", "instagram")
    .eq("status", "scheduled")
    .eq("auto_publish", true)
    .is("publish_status", null)
    .gte("scheduled_for", dateStr(windowStart))
    .lte("scheduled_for", dateStr(today))
    .or(`publish_at.is.null,publish_at.lte.${today.toISOString()}`);
  if (error) throw new Error(error.message);

  const due = (dueRows ?? []) as DuePost[];
  const results: { id: string; title: string; ok: boolean; note: string }[] = [];
  if (due.length === 0) return { due: 0, published: 0, failed: 0, results };

  // One profile lookup serves every post this run.
  let igUserId: string;
  try {
    igUserId = (await getInstagramProfile()).userId;
  } catch (e) {
    // Connection-level problem (missing/expired token): mark every due post
    // failed so the team SEES it in the Studio instead of silent nothing.
    const note = e instanceof Error ? e.message : "Instagram connection failed.";
    for (const p of due) {
      await admin
        .from("content_posts")
        .update({ publish_status: "failed", publish_error: note })
        .eq("id", p.id)
        .is("publish_status", null);
      results.push({ id: p.id, title: p.title, ok: false, note });
    }
    return { due: due.length, published: 0, failed: due.length, results };
  }

  let published = 0;
  let failed = 0;

  for (const post of due) {
    // Atomic claim: only proceed if WE flipped publish_status null → publishing.
    const { data: claimed } = await admin
      .from("content_posts")
      .update({ publish_status: "publishing" })
      .eq("id", post.id)
      .is("publish_status", null)
      .select("id");
    if (!claimed || claimed.length === 0) {
      results.push({ id: post.id, title: post.title, ok: false, note: "Already being published by another run." });
      continue;
    }

    try {
      const mediaId = await publishOne(admin, igUserId, post);
      const permalink = await getMediaPermalink(mediaId);
      await admin
        .from("content_posts")
        .update({
          status: "published",
          publish_status: "published",
          published_at: new Date().toISOString(),
          external_post_id: mediaId,
          external_permalink: permalink,
          publish_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", post.id);
      published++;
      results.push({ id: post.id, title: post.title, ok: true, note: permalink ?? mediaId });
    } catch (e) {
      const note = e instanceof Error ? e.message : "Publishing failed.";
      await admin
        .from("content_posts")
        .update({ publish_status: "failed", publish_error: note })
        .eq("id", post.id);
      failed++;
      results.push({ id: post.id, title: post.title, ok: false, note });
    }
  }

  // One summary email to the shared marketing inbox per run with outcomes.
  if (published + failed > 0) {
    const lines = results
      .filter((r) => r.ok || r.note !== "Already being published by another run.")
      .map((r) => `${r.ok ? "Published" : "Failed"} — ${r.title}${r.ok ? "" : `: ${r.note}`}`);
    await sendEmail(
      "marketing@swisswiper.com",
      `Instagram publishing: ${published} published${failed ? `, ${failed} failed` : ""}`,
      emailTemplate({
        heading: "Instagram publishing",
        body: `Today's run: ${published} published${failed ? `, ${failed} failed` : ""}.`,
        lines,
        link: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/marketing/pipeline`,
        linkLabel: "Open the pipeline",
      }),
    ).catch(() => {});
  }

  return { due: due.length, published, failed, results };
}

/* Publish ONE post immediately ("Publish now" in the Studio). Same engine and
   the same atomic claim as the cron — a post mid-publish elsewhere can't be
   double-posted. Works from a signed-in session client (RLS allows the team to
   update content_posts). A previously failed post can be retried directly. */
export async function publishSingleInstagramPost(
  db: SupabaseClient,
  postId: string,
): Promise<{ ok: boolean; permalink?: string | null; error?: string }> {
  const { data: row } = await db
    .from("content_posts")
    .select("id, title, body, format, channel, status, publish_status")
    .eq("id", postId)
    .maybeSingle();
  if (!row) return { ok: false, error: "I couldn't find that post." };
  const post = row as { id: string; title: string; body: string; format: string | null; channel: string; status: string; publish_status: string | null };
  if (post.channel !== "instagram") return { ok: false, error: "Only Instagram posts can be published here." };
  if (post.status === "published" || post.publish_status === "published") {
    return { ok: false, error: "This post is already published." };
  }

  // Atomic claim: null or failed → publishing (never steal an in-flight publish).
  const { data: claimed } = await db
    .from("content_posts")
    .update({ publish_status: "publishing", publish_error: null })
    .eq("id", postId)
    .or("publish_status.is.null,publish_status.eq.failed")
    .select("id");
  if (!claimed || claimed.length === 0) {
    return { ok: false, error: "This post is already being published." };
  }

  try {
    const igUserId = (await getInstagramProfile()).userId;
    const mediaId = await publishOne(db, igUserId, { id: post.id, title: post.title, body: post.body, scheduled_for: "", format: post.format });
    const permalink = await getMediaPermalink(mediaId);
    await db
      .from("content_posts")
      .update({
        status: "published",
        publish_status: "published",
        published_at: new Date().toISOString(),
        external_post_id: mediaId,
        external_permalink: permalink,
        publish_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
    return { ok: true, permalink };
  } catch (e) {
    const note = e instanceof Error ? e.message : "Publishing failed.";
    await db.from("content_posts").update({ publish_status: "failed", publish_error: note }).eq("id", postId);
    return { ok: false, error: note };
  }
}

/* Publish a single post, format-aware: feed post (image), carousel (2-10
   images), Story (image/video, caption ignored by Instagram), or Reel (video).
   Format comes from the post's `format` field; empty = auto from the attached
   media. Throws a friendly Error on any problem. */
async function publishOne(admin: SupabaseClient, igUserId: string, post: DuePost): Promise<string> {
  const { data: mediaRows } = await admin
    .from("content_media")
    .select("kind, url")
    .eq("post_id", post.id)
    .order("created_at", { ascending: true });
  const media = (mediaRows ?? []) as MediaRow[];
  const images = media.filter((m) => m.kind === "image");
  const videos = media.filter((m) => m.kind === "video");

  const format = resolveIgFormat(post.format, videos.length > 0, images.length);
  const caption = (post.body || post.title || "").trim();
  if (format !== "story" && !caption) {
    throw new Error("The post has no copy yet — write the caption in the Studio first.");
  }
  const deadline = Date.now() + 45_000;

  if (format === "story") {
    const src = images[0] ?? videos[0];
    if (!src) throw new Error("A Story needs an image or video — add media in the Studio.");
    const id = await createStoryContainer(
      igUserId,
      src.kind === "image" ? { imageUrl: src.url } : { videoUrl: src.url },
    );
    await waitFinished(id, deadline, src.kind === "image");
    return publishContainer(igUserId, id);
  }

  if (format === "carousel") {
    if (images.length < 2) throw new Error("A carousel needs at least 2 images — add more in the Studio.");
    const children: string[] = [];
    for (const img of images.slice(0, 10)) {
      children.push(await createCarouselItemContainer(igUserId, img.url));
    }
    for (const c of children) await waitFinished(c, deadline, true);
    const carousel = await createCarouselContainer(igUserId, children, caption);
    await waitFinished(carousel, deadline, true);
    return publishContainer(igUserId, carousel);
  }

  if (format === "reel") {
    const video = videos[0];
    if (!video) throw new Error("A Reel needs a video — add one in the Studio.");
    const id = await createVideoContainer(igUserId, video.url, caption);
    await waitFinished(id, deadline, false);
    return publishContainer(igUserId, id);
  }

  // Feed post (single image; falls back to a Reel if only video is attached).
  const image = images[0];
  if (!image) {
    if (videos.length) {
      const id = await createVideoContainer(igUserId, videos[0].url, caption);
      await waitFinished(id, deadline, false);
      return publishContainer(igUserId, id);
    }
    throw new Error("Instagram needs an image or video — add media to the post in the Studio.");
  }
  const id = await createImageContainer(igUserId, image.url, caption);
  await waitFinished(id, deadline, true);
  return publishContainer(igUserId, id);
}

/* Explicit format wins; otherwise choose sensibly from the attached media. */
function resolveIgFormat(
  format: string | null | undefined,
  hasVideo: boolean,
  imageCount: number,
): "post" | "carousel" | "story" | "reel" {
  const f = (format ?? "").toLowerCase().trim();
  if (f === "story") return "story";
  if (f === "carousel") return "carousel";
  if (f === "reel" || f === "video") return "reel";
  if (f === "") {
    if (hasVideo && imageCount === 0) return "reel";
    if (imageCount > 1) return "carousel";
  }
  return "post";
}

/* Poll a container until Instagram finishes processing it. */
async function waitFinished(containerId: string, deadline: number, isImage: boolean): Promise<void> {
  for (;;) {
    const status = await getContainerStatus(containerId);
    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error("Instagram couldn't process the media (unsupported format or size).");
    }
    if (Date.now() > deadline) {
      throw new Error(
        isImage
          ? "Instagram took too long processing the image — try again shortly."
          : "The video is still processing on Instagram's side — try again in a few minutes, or post it manually.",
      );
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }
}
