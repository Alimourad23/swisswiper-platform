import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createImageContainer,
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
};

type MediaRow = { kind: string; url: string };

const dateStr = (d: Date) => d.toISOString().slice(0, 10);

export async function publishDueInstagramPosts(
  admin: SupabaseClient,
): Promise<{ due: number; published: number; failed: number; results: { id: string; ok: boolean; note: string }[] }> {
  const today = new Date();
  const windowStart = new Date(today.getTime() - 2 * 86_400_000);

  const { data: dueRows, error } = await admin
    .from("content_posts")
    .select("id, title, body, scheduled_for")
    .eq("channel", "instagram")
    .eq("status", "scheduled")
    .eq("auto_publish", true)
    .is("publish_status", null)
    .gte("scheduled_for", dateStr(windowStart))
    .lte("scheduled_for", dateStr(today));
  if (error) throw new Error(error.message);

  const due = (dueRows ?? []) as DuePost[];
  const results: { id: string; ok: boolean; note: string }[] = [];
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
      results.push({ id: p.id, ok: false, note });
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
      results.push({ id: post.id, ok: false, note: "Already being published by another run." });
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
      results.push({ id: post.id, ok: true, note: permalink ?? mediaId });
    } catch (e) {
      const note = e instanceof Error ? e.message : "Publishing failed.";
      await admin
        .from("content_posts")
        .update({ publish_status: "failed", publish_error: note })
        .eq("id", post.id);
      failed++;
      results.push({ id: post.id, ok: false, note });
    }
  }

  return { due: due.length, published, failed, results };
}

/* Publish a single post: pick its first media, create the container, wait for
   Meta to process it, publish. Throws a friendly Error on any problem. */
async function publishOne(admin: SupabaseClient, igUserId: string, post: DuePost): Promise<string> {
  const caption = (post.body || post.title || "").trim();
  if (!caption) throw new Error("The post has no copy yet — write the caption in the Studio first.");

  const { data: mediaRows } = await admin
    .from("content_media")
    .select("kind, url")
    .eq("post_id", post.id)
    .order("created_at", { ascending: true });
  const media = (mediaRows ?? []) as MediaRow[];
  const image = media.find((m) => m.kind === "image");
  const video = media.find((m) => m.kind === "video");
  if (!image && !video) {
    throw new Error("Instagram needs an image or video — add media to the post in the Studio.");
  }

  // Prefer the image; a video publishes as a Reel and needs longer processing.
  const containerId = image
    ? await createImageContainer(igUserId, image.url, caption)
    : await createVideoContainer(igUserId, (video as MediaRow).url, caption);

  // Wait for Meta to finish processing (images: seconds; Reels: can be minutes —
  // we allow ~45s inside the cron's time budget, then surface a clear message).
  const deadline = Date.now() + 45_000;
  for (;;) {
    const status = await getContainerStatus(containerId);
    if (status === "FINISHED") break;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error("Instagram couldn't process the media (unsupported format or size).");
    }
    if (Date.now() > deadline) {
      throw new Error(
        image
          ? "Instagram took too long processing the image — try again tomorrow or post manually."
          : "The video is still processing on Instagram's side — video auto-publish works best with short clips; post it manually for now.",
      );
    }
    await new Promise((r) => setTimeout(r, 3_000));
  }

  return publishContainer(igUserId, containerId);
}
